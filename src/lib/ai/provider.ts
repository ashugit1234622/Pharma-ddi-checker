import { GoogleGenAI } from "@google/genai";
import crypto from "crypto";

export interface AIProvider {
  /** Sends a system + user prompt pair, expects back a raw JSON string. */
  complete(system: string, user: string, useSearch?: boolean, signal?: AbortSignal): Promise<string>;
  readonly modelId: string;
}

// ─── Error types for clean upstream handling ──────────────────────────────────
export class AIUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIUnavailableError';
  }
}

// ─── Circuit Breaker ──────────────────────────────────────────────────────────
enum CircuitState {
  CLOSED,   // Healthy, normal traffic
  OPEN,     // Failing, skip this provider
  HALF_OPEN // Testing recovery with one probe request
}

interface ProviderHealth {
  consecutiveFailures: number;
  consecutive503s: number;
  consecutive429s: number;
  cooldownUntil: number;
  disabled: boolean;
  lastSuccess: number;
  lastFailure: number;
  failureReason: string;
  circuitState: CircuitState;
  latencyWindow: number[];
}

const MAX_LATENCY_WINDOW = 5;
const MAX_CONSECUTIVE_FAILURES = 3;
const COOLDOWN_MS_503 = 30000;  // 30s for 503 high-demand
const COOLDOWN_MS_429 = 60000;  // 60s for quota exhaustion

const providerHealthMap = new Map<string, ProviderHealth>();

function getHealth(key: string): ProviderHealth {
  if (!providerHealthMap.has(key)) {
    providerHealthMap.set(key, {
      consecutiveFailures: 0,
      consecutive503s: 0,
      consecutive429s: 0,
      cooldownUntil: 0,
      disabled: false,
      lastSuccess: 0,
      lastFailure: 0,
      failureReason: "",
      circuitState: CircuitState.CLOSED,
      latencyWindow: []
    });
  }
  return providerHealthMap.get(key)!;
}

function avgLatency(key: string): number {
  const h = getHealth(key);
  if (h.latencyWindow.length === 0) return Infinity;
  return h.latencyWindow.reduce((a, b) => a + b, 0) / h.latencyWindow.length;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function calcBackoff(attempt: number): number {
  // attempt 1: ~1s, attempt 2: ~2s, attempt 3: ~4s, max 10s
  const base = Math.pow(2, attempt - 1) * 1000;
  const jitter = Math.random() * 500;
  return Math.min(base + jitter, 10000);
}

// ─── Single Gemini Provider ───────────────────────────────────────────────────
export class GeminiProvider implements AIProvider {
  private ai: GoogleGenAI;
  readonly modelId: string;
  readonly envVarName: string;
  readonly modelName: string;

  constructor(envVarName: string, modelName: string) {
    this.envVarName = envVarName;
    this.modelName = modelName;
    const apiKey = process.env[envVarName];
    if (!apiKey) throw new Error(`${envVarName} is not set.`);
    this.ai = new GoogleGenAI({ apiKey });
    this.modelId = `${modelName} (${envVarName})`;
  }

  async complete(system: string, user: string, useSearch: boolean = false, signal?: AbortSignal): Promise<string> {
    const config: any = { systemInstruction: system, temperature: 0 };
    if (useSearch) {
      config.tools = [{ googleSearch: {} }];
    } else {
      config.responseMimeType = "application/json";
    }

    const MAX_RETRIES = 2; // 3 attempts total per provider
    for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
      if (signal?.aborted) throw new Error("AbortError: Cancelled");

      const generatePromise = this.ai.models.generateContent({
        model: this.modelName,
        contents: user,
        config: { ...config, ...(signal && { abortSignal: signal }) }
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        const tid = setTimeout(() => reject(new Error("503 Timeout: API took too long (45s)")), 45000);
        if (signal) signal.addEventListener('abort', () => { clearTimeout(tid); reject(new Error("AbortError")); });
      });

      try {
        const response = await Promise.race([generatePromise, timeoutPromise]) as any;
        if (!response.text) throw new Error("No text content returned");
        return response.text;
      } catch (err: any) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("AbortError")) throw err;

        const isTransient = msg.includes("503") || msg.includes("Timeout") || msg.includes("429") || msg.includes("UNAVAILABLE");
        if (attempt <= MAX_RETRIES && isTransient) {
          const delay = calcBackoff(attempt);
          console.warn(`[GeminiProvider] ${this.modelId} transient error: ${msg.slice(0, 100)}. Retrying in ${Math.round(delay)}ms...`);
          await sleep(delay);
          continue;
        }
        throw err;
      }
    }
    throw new Error("Unreachable");
  }
}

