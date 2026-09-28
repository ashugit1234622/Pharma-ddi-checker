import { GoogleGenAI } from "@google/genai";

export interface AIProvider {
  /** Sends a system + user prompt pair, expects back a raw JSON string. */
  complete(system: string, user: string, useSearch?: boolean, signal?: AbortSignal): Promise<string>;
  readonly modelId: string;
}

/**
 * Gemini implementation.
 */
export class GeminiProvider implements AIProvider {
  private ai: GoogleGenAI;
  readonly modelId: string;
  private envVarName: string;
  private modelName: string;

  constructor(envVarName: string = "GEMINI_API_KEY", modelName: string = "gemini-3.6-flash") {
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
      // Google Search Grounding is incompatible with responseMimeType: "application/json"
      config.tools = [{ googleSearch: {} }];
    } else {
      config.responseMimeType = "application/json";
    }

    const generatePromise = this.ai.models.generateContent({
      model: this.modelName,
      contents: user,
      config: {
        ...config,
        ...(signal && { abortSignal: signal })
      }
    });

    // Hard 35-second timeout to prevent the SDK from hanging endlessly on internal retries,
    // but large enough to allow DDI analysis (which takes ~15-25s) to complete.
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timeoutId = setTimeout(() => reject(new Error("503 Timeout: API took too long to respond (35s).")), 35000);
      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(timeoutId);
          reject(new Error("AbortError: AI request was cancelled by the user."));
        });
      }
    });

    const response = await Promise.race([generatePromise, timeoutPromise]) as any;

    if (!response.text) {
      throw new Error("Gemini returned no text content.");
    }
    return response.text;
  }
}

/**
 * Per-provider latency tracker using a fixed-size rolling window.
 * Stored at module level so state persists across requests within the same server process.
 */
const LATENCY_WINDOW = 4; // number of recent measurements to track

interface ProviderStats {
  key: string;
  successTimes: number[];  // rolling window of latency in ms
  consecutiveFailures: number;
}

const providerStatsMap = new Map<string, ProviderStats>();

function getStats(key: string): ProviderStats {
  if (!providerStatsMap.has(key)) {
    providerStatsMap.set(key, { key, successTimes: [], consecutiveFailures: 0 });
  }
  return providerStatsMap.get(key)!;
}

function recordSuccess(key: string, latencyMs: number) {
  const stats = getStats(key);
  stats.successTimes.push(latencyMs);
  if (stats.successTimes.length > LATENCY_WINDOW) {
    stats.successTimes.shift();
  }
  stats.consecutiveFailures = 0;
}

function recordFailure(key: string) {
  const stats = getStats(key);
  stats.consecutiveFailures++;
}

/** Average latency, or Infinity if no data yet (= put it at the end). */
function avgLatency(key: string): number {
  const stats = providerStatsMap.get(key);
  if (!stats || stats.successTimes.length === 0) return Infinity;
  return stats.successTimes.reduce((a, b) => a + b, 0) / stats.successTimes.length;
}

/**
 * Adaptive provider: tries providers in ascending order of observed latency.
 * After LATENCY_WINDOW successes, the fastest key rises to the top automatically.
 * Falls back sequentially on failure exactly like the old FallbackProvider.
 */
export class AdaptiveProvider implements AIProvider {
  private providers: AIProvider[];
  private keys: string[];

  constructor(providers: AIProvider[], keys: string[]) {
    if (providers.length === 0) throw new Error("AdaptiveProvider requires at least one provider.");
    if (providers.length !== keys.length) throw new Error("providers and keys must be same length.");
    this.providers = providers;
    this.keys = keys;
  }

  get modelId() {
    const fastest = [...this.keys].sort((a, b) => avgLatency(a) - avgLatency(b))[0];
    return `Adaptive Chain (fastest: ${fastest}, avg: ${avgLatency(fastest) === Infinity ? 'no data' : Math.round(avgLatency(fastest)) + 'ms'})`;
  }

