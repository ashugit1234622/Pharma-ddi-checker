import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '../db';
import crypto from 'crypto';
import net from 'net';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number; // absolute unix timestamp in ms
  limit: number;
  retryAfterSeconds: number;
  source: 'postgres' | 'memory-fallback' | 'fail-closed';
}

export interface RateLimitPolicyConfig {
  burstLimit: number;
  burstWindowMs: number;
  sustainedLimit?: number;
  sustainedWindowMs?: number;
  failClosed?: boolean;
}

export interface EnforceRateLimitOptions {
  category: string;
  policy: RateLimitPolicyConfig;
  userId?: string | null;
  customIp?: string;
}

// ─── Central Policy Configurations ─────────────────────────────────────────────
// Configurable via server environment variables, with conservative production defaults
export const RATE_LIMIT_POLICIES = {
  // Expensive DDI analysis (API1/API2 fallback with circuit breakers)
  DDI: {
    burstLimit: parseInt(process.env.RATE_LIMIT_DDI_BURST || '10', 10),
    burstWindowMs: 60 * 1000, // 1 minute
    sustainedLimit: parseInt(process.env.RATE_LIMIT_DDI_SUSTAINED || '40', 10),
    sustainedWindowMs: 15 * 60 * 1000, // 15 minutes
    failClosed: true,
  },
  // Prescription OCR (Vision model, isolated API3/API4 keys, high compute cost)
  OCR: {
    burstLimit: parseInt(process.env.RATE_LIMIT_OCR_BURST || '5', 10),
    burstWindowMs: 60 * 1000, // 1 minute
    sustainedLimit: parseInt(process.env.RATE_LIMIT_OCR_SUSTAINED || '15', 10),
    sustainedWindowMs: 15 * 60 * 1000, // 15 minutes
    failClosed: true,
  },
  // Conversational AI (Aastha clinical chatbot, Derma chat, Follow-up Q&A)
  AI_CHAT: {
    burstLimit: parseInt(process.env.RATE_LIMIT_AI_CHAT_BURST || '20', 10),
    burstWindowMs: 60 * 1000, // 1 minute
    sustainedLimit: parseInt(process.env.RATE_LIMIT_AI_CHAT_SUSTAINED || '60', 10),
    sustainedWindowMs: 15 * 60 * 1000, // 15 minutes
    failClosed: true,
  },
  // Expensive AI tools (Personalized Tips generation, Cycle analysis, MedCheck search grounding)
  AI_EXPENSIVE: {
    burstLimit: parseInt(process.env.RATE_LIMIT_AI_EXPENSIVE_BURST || '15', 10),
    burstWindowMs: 60 * 1000, // 1 minute
    sustainedLimit: parseInt(process.env.RATE_LIMIT_AI_EXPENSIVE_SUSTAINED || '45', 10),
    sustainedWindowMs: 15 * 60 * 1000, // 15 minutes
    failClosed: true,
  },
  // Public AI queries (e.g., Food-drug interaction lookup)
  AI_PUBLIC: {
    burstLimit: parseInt(process.env.RATE_LIMIT_AI_PUBLIC_BURST || '15', 10),
    burstWindowMs: 60 * 1000, // 1 minute
    sustainedLimit: parseInt(process.env.RATE_LIMIT_AI_PUBLIC_SUSTAINED || '45', 10),
    sustainedWindowMs: 15 * 60 * 1000, // 15 minutes
    failClosed: true,
  },
  // High-frequency Search & Autocomplete (Levenshtein fuzzy matching)
  SEARCH: {
    burstLimit: parseInt(process.env.RATE_LIMIT_SEARCH_BURST || '120', 10),
    burstWindowMs: 60 * 1000, // 1 minute
    failClosed: false,
  },
  // Authentication & Sign-in abuse protection
  AUTH: {
    burstLimit: parseInt(process.env.RATE_LIMIT_AUTH_BURST || '10', 10),
    burstWindowMs: 60 * 1000, // 1 minute
    sustainedLimit: parseInt(process.env.RATE_LIMIT_AUTH_SUSTAINED || '30', 10),
    sustainedWindowMs: 15 * 60 * 1000, // 15 minutes
    failClosed: false,
  },
  // Standard user CRUD (History, Reminders, Profile, Feedback)
  CRUD: {
    burstLimit: parseInt(process.env.RATE_LIMIT_CRUD_BURST || '60', 10),
    burstWindowMs: 60 * 1000, // 1 minute
    failClosed: false,
  },
} satisfies Record<string, RateLimitPolicyConfig>;

// ─── In-Memory Fallback Store (for low-risk read paths during DB blips) ─────────
interface MemoryRecord {
  count: number;
  resetTime: number;
}
const memoryStore = new Map<string, MemoryRecord>();