// ─── Concurrency + Dedup Protection ──────────────────────────────────────────
let activeRequests = 0;
const MAX_CONCURRENCY = parseInt(process.env.MAX_AI_CONCURRENCY || "20", 10);
const requestCache = new Map<string, { result: string; expires: number }>();

// ─── Production Router ────────────────────────────────────────────────────────
export class RouterProvider implements AIProvider {
  private providers: GeminiProvider[];
  private poolName: string;

  constructor(providers: GeminiProvider[], poolName: string) {
    this.providers = providers;
    this.poolName = poolName;
  }

  get modelId() {
    return `${this.poolName} Router (${this.providers.length} providers)`;
  }

  async complete(system: string, user: string, useSearch: boolean = false, signal?: AbortSignal): Promise<string> {
    // Dedup: return cached result for identical requests within 10 seconds
    const hash = crypto.createHash("sha256").update(system + user + useSearch).digest("hex");
    const cached = requestCache.get(hash);
    if (cached && cached.expires > Date.now()) {
      console.log(`[${this.poolName}] Returning cached dedup response.`);
      return cached.result;
    }

    // Concurrency limit
    if (activeRequests >= MAX_CONCURRENCY) {
      throw new Error("429 Server is busy. Please try again shortly.");
    }

    activeRequests++;
    try {
      const result = await this._route(system, user, useSearch, signal);
      requestCache.set(hash, { result, expires: Date.now() + 10000 });
      return result;
    } finally {
      activeRequests--;
    }
  }

  private async _route(system: string, user: string, useSearch: boolean, signal?: AbortSignal): Promise<string> {
    const now = Date.now();

    // Filter to eligible providers (not disabled, not in active cooldown)
    let eligible = this.providers.filter(p => {
      const h = getHealth(p.envVarName);
      if (h.disabled) return false;
      if (h.circuitState === CircuitState.OPEN && h.cooldownUntil > now) return false;
      return true;
    });

    if (eligible.length === 0) {
      throw new Error("AI analysis is temporarily unavailable. Please try again shortly.");
    }

    // Sort: HALF_OPEN test probes first, then by lowest latency
    eligible.sort((a, b) => {
      const ha = getHealth(a.envVarName);
      const hb = getHealth(b.envVarName);
      if (ha.circuitState === CircuitState.HALF_OPEN && hb.circuitState !== CircuitState.HALF_OPEN) return -1;
      if (hb.circuitState === CircuitState.HALF_OPEN && ha.circuitState !== CircuitState.HALF_OPEN) return 1;
      return avgLatency(a.envVarName) - avgLatency(b.envVarName);
    });

    const allErrors: string[] = [];

    for (const p of eligible) {
      if (signal?.aborted) throw new Error("AbortError: Cancelled");

      const h = getHealth(p.envVarName);

      // Transition OPEN → HALF_OPEN when cooldown expires
      if (h.circuitState === CircuitState.OPEN && h.cooldownUntil <= Date.now()) {
        h.circuitState = CircuitState.HALF_OPEN;
        console.log(`[${this.poolName}] ${p.envVarName} cooldown expired. Testing with probe request (HALF_OPEN).`);
      }

      console.log(`[${this.poolName}] Attempting with ${p.envVarName} (${p.modelName})`);
      const t0 = Date.now();

      try {
        const result = await p.complete(system, user, useSearch, signal);
        const latency = Date.now() - t0;

        // ✅ Success — recover circuit
        h.circuitState = CircuitState.CLOSED;
        h.consecutiveFailures = 0;
        h.consecutive503s = 0;
        h.consecutive429s = 0;
        h.lastSuccess = Date.now();
        h.latencyWindow.push(latency);
        if (h.latencyWindow.length > MAX_LATENCY_WINDOW) h.latencyWindow.shift();

        console.log(`[${this.poolName}] Success on ${p.envVarName} (${latency}ms)`);
        return result;

      } catch (err: any) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("AbortError")) throw err;

        h.lastFailure = Date.now();
        h.failureReason = msg;
        h.consecutiveFailures++;
        allErrors.push(`[${p.envVarName}]: ${msg.slice(0, 120)}`);

        // ── Classify error and apply cooldown ───────────────────────────────
        if (msg.includes("401") || msg.includes("403")) {
          console.error(`[${this.poolName}] ${p.envVarName} auth error. Disabling permanently.`);
          h.disabled = true;
        } else if (msg.includes("404") || msg.includes("NOT_FOUND")) {
          console.error(`[${this.poolName}] Model ${p.modelName} not found on ${p.envVarName}. Disabling.`);
          h.disabled = true;
        } else if (msg.includes("503") || msg.includes("Timeout") || msg.includes("UNAVAILABLE")) {
          h.consecutive503s++;
          h.cooldownUntil = Date.now() + COOLDOWN_MS_503;
          console.warn(`[${this.poolName}] ${p.envVarName} 503/timeout. Cooldown 30s.`);
        } else if (msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED")) {
          h.consecutive429s++;
          h.cooldownUntil = Date.now() + COOLDOWN_MS_429;
          console.warn(`[${this.poolName}] ${p.envVarName} 429/quota. Cooldown 60s.`);
        }

        // ── Open circuit if too many consecutive failures ────────────────────
        if (h.circuitState === CircuitState.HALF_OPEN || h.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          h.circuitState = CircuitState.OPEN;
          h.cooldownUntil = Date.now() + Math.max(h.cooldownUntil - Date.now(), COOLDOWN_MS_503);
          console.warn(`[${this.poolName}] Circuit OPEN for ${p.envVarName}.`);
        }
      }
    }

    // ── Safe final failure ─────────────────────────────────────────────────────
    console.error(`[${this.poolName}] All providers failed.\n` + allErrors.join("\n"));
    throw new Error("AI analysis is temporarily unavailable. Please try again shortly.");
  }
}