  async complete(system: string, user: string, useSearch: boolean = false, signal?: AbortSignal): Promise<string> {
    // Sort indices by ascending average latency — unknown providers (Infinity) go last
    const order = this.providers
      .map((_, i) => i)
      .sort((a, b) => avgLatency(this.keys[a]) - avgLatency(this.keys[b]));

    const sorted = order.map(i => ({ provider: this.providers[i], key: this.keys[i], originalIndex: i }));
    const allErrors: string[] = [];

    for (let rank = 0; rank < sorted.length; rank++) {
      const { provider, key, originalIndex } = sorted[rank];
      const displayIndex = rank + 1;
      const currentAvg = avgLatency(key);
      const avgStr = currentAvg === Infinity ? 'no data' : `${Math.round(currentAvg)}ms avg`;
      console.log(`[AI ROUTER] Trying provider ${displayIndex}/${sorted.length}: ${provider.modelId} (${avgStr})`);

      let success = false;
      let result = "";

      // Retry up to 3 times for 503/Busy errors before burning the key
      for (let attempt = 1; attempt <= 3; attempt++) {
        if (signal?.aborted) {
          throw new Error("AbortError: AI request was cancelled by the user.");
        }
        try {
          const t0 = Date.now();
          result = await provider.complete(system, user, useSearch, signal);
          const latency = Date.now() - t0;
          recordSuccess(key, latency);
          console.log(`[AI ROUTER] Provider ${displayIndex} succeeded in ${latency}ms. New avg: ${Math.round(avgLatency(key))}ms`);
          success = true;
          break;
        } catch (err: any) {
          const errMsg = err instanceof Error ? err.message : String(err);
          const isBusy = errMsg.includes("503") || errMsg.includes("Timeout") || errMsg.includes("High demand");

          if (errMsg.includes("AbortError")) {
            throw err;
          }

          if (attempt === 3 || !isBusy) {
            recordFailure(key);
            allErrors.push(`[${provider.modelId}]: ${errMsg}`);
            break;
          }

          console.warn(`[AI ROUTER] Provider ${displayIndex} attempt ${attempt} busy (${errMsg.slice(0, 80)}). Cooldown 2.5s...`);
          await new Promise(r => setTimeout(r, 2500));
        }
      }

      if (success) {
        return result;
      }

      if (rank < sorted.length - 1) {
        console.warn(`[AI ROUTER] Provider ${displayIndex} fully failed — rotating to next fastest.`);
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    // Reset caches so next request re-initialises with fresh providers
    cachedProvider = null;
    cachedGeminiProvider = null;

    throw new Error(`All AI providers failed.\nErrors:\n${allErrors.join('\n')}`);
  }
}

// ─── Shared key list (used by both provider functions) ────────────────────────
// Add all Gemini keys here — they become fallbacks for EVERY task automatically:
// DDI analysis, Aastha chat, MedCheck, Ask, and Prescription OCR.
// Each key+model combo has its own independent free-tier quota bucket.
const GEMINI_KEY_CONFIGS = [
  { envVar: "GEMINI_API_KEY_SECONDARY",      model: "gemini-3.8-flash" },
  { envVar: "GEMINI_API_KEY",                model: "gemini-3.8-flash" },
  { envVar: "PRESCRIPTION_GEMINI_API_KEY_3", model: "gemini-3.8-flash" },
  { envVar: "PRESCRIPTION_GEMINI_API_KEY_4", model: "gemini-3.8-flash" },
  { envVar: "GEMINI_API_KEY_5",              model: "gemini-3.8-flash" },
  { envVar: "GEMINI_API_KEY_6",              model: "gemini-3.8-flash" },
  { envVar: "GEMINI_API_KEY_7",              model: "gemini-3.8-flash" },
] as const;

function buildGeminiProviders(effSuffix: string, logPrefix: string): { providers: AIProvider[], keys: string[] } {
  const providers: AIProvider[] = [];
  const keys: string[] = [];
  for (const { envVar, model } of GEMINI_KEY_CONFIGS) {
    const val = process.env[envVar];
    if (val && !val.startsWith("your-")) {
      try {
        const effVar = `${envVar}_${effSuffix}`;
        process.env[effVar] = val;
        providers.push(new GeminiProvider(effVar, model));
        keys.push(envVar); // Use the original env var name as the stable stats key
        console.log(`[${logPrefix}] Registered: ${envVar} → ${model}`);
      } catch (e) {
        console.warn(`[${logPrefix}] Skipped ${envVar}:`, e instanceof Error ? e.message : String(e));
      }
    }
  }
  return { providers, keys };
}

// ─── DDI Analysis provider ────────────────────────────────────────────────────
let cachedProvider: AIProvider | null = null;

/**
 * Returns an AdaptiveProvider for DDI analysis, MedCheck, and Ask routes.
 * Learns the fastest API key over time and always fires it first.
 */
export function getAIProvider(): AIProvider {
  if (!cachedProvider) {
    const { providers, keys } = buildGeminiProviders("EFF", "AI ROUTER");
    if (providers.length === 0) {
      throw new Error("No Gemini API keys configured. Add at least one to .env");
    }
    console.log(`[AI ROUTER] Initialized AdaptiveProvider with ${providers.length} provider(s).`);
    cachedProvider = new AdaptiveProvider(providers, keys);
  }
  return cachedProvider;
}

// ─── Aastha chat provider (Gemini-only) ───────────────────────────────────────
let cachedGeminiProvider: AIProvider | null = null;

/**
 * Returns an AdaptiveProvider for the Aastha chatbot.
 * Kept separate so chat and analysis stats don't cross-contaminate.
 */
export function getGeminiProvider(): AIProvider {
  if (!cachedGeminiProvider) {
    const { providers, keys } = buildGeminiProviders("CHAT_EFF", "AASTHA ROUTER");
    if (providers.length === 0) {
      throw new Error("No Gemini API keys available for Aastha. Add at least one Gemini key to .env");
    }
    console.log(`[AASTHA ROUTER] Initialized AdaptiveProvider with ${providers.length} Gemini provider(s).`);
    cachedGeminiProvider = new AdaptiveProvider(providers, keys);
  }
  return cachedGeminiProvider;
}

/** Strips accidental markdown code fences some models add despite instructions. */
export function extractJson(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}