if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    memoryStore.forEach((record, key) => {
      if (now > record.resetTime) {
        memoryStore.delete(key);
      }
    });
  }, 5 * 60 * 1000).unref?.();
}

function checkMemoryStore(key: string, maxRequests: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const record = memoryStore.get(key);

  if (!record || now > record.resetTime) {
    const resetTime = now + windowMs;
    memoryStore.set(key, { count: 1, resetTime });
    return {
      allowed: true,
      remaining: Math.max(0, maxRequests - 1),
      resetTime,
      limit: maxRequests,
      retryAfterSeconds: Math.ceil(windowMs / 1000),
      source: 'memory-fallback',
    };
  }

  if (record.count >= maxRequests) {
    const retryAfter = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime,
      limit: maxRequests,
      retryAfterSeconds: retryAfter,
      source: 'memory-fallback',
    };
  }

  record.count += 1;
  const retryAfter = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - record.count),
    resetTime: record.resetTime,
    limit: maxRequests,
    retryAfterSeconds: retryAfter,
    source: 'memory-fallback',
  };
}

// ─── Privacy-Preserving Key Generator ──────────────────────────────────────────
// Hashes IPs and sanitizes user IDs so no PII or clinical data enters store keys or logs
export function sanitizeKeyComponent(val: string): string {
  return val.replace(/[^a-zA-Z0-9_.:-]/g, '_').slice(0, 64);
}

export function hashPrivacyIdentifier(identifier: string): string {
  return crypto.createHash('sha256').update(identifier).digest('hex').slice(0, 16);
}

// ─── IP Extraction with Trusted Proxy Validation ───────────────────────────────
export function extractClientIp(req: Request | NextRequest): string {
  // Trusted proxy hops configuration (default 1 for Render/Vercel/Cloudflare fronting)
  const trustedHops = Math.max(1, parseInt(process.env.RATE_LIMIT_TRUSTED_PROXIES || '1', 10));

  // 1. Cloudflare connecting IP
  const cfIp = req.headers.get('cf-connecting-ip')?.trim();
  if (cfIp && net.isIP(cfIp) !== 0) {
    return cfIp;
  }

  // 2. Standard X-Real-IP
  const realIp = req.headers.get('x-real-ip')?.trim();
  if (realIp && net.isIP(realIp) !== 0) {
    return realIp;
  }

  // 3. X-Forwarded-For parsing with trusted reverse proxy traversal
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const ips = forwarded
      .split(',')
      .map(part => part.trim())
      .filter(ip => net.isIP(ip) !== 0);

    if (ips.length > 0) {
      // Pick the rightmost IP before the trusted reverse proxies
      const targetIndex = Math.max(0, ips.length - trustedHops);
      return ips[targetIndex];
    }
  }

  return '127.0.0.1'; // Safe localhost fallback
}

// ─── Distributed Atomic PostgreSQL Counter ────────────────────────────────────
async function atomicPostgresCounter(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const resetAt = now + windowMs;
  const pool = getDatabase();

  // 2500ms timeout promise race to prevent DB connection hang from blocking requests
  const queryPromise = pool.query(
    `INSERT INTO rate_limits (key, count, reset_at)
     VALUES ($1, 1, $2)
     ON CONFLICT (key) DO UPDATE
     SET count = CASE WHEN rate_limits.reset_at <= $3 THEN 1 ELSE rate_limits.count + 1 END,
         reset_at = CASE WHEN rate_limits.reset_at <= $3 THEN $2 ELSE rate_limits.reset_at END
     RETURNING count, reset_at;`,
    [key, resetAt, now]
  );

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Rate limiter database query timed out after 2500ms')), 2500)
  );

  const res = await Promise.race([queryPromise, timeoutPromise]);
  const row = res.rows[0];
  const count = Number(row.count);
  const rowResetAt = Number(row.reset_at);
  const allowed = count <= maxRequests;
  const remaining = Math.max(0, maxRequests - count);
  const retryAfterSeconds = Math.max(1, Math.ceil((rowResetAt - now) / 1000));

  return {
    allowed,
    remaining,
    resetTime: rowResetAt,
    limit: maxRequests,
    retryAfterSeconds,
    source: 'postgres',
  };
}