// ─── Key & Model Configuration ────────────────────────────────────────────────

// DDI uses only verified working models (NOT gemini-3.8-flash which causes 503s)
const DDI_KEYS = [
  "GEMINI_API_KEY_7",
  "GEMINI_API_KEY_SECONDARY",
  "GEMINI_API_KEY",
  "GEMINI_API_KEY_5",
  "GEMINI_API_KEY_6",
];

// OCR keys are strictly isolated — never shared with DDI or Aastha
const OCR_KEYS = [
  "PRESCRIPTION_GEMINI_API_KEY_3",
  "PRESCRIPTION_GEMINI_API_KEY_4",
];

// Models known to work in this environment for DDI (one provider instance per key)
const DDI_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];

// Lite model known to work for Aastha/chat (preserves quota)
const LITE_MODELS = ["gemini-3.5-flash-lite"];

function buildProviders(keys: string[], models: string[]): GeminiProvider[] {
  const providers: GeminiProvider[] = [];
  for (const key of keys) {
    const val = process.env[key];
    if (val && !val.startsWith("your-")) {
      for (const model of models) {
        try {
          providers.push(new GeminiProvider(key, model));
        } catch {
          // Key not configured, skip silently
        }
      }
    }
  }
  return providers;
}

// ─── DDI / MedCheck / Ask Provider ───────────────────────────────────────────
let ddiRouter: RouterProvider | null = null;
export function getAIProvider(): AIProvider {
  if (!ddiRouter) {
    const providers = buildProviders(DDI_KEYS, DDI_MODELS);
    if (providers.length === 0) throw new Error("No valid DDI providers. Add at least one Gemini key.");
    console.log(`[DDI_ROUTER] Initialized with ${providers.length} provider(s).`);
    ddiRouter = new RouterProvider(providers, "DDI_ROUTER");
  }
  return ddiRouter;
}

// ─── Aastha / Chat / Tips / Food / Cycle / Derma Provider ────────────────────
let aasthaRouter: RouterProvider | null = null;
export function getGeminiProvider(): AIProvider {
  if (!aasthaRouter) {
    // Aastha uses ALL keys but lite model to preserve DDI quota
    const allKeys = [...DDI_KEYS, ...OCR_KEYS];
    const providers = buildProviders(allKeys, LITE_MODELS);
    if (providers.length === 0) throw new Error("No valid Aastha providers.");
    console.log(`[AASTHA_ROUTER] Initialized with ${providers.length} provider(s).`);
    aasthaRouter = new RouterProvider(providers, "AASTHA_ROUTER");
  }
  return aasthaRouter;
}

// ─── Prescription OCR Provider (strictly isolated) ────────────────────────────
// NOTE: OCR is handled directly in /api/prescription/route.ts with its own
// key rotation logic. getOCRProvider() is exported for future use only.
let ocrRouter: RouterProvider | null = null;
export function getOCRProvider(): AIProvider {
  if (!ocrRouter) {
    const providers = buildProviders(OCR_KEYS, LITE_MODELS);
    if (providers.length === 0) throw new Error("No valid OCR providers.");
    console.log(`[OCR_ROUTER] Initialized with ${providers.length} provider(s).`);
    ocrRouter = new RouterProvider(providers, "OCR_ROUTER");
  }
  return ocrRouter;
}

/** Strips accidental markdown code fences some models add despite instructions. */
export function extractJson(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}
