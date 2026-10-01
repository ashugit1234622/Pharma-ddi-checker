import { GoogleGenAI } from "@google/genai";
import crypto from "crypto";

export interface AIProvider {
  /** Sends a system + user prompt pair, expects back a raw JSON string. */
  complete(system: string, user: string, useSearch?: boolean, signal?: AbortSignal): Promise<string>;
  readonly modelId: string;
}

export class AIUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIUnavailableError';
  }
}

export class AIValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIValidationError';
  }
}

enum CircuitState {
  CLOSED,
  OPEN,
  HALF_OPEN
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
const COOLDOWN_MS_503 = 30000; // 30s
const COOLDOWN_MS_429 = 60000; // 60s

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

function calculateBackoff(attempt: number): number {
  // attempt 1: ~1s, attempt 2: ~2s, attempt 3: ~4s
  const base = Math.pow(2, attempt - 1) * 1000;
  const jitter = Math.random() * 500;
  return Math.min(base + jitter, 10000); // max 10s backoff
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export class GeminiProvider implements AIProvider {
  private ai: GoogleGenAI;
  readonly modelId: string;
  readonly envVarName: string;
  readonly modelName: string;

  constructor(envVarName: string, modelName: string) {
    this.envVarName = envVarName;
    this.modelName = modelName;
    const apiKey = process.env[envVarName];
    if (!apiKey) {
      throw new Error(`${envVarName} is not set.`);
    }
    this.ai = new GoogleGenAI({ apiKey });
    this.modelId = `${modelName} (${envVarName})`;
  }

  async complete(system: string, user: string, useSearch: boolean = false, signal?: AbortSignal): Promise<string> {
    const config: any = {
      systemInstruction: system,
      temperature: 0,
    };

    if (useSearch) {
      config.tools = [{ googleSearch: {} }];
    } else {
      config.responseMimeType = "application/json";
    }

    const maxRetries = 2; // Up to 3 attempts total
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      if (signal?.aborted) throw new Error("AbortError: Cancelled");

      const generatePromise = this.ai.models.generateContent({
        model: this.modelName,
        contents: user,
        config: {
          ...config,
          ...(signal && { abortSignal: signal })
        }
      });

      const timeoutMs = 45000;
      const timeoutPromise = new Promise<never>((_, reject) => {
        const tid = setTimeout(() => reject(new Error("503 Timeout")), timeoutMs);
        if (signal) {
          signal.addEventListener('abort', () => {
            clearTimeout(tid);
            reject(new Error("AbortError"));
          });
        }
      });

      try {
        const response = await Promise.race([generatePromise, timeoutPromise]) as any;
        if (!response.text) throw new Error("No text content");
        return response.text;
      } catch (err: any) {
        const msg = err instanceof Error ? err.message : String(err);
        const isTransient = msg.includes("503") || msg.includes("Timeout") || msg.includes("429");
        
        if (attempt <= maxRetries && isTransient) {
          const delay = calculateBackoff(attempt);
          console.warn(`[GeminiProvider] ${this.modelId} transient error: ${msg}. Retrying in ${Math.round(delay)}ms...`);
          await sleep(delay);
          continue; // Retry
        }
        
        throw err; // Exhausted retries or non-transient error
      }
    }
    throw new Error("Unreachable");
  }
}

let activeRequests = 0;
const MAX_CONCURRENCY = parseInt(process.env.MAX_AI_CONCURRENCY || "20", 10);
const requestCache = new Map<string, { result: string, expires: number }>();

export class RouterProvider implements AIProvider {
  private providers: GeminiProvider[];
  private poolName: string;

  constructor(providers: GeminiProvider[], poolName: string) {
    this.providers = providers;
    this.poolName = poolName;
  }

  get modelId() {
    return `${this.poolName} Router (${this.providers.length} instances)`;
  }

  async complete(system: string, user: string, useSearch: boolean = false, signal?: AbortSignal): Promise<string> {
    // Duplicate protection
    const hash = crypto.createHash("sha256").update(system + user + useSearch).digest("hex");
    const cached = requestCache.get(hash);
    if (cached && cached.expires > Date.now()) {
      console.log(`[${this.poolName}] Returning short-lived cached response for duplicate request.`);
      return cached.result;
    }

    // Concurrency protection
    if (activeRequests >= MAX_CONCURRENCY) {
      throw new Error("429 Too Many Requests: Server concurrency limit reached.");
    }
    
    activeRequests++;
    try {
      const result = await this.routeRequest(system, user, useSearch, signal);
      // Cache for 10 seconds to catch immediate double-clicks
      requestCache.set(hash, { result, expires: Date.now() + 10000 });
      return result;
    } finally {
      activeRequests--;
    }
  }

