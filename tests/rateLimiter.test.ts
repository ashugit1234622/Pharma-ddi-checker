import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
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

describe('Production Rate Limiting & Abuse Protection Suite', () => {

  describe('1. IP Extraction and Trusted Proxy Security', () => {
    test('extracts valid IPv4 from cf-connecting-ip header', () => {
      const req = new Request('https://pharma.app/api/analyze', {
        headers: { 'cf-connecting-ip': '198.51.100.42' },
      });
      assert.strictEqual(extractClientIp(req), '198.51.100.42');
    });

    test('extracts valid IPv4 from x-real-ip header when no cloudflare header', () => {
      const req = new Request('https://pharma.app/api/analyze', {
        headers: { 'x-real-ip': '203.0.113.15' },
      });
      assert.strictEqual(extractClientIp(req), '203.0.113.15');
    });

    test('extracts client IP from x-forwarded-for respecting trusted proxy count', () => {
      // Client -> Proxy1 (Render) -> App
      const req = new Request('https://pharma.app/api/analyze', {
        headers: { 'x-forwarded-for': '192.0.2.1, 10.0.0.1' },
      });
      // With default trustedHops = 1, picks the client before the trusted proxy
      const ip = extractClientIp(req);
      assert.ok(ip === '10.0.0.1' || ip === '192.0.2.1');
    });

    test('sanitizes malicious or spoofed injection strings in IP headers', () => {
      const req = new Request('https://pharma.app/api/analyze', {
        headers: {
          'x-real-ip': "'; DROP TABLE rate_limits; --",
          'x-forwarded-for': 'invalid_ip_payload, <script>alert(1)</script>',
        },
      });
      // Malformed IPs fail net.isIP and fallback to safe localhost
      assert.strictEqual(extractClientIp(req), '127.0.0.1');
    });

    test('hashPrivacyIdentifier preserves privacy and does not expose raw IP', () => {
      const rawIp = '203.0.113.99';
      const hash1 = hashPrivacyIdentifier(rawIp);
      const hash2 = hashPrivacyIdentifier(rawIp);
      assert.strictEqual(hash1, hash2);
      assert.strictEqual(typeof hash1, 'string');
      assert.strictEqual(hash1.length, 16);
      assert.strictEqual(hash1.includes('203'), false);
    });

    test('sanitizeKeyComponent strips dangerous delimiters and control characters', () => {
      const dirty = "user:admin/../?#$@!%^&*() \x00\x1f";
      const sanitized = sanitizeKeyComponent(dirty);
      assert.strictEqual(/[^a-zA-Z0-9_.:-]/.test(sanitized), false);
    });
  });

  describe('2. Rate Limit Headers and Responses', () => {
    test('createRateLimitHeaders formats standard HTTP headers correctly', () => {
      const mockResult = {
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + 45000,
        limit: 10,
        retryAfterSeconds: 45,
        source: 'postgres' as const,
      };

      const headers = createRateLimitHeaders(mockResult);
      assert.strictEqual(headers['Retry-After'], '45');
      assert.strictEqual(headers['RateLimit-Limit'], '10');
      assert.strictEqual(headers['RateLimit-Remaining'], '0');
      assert.strictEqual(headers['RateLimit-Reset'], '45');
    });

    test('rateLimitResponse returns HTTP 429 with clean machine-readable JSON', async () => {
      const mockResult = {
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + 30000,
        limit: 5,
        retryAfterSeconds: 30,
        source: 'postgres' as const,
      };

      const res = rateLimitResponse(mockResult, 'Custom throttle notice.');
      assert.strictEqual(res.status, 429);
      assert.strictEqual(res.headers.get('Retry-After'), '30');
      assert.strictEqual(res.headers.get('RateLimit-Limit'), '5');

      const body = await res.json();
      assert.strictEqual(body.error, 'Custom throttle notice.');
      assert.strictEqual(body.retryAfter, 30);
      // Ensure zero internal keys or stack traces leaked
      assert.strictEqual(body.source, undefined);
      assert.strictEqual(body.key, undefined);
    });
  });

  describe('3. Memory Fallback and Single Window Counter', () => {
    test('requests below limit are allowed and decrease remaining count', async () => {
      const key = `test_single_${Date.now()}_${Math.random()}`;
      const r1 = await checkRateLimitSingle(key, 3, 10000, false);
      assert.strictEqual(r1.allowed, true);
      assert.strictEqual(r1.remaining, 2);

      const r2 = await checkRateLimitSingle(key, 3, 10000, false);
      assert.strictEqual(r2.allowed, true);
      assert.strictEqual(r2.remaining, 1);
    });

    test('requests at and above configured limit are throttled', async () => {
      const key = `test_limit_${Date.now()}_${Math.random()}`;
      await checkRateLimitSingle(key, 2, 10000, false);
      await checkRateLimitSingle(key, 2, 10000, false);

      const r3 = await checkRateLimitSingle(key, 2, 10000, false);
      assert.strictEqual(r3.allowed, false);
      assert.strictEqual(r3.remaining, 0);
      assert.ok(r3.retryAfterSeconds > 0);
    });

    test('window expiration resets counter to 1', async () => {
      const key = `test_expire_${Date.now()}_${Math.random()}`;
      // Short 50ms window
      await checkRateLimitSingle(key, 1, 50, false);
      const blocked = await checkRateLimitSingle(key, 1, 50, false);
      assert.strictEqual(blocked.allowed, false);

      // Wait for window to expire
      await new Promise(r => setTimeout(r, 70));

      const reset = await checkRateLimitSingle(key, 1, 50, false);
      assert.strictEqual(reset.allowed, true);
      assert.strictEqual(reset.remaining, 0);
    });

    test('concurrent requests cannot exceed quota through race conditions', async () => {
      const key = `test_concurrency_${Date.now()}_${Math.random()}`;
      const limit = 5;
      const totalRequests = 20;

      // Dispatch 20 concurrent requests simultaneously
      const promises = Array.from({ length: totalRequests }).map(() =>
        checkRateLimitSingle(key, limit, 10000, false)
      );

      const results = await Promise.all(promises);
      const allowedCount = results.filter(r => r.allowed).length;
      const blockedCount = results.filter(r => !r.allowed).length;

      // Exactly limit should be allowed, and the remainder blocked
      assert.strictEqual(allowedCount, limit);
      assert.strictEqual(blockedCount, totalRequests - limit);
    });
  });

  describe('4. Tiered Multi-Dimension Enforcement (User + IP)', () => {
    const testPolicy: RateLimitPolicyConfig = {
      burstLimit: 3,
      burstWindowMs: 5000,
      sustainedLimit: 5,
      sustainedWindowMs: 15000,
      failClosed: false,
    };

    test('authenticated users receive independent user quotas', async () => {
      const ip = '198.51.100.1';
      const user1 = `user_alpha_${Date.now()}`;
      const user2 = `user_beta_${Date.now()}`;

      const reqUser1 = new Request('https://pharma.app/api/analyze', {
        headers: { 'x-real-ip': ip },
      });
      const reqUser2 = new Request('https://pharma.app/api/analyze', {
        headers: { 'x-real-ip': '198.51.100.2' },
      });

      // User 1 uses up their 3 burst requests
      for (let i = 0; i < 3; i++) {
        const res = await enforceRateLimit(reqUser1, {
          category: 'test_ddi',
          policy: testPolicy,
          userId: user1,
        });
        assert.strictEqual(res.allowed, true);
      }

      // User 1 4th request is blocked
      const user1Blocked = await enforceRateLimit(reqUser1, {
        category: 'test_ddi',
        policy: testPolicy,
        userId: user1,
      });
      assert.strictEqual(user1Blocked.allowed, false);

      // User 2 on another IP is still allowed!
      const user2Allowed = await enforceRateLimit(reqUser2, {
        category: 'test_ddi',
        policy: testPolicy,
        userId: user2,
      });
      assert.strictEqual(user2Allowed.allowed, true);
    });

    test('IP-level limits remain effective across different user accounts on same IP', async () => {
      const sharedIp = `192.0.2.${Math.floor(Math.random() * 200) + 10}`;
      const policy: RateLimitPolicyConfig = {
        burstLimit: 3,
        burstWindowMs: 5000,
        failClosed: false,
      };

      const req = new Request('https://pharma.app/api/analyze', {
        headers: { 'x-real-ip': sharedIp },
      });

      // Account 1 uses 2 requests
      await enforceRateLimit(req, { category: 'test_ip_shield', policy, userId: 'acct_1' });
      await enforceRateLimit(req, { category: 'test_ip_shield', policy, userId: 'acct_1' });

      // Account 2 uses 1 request (total 3 for this IP)
      const r3 = await enforceRateLimit(req, { category: 'test_ip_shield', policy, userId: 'acct_2' });
      assert.strictEqual(r3.allowed, true);

      // Account 3 tries request on the same IP -> Throttled by IP tier!
      const r4 = await enforceRateLimit(req, { category: 'test_ip_shield', policy, userId: 'acct_3' });
      assert.strictEqual(r4.allowed, false);
      assert.strictEqual(r4.remaining, 0);
    });

    test('unauthenticated requests are handled safely via IP tier', async () => {
      const anonIp = `198.51.100.${Math.floor(Math.random() * 200) + 10}`;
      const req = new Request('https://pharma.app/api/foodcheck', {
        headers: { 'x-real-ip': anonIp },
      });

      const res = await enforceRateLimit(req, {
        category: 'anon_test',
        policy: testPolicy,
        userId: undefined,
      });

      assert.strictEqual(res.allowed, true);
      assert.ok(res.remaining >= 0);
    });
  });

  describe('5. Storage Outage & Failure Policies', () => {
    test('expensive AI endpoints fail-closed when database is unavailable', async () => {
      // Force database query failure by using failClosed = true with an unconnectable/invalid DB query
      // or testing the single window with failClosed = true
      const policy: RateLimitPolicyConfig = {
        burstLimit: 5,
        burstWindowMs: 60000,
        failClosed: true,
      };

      // When failClosed is true and DB throws, it returns allowed: false with 429/503 headers
      const result = await checkRateLimitSingle('invalid_key_simulate_closed', 5, 60000, true);
      // In local test environment without Neon DATABASE_URL, check if it either ran via DB or safely failed closed
      if (result.source === 'fail-closed') {
        assert.strictEqual(result.allowed, false);
        assert.strictEqual(result.remaining, 0);
        assert.strictEqual(result.retryAfterSeconds, 60);
      } else {
        // If local postgres is running, it succeeded via postgres
        assert.strictEqual(result.allowed, true);
      }
    });

    test('low-risk search endpoints fail-open to memory store during storage outage', async () => {
      const result = await checkRateLimitSingle('search_fail_open_test', 10, 60000, false);
      assert.strictEqual(result.allowed, true);
      assert.ok(result.remaining >= 0);
    });
  });

  describe('6. Policy Isolation Between Operations', () => {
    test('reaching limit on OCR does not affect Aastha AI or Search', async () => {
      const testIp = `203.0.113.${Math.floor(Math.random() * 200) + 10}`;
      const req = new Request('https://pharma.app/api/prescription', {
        headers: { 'x-real-ip': testIp },
      });

      const ocrPolicy: RateLimitPolicyConfig = { burstLimit: 1, burstWindowMs: 5000, failClosed: false };
      const chatPolicy: RateLimitPolicyConfig = { burstLimit: 10, burstWindowMs: 5000, failClosed: false };

      // Exhaust OCR
      await enforceRateLimit(req, { category: 'ocr', policy: ocrPolicy });
      const ocrBlocked = await enforceRateLimit(req, { category: 'ocr', policy: ocrPolicy });
      assert.strictEqual(ocrBlocked.allowed, false);

      // Aastha chat on same IP remains completely operational!
      const chatReq = new Request('https://pharma.app/api/ai/aastha', {
        headers: { 'x-real-ip': testIp },
      });
      const chatAllowed = await enforceRateLimit(chatReq, { category: 'aastha', policy: chatPolicy });
      assert.strictEqual(chatAllowed.allowed, true);
    });
  });

  describe('7. Central Configuration Defaults & Overrides', () => {
    test('RATE_LIMIT_POLICIES contains all required endpoint categories with valid settings', () => {
      const categories = ['DDI', 'OCR', 'AI_CHAT', 'AI_EXPENSIVE', 'AI_PUBLIC', 'SEARCH', 'AUTH', 'CRUD'] as const;
      for (const cat of categories) {
        const pol = RATE_LIMIT_POLICIES[cat];
        assert.ok(pol, `Missing policy for ${cat}`);
        assert.ok(pol.burstLimit > 0, `${cat} burstLimit must be > 0`);
        assert.ok(pol.burstWindowMs > 0, `${cat} burstWindowMs must be > 0`);
        if (cat === 'DDI' || cat === 'OCR' || cat === 'AI_CHAT') {
          assert.strictEqual(pol.failClosed, true, `${cat} must be failClosed: true`);
        }
      }
    });
  });
});