// ─── Single Window Check (Postgres with Fail-Closed / Fail-Open Policy) ────────
export async function checkRateLimitSingle(
  key: string,
  maxRequests: number,
  windowMs: number,
  failClosed: boolean = false
): Promise<RateLimitResult> {
  try {
    return await atomicPostgresCounter(key, maxRequests, windowMs);
  } catch (err: any) {
    if (failClosed) {
      console.error(`[RateLimit FAIL-CLOSED] Storage error for key "${key}":`, err?.message || err);
      // Fail closed: deny request to prevent free abuse/billing surges on expensive AI routes
      return {
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + 60000,
        limit: maxRequests,
        retryAfterSeconds: 60,
        source: 'fail-closed',
      };
    }

    // Fail open for low-risk endpoints: fallback to in-memory store
    console.warn(`[RateLimit FAIL-OPEN] Falling back to memory store for key "${key}":`, err?.message || err);
    return checkMemoryStore(key, maxRequests, windowMs);
  }
}

// ─── Tiered Distributed Rate Limiter ──────────────────────────────────────────
// Checks burst and sustained windows across IP and authenticated User ID dimensions
export async function enforceRateLimit(
  req: Request | NextRequest,
  options: EnforceRateLimitOptions
): Promise<RateLimitResult> {
  const { category, policy, userId, customIp } = options;
  const ip = customIp || extractClientIp(req);
  const ipHash = hashPrivacyIdentifier(ip);
  const failClosed = policy.failClosed ?? false;

  const checks: Promise<RateLimitResult>[] = [];

  // 1. IP Burst check (e.g. 1 minute)
  const ipBurstKey = `rl:${category}:ip:${ipHash}:burst`;
  checks.push(checkRateLimitSingle(ipBurstKey, policy.burstLimit, policy.burstWindowMs, failClosed));

  // 2. IP Sustained check (e.g. 15 minutes), if configured
  if (policy.sustainedLimit && policy.sustainedWindowMs) {
    const ipSustainedKey = `rl:${category}:ip:${ipHash}:sustained`;
    checks.push(checkRateLimitSingle(ipSustainedKey, policy.sustainedLimit, policy.sustainedWindowMs, failClosed));
  }

  // 3. User Dimension checks (if authenticated session exists)
  if (userId) {
    const sanitizedUser = sanitizeKeyComponent(userId);
    const userBurstKey = `rl:${category}:usr:${sanitizedUser}:burst`;
    checks.push(checkRateLimitSingle(userBurstKey, policy.burstLimit, policy.burstWindowMs, failClosed));

    if (policy.sustainedLimit && policy.sustainedWindowMs) {
      const userSustainedKey = `rl:${category}:usr:${sanitizedUser}:sustained`;
      checks.push(checkRateLimitSingle(userSustainedKey, policy.sustainedLimit, policy.sustainedWindowMs, failClosed));
    }
  }

  // Execute all checks in parallel (single DB round-trip concurrency)
  const results = await Promise.all(checks);

  // If any tier throttles the request, find the most restrictive
  const throttled = results.find(r => !r.allowed);
  if (throttled) {
    const maxRetryAfter = Math.max(...results.map(r => r.retryAfterSeconds));
    const minRemaining = Math.min(...results.map(r => r.remaining));
    return {
      allowed: false,
      remaining: minRemaining,
      resetTime: throttled.resetTime,
      limit: throttled.limit,
      retryAfterSeconds: maxRetryAfter,
      source: throttled.source,
    };
  }

  // If all allowed, return the most constrained tier
  const minRemaining = Math.min(...results.map(r => r.remaining));
  const mostConstrained = results.find(r => r.remaining === minRemaining) || results[0];

  return {
    ...mostConstrained,
    remaining: minRemaining,
    allowed: true,
  };
}

// ─── Standard Response & Headers Generation ───────────────────────────────────
export function createRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'Retry-After': String(result.retryAfterSeconds),
    'RateLimit-Limit': String(result.limit),
    'RateLimit-Remaining': String(result.remaining),
    'RateLimit-Reset': String(result.retryAfterSeconds),
  };
}

export function rateLimitResponse(
  result: RateLimitResult,
  customMessage?: string
): NextResponse {
  const defaultMessage = result.source === 'fail-closed'
    ? 'Service temporarily unavailable due to high system load. Please try again in a few moments.'
    : 'Too many requests. Please wait a few moments before trying again.';

  return NextResponse.json(
    {
      error: customMessage || defaultMessage,
      retryAfter: result.retryAfterSeconds,
    },
    {
      status: 429,
      headers: createRateLimitHeaders(result),
    }
  );
}

// ─── Backward Compatibility Wrappers ──────────────────────────────────────────
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetTime: number } {
  const res = checkMemoryStore(key, maxRequests, windowMs);
  return {
    allowed: res.allowed,
    remaining: res.remaining,
    resetTime: res.resetTime,
  };
}

export function getClientIdentifier(req: Request, userId?: string): string {
  if (userId) return `user:${sanitizeKeyComponent(userId)}`;
  const ip = extractClientIp(req);
  return `ip:${hashPrivacyIdentifier(ip)}`;
}