  private async routeRequest(system: string, user: string, useSearch: boolean, signal?: AbortSignal): Promise<string> {
    const now = Date.now();
    let eligible = this.providers.filter(p => {
      const h = getHealth(p.envVarName);
      if (h.disabled) return false;
      if (h.circuitState === CircuitState.OPEN && h.cooldownUntil > now) return false;
      if (h.circuitState === CircuitState.CLOSED && h.cooldownUntil > now) return false;
      return true;
    });

    if (eligible.length === 0) {
      throw new Error("AI analysis is temporarily unavailable. Please try again shortly.");
    }

    // Sort by circuit state (HALF_OPEN should be tested), then latency
    eligible.sort((a, b) => {
      const ha = getHealth(a.envVarName);
      const hb = getHealth(b.envVarName);
      if (ha.circuitState === CircuitState.HALF_OPEN && hb.circuitState !== CircuitState.HALF_OPEN) return -1;
      if (hb.circuitState === CircuitState.HALF_OPEN && ha.circuitState !== CircuitState.HALF_OPEN) return 1;
      return avgLatency(a.envVarName) - avgLatency(b.envVarName);
    });

    const allErrors: string[] = [];

    for (const p of eligible) {
      const h = getHealth(p.envVarName);
      if (signal?.aborted) throw new Error("AbortError: Cancelled");

      // Test HALF_OPEN circuit
      if (h.circuitState === CircuitState.OPEN && h.cooldownUntil <= now) {
        h.circuitState = CircuitState.HALF_OPEN;
      }

      console.log(`[${this.poolName}] Attempting with ${p.envVarName} (${p.modelName})`);
      const t0 = Date.now();
      try {
        const result = await p.complete(system, user, useSearch, signal);
        const latency = Date.now() - t0;
        
        // Success Recovery
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
        allErrors.push(`[${p.envVarName}]: ${msg}`);

        if (msg.includes("401") || msg.includes("403")) {
          console.error(`[${this.poolName}] ${p.envVarName} returned 401/403. Disabling.`);
          h.disabled = true;
        } else if (msg.includes("404")) {
          console.error(`[${this.poolName}] ${p.modelName} not found on ${p.envVarName}. Disabling.`);
          h.disabled = true;
        } else if (msg.includes("503") || msg.includes("Timeout")) {
          h.consecutive503s++;
          h.cooldownUntil = Date.now() + COOLDOWN_MS_503;
          console.warn(`[${this.poolName}] ${p.envVarName} hit 503. Cooldown 30s.`);
        } else if (msg.includes("429") || msg.includes("quota") || msg.includes("exhausted")) {
          h.consecutive429s++;
          h.cooldownUntil = Date.now() + COOLDOWN_MS_429;
          console.warn(`[${this.poolName}] ${p.envVarName} hit 429. Cooldown 60s.`);
        }

        if (h.circuitState === CircuitState.HALF_OPEN || h.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          h.circuitState = CircuitState.OPEN;
          h.cooldownUntil = Date.now() + Math.max(COOLDOWN_MS_503, COOLDOWN_MS_429); // Force long cooldown
          console.warn(`[${this.poolName}] Circuit broken for ${p.envVarName}.`);
        }
      }
    }

    // Safe Final Failure
    console.error(`[${this.poolName}] All providers failed.\n` + allErrors.join("\n"));
    throw new Error("AI analysis is temporarily unavailable. Please try again shortly.");
  }
}

// ─── Builder and Pools ────────────────────────────────────────────────────────

const DDI_KEYS = [
  "GEMINI_API_KEY_7",
  "GEMINI_API_KEY_SECONDARY",
  "GEMINI_API_KEY",
  "GEMINI_API_KEY_5",
  "GEMINI_API_KEY_6",
];

const OCR_KEYS = [
  "PRESCRIPTION_GEMINI_API_KEY_3",
  "PRESCRIPTION_GEMINI_API_KEY_4",
];

const STANDARD_MODELS = [
  "gemini-2.5-flash",
  "gemini-1.5-flash",
  "gemini-2.0-flash",
];

const LITE_MODELS = [
  "gemini-2.5-flash-8b",
  "gemini-1.5-flash-8b",
];

function buildProviders(keys: string[], models: string[]): GeminiProvider[] {
  const providers: GeminiProvider[] = [];
  for (const key of keys) {
    if (process.env[key] && !process.env[key]!.startsWith("your-")) {
      // Add a provider variant for each valid model in the fallback chain
      for (const model of models) {
        providers.push(new GeminiProvider(key, model));
      }
    }
  }
  return providers;
}

let ddiRouter: RouterProvider | null = null;
export function getAIProvider(): AIProvider {
  if (!ddiRouter) {
    const providers = buildProviders(DDI_KEYS, STANDARD_MODELS);
    if (providers.length === 0) throw new Error("No valid DDI providers found.");
    ddiRouter = new RouterProvider(providers, "DDI_ROUTER");
  }
  return ddiRouter;
}

let aasthaRouter: RouterProvider | null = null;
export function getGeminiProvider(): AIProvider {
  if (!aasthaRouter) {
    // Aastha uses lite models to preserve quotas
    const providers = buildProviders(DDI_KEYS, LITE_MODELS);
    if (providers.length === 0) throw new Error("No valid Aastha providers found.");
    aasthaRouter = new RouterProvider(providers, "AASTHA_ROUTER");
  }
  return aasthaRouter;
}

let ocrRouter: RouterProvider | null = null;
export function getOCRProvider(): AIProvider {
  if (!ocrRouter) {
    const providers = buildProviders(OCR_KEYS, LITE_MODELS);
    if (providers.length === 0) throw new Error("No valid OCR providers found.");
    ocrRouter = new RouterProvider(providers, "OCR_ROUTER");
  }
  return ocrRouter;
}

export function extractJson(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}
