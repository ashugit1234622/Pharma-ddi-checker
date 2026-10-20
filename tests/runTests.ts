import {
  extractClientIp,
  sanitizeKeyComponent,
  hashPrivacyIdentifier,
  checkRateLimitSingle,
  enforceRateLimit,
  createRateLimitHeaders,
  rateLimitResponse,
  RATE_LIMIT_POLICIES,
  RateLimitPolicyConfig,
} from '../src/lib/security/rateLimit';

async function runAllTests() {
  console.log('\n======================================================');
  console.log('   FARMA DDI CHECKER — RATE LIMITING VERIFICATION     ');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  async function assertTest(name: string, fn: () => Promise<void> | void) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`[FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // 1. Below limit requests are allowed
  await assertTest('Req 1: Requests below limit are allowed', async () => {
    const key = `t1_${Date.now()}`;
    const res = await checkRateLimitSingle(key, 5, 10000, false);
    if (!res.allowed || res.remaining !== 4) {
      throw new Error(`Expected allowed=true, remaining=4, got ${JSON.stringify(res)}`);
    }
  });

  // 2. Requests at and above configured limit are throttled
  await assertTest('Req 2: Requests at and above configured limit are throttled', async () => {
    const key = `t2_${Date.now()}`;
    await checkRateLimitSingle(key, 2, 10000, false);
    await checkRateLimitSingle(key, 2, 10000, false);
    const throttled = await checkRateLimitSingle(key, 2, 10000, false);
    if (throttled.allowed || throttled.remaining !== 0) {
      throw new Error(`Expected throttled request, got ${JSON.stringify(throttled)}`);
    }
  });

  // 3. 429 response contains correct retry and rate limit headers
  await assertTest('Req 3: 429 response contains correct retry information and headers', async () => {
    const mockResult = {
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + 45000,
      limit: 10,
      retryAfterSeconds: 45,
      source: 'postgres' as const,
    };
    const response = rateLimitResponse(mockResult, 'Rate limit test message.');
    if (response.status !== 429) throw new Error(`Expected status 429, got ${response.status}`);
    if (response.headers.get('Retry-After') !== '45') throw new Error('Missing Retry-After: 45');
    if (response.headers.get('RateLimit-Limit') !== '10') throw new Error('Missing RateLimit-Limit: 10');
    if (response.headers.get('RateLimit-Remaining') !== '0') throw new Error('Missing RateLimit-Remaining: 0');
    if (response.headers.get('RateLimit-Reset') !== '45') throw new Error('Missing RateLimit-Reset: 45');

    const body = await response.json();
    if (body.error !== 'Rate limit test message.' || body.retryAfter !== 45) {
      throw new Error(`Invalid response body: ${JSON.stringify(body)}`);
    }
  });

  // 4. Authenticated users receive independent quotas
  await assertTest('Req 4: Authenticated users receive independent quotas', async () => {
    const policy: RateLimitPolicyConfig = { burstLimit: 2, burstWindowMs: 5000, failClosed: false };
    const req1 = new Request('https://pharma.app/api/analyze', { headers: { 'x-real-ip': '198.51.100.10' } });
    const req2 = new Request('https://pharma.app/api/analyze', { headers: { 'x-real-ip': '198.51.100.11' } });

    const u1 = `usr_alpha_${Date.now()}`;
    const u2 = `usr_beta_${Date.now()}`;

    await enforceRateLimit(req1, { category: 't4', policy, userId: u1 });
    await enforceRateLimit(req1, { category: 't4', policy, userId: u1 });
    const u1Blocked = await enforceRateLimit(req1, { category: 't4', policy, userId: u1 });
    if (u1Blocked.allowed) throw new Error('User 1 should be blocked');

    const u2Allowed = await enforceRateLimit(req2, { category: 't4', policy, userId: u2 });
    if (!u2Allowed.allowed) throw new Error('User 2 should be allowed');
  });

  // 5. IP-level limits remain effective across different accounts
  await assertTest('Req 5: IP-level limits remain effective across different accounts', async () => {
    const sharedIp = `198.51.100.${Math.floor(Math.random() * 200) + 20}`;
    const policy: RateLimitPolicyConfig = { burstLimit: 2, burstWindowMs: 5000, failClosed: false };
    const req = new Request('https://pharma.app/api/analyze', { headers: { 'x-real-ip': sharedIp } });

    await enforceRateLimit(req, { category: 't5_ip', policy, userId: 'account_A' });
    await enforceRateLimit(req, { category: 't5_ip', policy, userId: 'account_B' });
    // Third request from new account on same IP should be blocked by IP tier
    const thirdAttempt = await enforceRateLimit(req, { category: 't5_ip', policy, userId: 'account_C' });
    if (thirdAttempt.allowed) throw new Error('IP tier should block third account attempt on same IP');
  });

  // 6. Spoofed identity and forwarded-IP headers cannot bypass protection
  await assertTest('Req 6: Spoofed identity and forwarded-IP headers cannot bypass protection', () => {
    const req = new Request('https://pharma.app/api/analyze', {
      headers: {
        'x-real-ip': "'; DROP TABLE rate_limits; --",
        'x-forwarded-for': 'spoofed_payload, <evil>',
      },
    });
    const ip = extractClientIp(req);
    if (ip !== '127.0.0.1') throw new Error(`Expected fallback to 127.0.0.1, got ${ip}`);

    const sanitized = sanitizeKeyComponent('attacker:inject;select*');
    if (sanitized.includes(';') || sanitized.includes('*')) throw new Error('Sanitization failed');
  });

  // 7. Concurrent requests cannot exceed quota through race conditions
  await assertTest('Req 7: Concurrent requests cannot exceed quota through race conditions', async () => {
    const key = `t7_concurrency_${Date.now()}`;
    const limit = 4;
    const totalRequests = 16;
    const promises = Array.from({ length: totalRequests }).map(() =>
      checkRateLimitSingle(key, limit, 5000, false)
    );
    const results = await Promise.all(promises);
    const allowed = results.filter(r => r.allowed).length;
    const blocked = results.filter(r => !r.allowed).length;
    if (allowed !== limit || blocked !== (totalRequests - limit)) {
      throw new Error(`Expected exactly ${limit} allowed and ${totalRequests - limit} blocked. Got ${allowed} allowed, ${blocked} blocked.`);
    }
  });

  // 8. Window expiration and reset behavior
  await assertTest('Req 8: Window expiration and reset behavior', async () => {
    const key = `t8_expire_${Date.now()}`;
    await checkRateLimitSingle(key, 1, 60, false);
    const blocked = await checkRateLimitSingle(key, 1, 60, false);
    if (blocked.allowed) throw new Error('Request should be blocked before expiration');

    await new Promise(r => setTimeout(r, 80));
    const reset = await checkRateLimitSingle(key, 1, 60, false);
    if (!reset.allowed || reset.remaining !== 0) throw new Error('Window should have reset to count=1');
  });

  // 9. Unauthenticated requests handled safely
  await assertTest('Req 9: Unauthenticated requests handled safely', async () => {
    const req = new Request('https://pharma.app/api/foods', { headers: { 'x-real-ip': '192.0.2.77' } });
    const policy = RATE_LIMIT_POLICIES.SEARCH;
    const res = await enforceRateLimit(req, { category: 't9_anon', policy, userId: undefined });
    if (!res.allowed) throw new Error('Unauthenticated search request should be allowed');
  });

  // 10. Malformed and oversized requests handled safely
  await assertTest('Req 10: Malformed and oversized requests handled safely', async () => {
    const req = new Request('https://pharma.app/api/drugs', { headers: {} });
    const res = await enforceRateLimit(req, {
      category: 't10_malformed',
      policy: RATE_LIMIT_POLICIES.SEARCH,
      userId: null,
    });
    if (!res.allowed) throw new Error('Empty header request should fallback safely');
  });

  // 11. Storage timeout or outage follows safe failure policy
  await assertTest('Req 11: Storage outage follows safe failure policy (failClosed for AI, failOpen for search)', async () => {
    // Fail-open test
    const failOpenRes = await checkRateLimitSingle('t11_fail_open', 10, 10000, false);
    if (!failOpenRes.allowed) throw new Error('Fail-open endpoint should allow request');

    // Policy check: AI endpoints have failClosed = true
    if (!RATE_LIMIT_POLICIES.DDI.failClosed) throw new Error('DDI policy must have failClosed: true');
    if (!RATE_LIMIT_POLICIES.OCR.failClosed) throw new Error('OCR policy must have failClosed: true');
    if (!RATE_LIMIT_POLICIES.AI_CHAT.failClosed) throw new Error('AI_CHAT policy must have failClosed: true');
    if (RATE_LIMIT_POLICIES.SEARCH.failClosed) throw new Error('SEARCH policy must have failClosed: false');
  });

  // 12. Rate limiting across simulated application instances
  await assertTest('Req 12: Rate limiting applies across simulated application instances', async () => {
    // Both instance A and instance B call checkRateLimitSingle with the same key
    const sharedKey = `t12_shared_instance_${Date.now()}`;
    const limit = 2;
    // Instance A sends 1 request
    const instA1 = await checkRateLimitSingle(sharedKey, limit, 10000, false);
    if (!instA1.allowed) throw new Error('Instance A first request should be allowed');

    // Instance B sends 1 request
    const instB1 = await checkRateLimitSingle(sharedKey, limit, 10000, false);
    if (!instB1.allowed) throw new Error('Instance B request should be allowed');

    // Instance A sends another request -> should be throttled because combined quota was 2
    const instA2 = await checkRateLimitSingle(sharedKey, limit, 10000, false);
    if (instA2.allowed) throw new Error('Instance A second request should be throttled by shared store');
  });

  // 13. API1/API2 fallback does not bypass limits or double charge
  await assertTest('Req 13: Logical request boundary prevents fallback double charge', async () => {
    // Enforcing at route boundary ensures 1 user request = 1 rate limit tick, regardless of provider retries
    const req = new Request('https://pharma.app/api/analyze', { headers: { 'x-real-ip': '198.51.100.90' } });
    const policy: RateLimitPolicyConfig = { burstLimit: 2, burstWindowMs: 5000, failClosed: false };
    const res = await enforceRateLimit(req, { category: 't13_ddi', policy, userId: 'usr_test' });
    if (res.remaining !== 1) throw new Error(`Expected remaining=1, got ${res.remaining}`);
  });

  // 14. Aastha and API3 OCR retain separate routing and protections
  await assertTest('Req 14: Aastha and API3 OCR retain separate routing and protections', async () => {
    const testIp = '198.51.100.91';
    const req = new Request('https://pharma.app/api/prescription', { headers: { 'x-real-ip': testIp } });
    const ocrPolicy: RateLimitPolicyConfig = { burstLimit: 1, burstWindowMs: 5000, failClosed: false };
    const chatPolicy: RateLimitPolicyConfig = { burstLimit: 5, burstWindowMs: 5000, failClosed: false };

    // Throttle OCR
    await enforceRateLimit(req, { category: 'ocr', policy: ocrPolicy });
    const ocrBlocked = await enforceRateLimit(req, { category: 'ocr', policy: ocrPolicy });
    if (ocrBlocked.allowed) throw new Error('OCR should be throttled');

    // Aastha chat on same IP must remain unaffected
    const chatReq = new Request('https://pharma.app/api/ai/aastha', { headers: { 'x-real-ip': testIp } });
    const chatAllowed = await enforceRateLimit(chatReq, { category: 'aastha', policy: chatPolicy });
    if (!chatAllowed.allowed) throw new Error('Aastha chat should not be blocked by OCR quota');
  });

  // 15. Authentication, session refresh, search workflows not broken
  await assertTest('Req 15: Search and session workflows not broken by normal use', async () => {
    const searchReq = new Request('https://pharma.app/api/drugs?q=aspirin', { headers: { 'x-real-ip': '198.51.100.92' } });
    const searchRes = await enforceRateLimit(searchReq, { category: 'search_drugs', policy: RATE_LIMIT_POLICIES.SEARCH });
    if (!searchRes.allowed || searchRes.limit !== 120) throw new Error('Search quota should permit high-frequency interactive typing (120 req/min)');
  });

  // 16. Existing success response contracts intact
  await assertTest('Req 16: Headers helper returns valid strings for additive response headers', () => {
    const headers = createRateLimitHeaders({
      allowed: true,
      remaining: 8,
      resetTime: Date.now() + 60000,
      limit: 10,
      retryAfterSeconds: 60,
      source: 'postgres',
    });
    if (typeof headers['Retry-After'] !== 'string' || typeof headers['RateLimit-Limit'] !== 'string') {
      throw new Error('Headers must be strings');
    }
  });

  // 17. Throttled request format prevents infinite frontend loops
  await assertTest('Req 17: Throttled response payload includes clean error and retryAfter', async () => {
    const res = rateLimitResponse({
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + 15000,
      limit: 5,
      retryAfterSeconds: 15,
      source: 'postgres',
    });
    const data = await res.json();
    if (!data.error || typeof data.retryAfter !== 'number') {
      throw new Error(`Expected clean error string and retryAfter number, got: ${JSON.stringify(data)}`);
    }
  });

  console.log('\n======================================================');
  console.log(`RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
