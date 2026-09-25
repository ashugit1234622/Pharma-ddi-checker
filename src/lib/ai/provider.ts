import { GoogleGenAI } from "@google/genai";

export interface AIProvider {
  /** Sends a system + user prompt pair, expects back a raw JSON string. */
  complete(system: string, user: string, useSearch?: boolean): Promise<string>;
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

  async complete(system: string, user: string, useSearch: boolean = false): Promise<string> {
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

    const response = await this.ai.models.generateContent({
      model: this.modelName,
      contents: user,
      config
    });

    if (!response.text) {
      throw new Error("Gemini returned no text content.");
    }
    return response.text;
  }
}

/**
 * Tries multiple Gemini providers in sequence — rotates on any failure.
 */
export class FallbackProvider implements AIProvider {
  private providers: AIProvider[];

  constructor(providers: AIProvider[]) {
    if (providers.length === 0) {
      throw new Error("FallbackProvider requires at least one provider.");
    }
    this.providers = providers;
  }

  get modelId() {
    return `Fallback Chain (Primary: ${this.providers[0].modelId})`;
  }

  async complete(system: string, user: string, useSearch: boolean = false): Promise<string> {
    const allErrors: string[] = [];

    for (let i = 0; i < this.providers.length; i++) {
      const provider = this.providers[i];
      console.log(`[AI ROUTER] Trying provider ${i + 1}/${this.providers.length}: ${provider.modelId}`);

      try {
        const result = await provider.complete(system, user, useSearch);
        return result;
      } catch (err: any) {
        const errMsg = err instanceof Error ? err.message : String(err);
        allErrors.push(`[${provider.modelId}]: ${errMsg}`);

        if (i < this.providers.length - 1) {
          console.warn(`[AI ROUTER] Provider ${i + 1} failed — rotating to provider ${i + 2}. Error: ${errMsg.slice(0, 120)}`);
          await new Promise(r => setTimeout(r, 1500));
        }
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
  { envVar: "GEMINI_API_KEY_SECONDARY",      model: "gemini-3.6-flash" },
  { envVar: "GEMINI_API_KEY",                model: "gemini-3.6-flash" },
  { envVar: "PRESCRIPTION_GEMINI_API_KEY_3", model: "gemini-3.5-flash" },
  { envVar: "PRESCRIPTION_GEMINI_API_KEY_4", model: "gemini-3.5-flash" },
  { envVar: "GEMINI_API_KEY_5",              model: "gemini-3.5-flash" },
  { envVar: "GEMINI_API_KEY_6",              model: "gemini-3.5-flash" },
] as const;

function buildGeminiProviders(effSuffix: string, logPrefix: string): AIProvider[] {
  const providers: AIProvider[] = [];
  for (const { envVar, model } of GEMINI_KEY_CONFIGS) {
    const val = process.env[envVar];
    if (val && !val.startsWith("your-")) {
      try {
        const effVar = `${envVar}_${effSuffix}`;
        process.env[effVar] = val;
        providers.push(new GeminiProvider(effVar, model));
        console.log(`[${logPrefix}] Registered: ${envVar} → ${model}`);
      } catch (e) {
        console.warn(`[${logPrefix}] Skipped ${envVar}:`, e instanceof Error ? e.message : String(e));
      }
    }
  }
  return providers;
}

// ─── DDI Analysis provider ────────────────────────────────────────────────────
let cachedProvider: AIProvider | null = null;

/**
 * Returns a Gemini FallbackProvider for DDI analysis, MedCheck, and Ask routes.
 * Rotates through all 4 Gemini keys automatically on quota/availability errors.
 */
export function getAIProvider(): AIProvider {
  if (!cachedProvider) {
    const providers = buildGeminiProviders("EFF", "AI ROUTER");
    if (providers.length === 0) {
      throw new Error("No Gemini API keys configured. Add at least one to .env");
    }
    console.log(`[AI ROUTER] Initialized with ${providers.length} provider(s).`);
    cachedProvider = new FallbackProvider(providers);
  }
  return cachedProvider;
}

// ─── Aastha chat provider (Gemini-only) ───────────────────────────────────────
let cachedGeminiProvider: AIProvider | null = null;

/**
 * Returns a Gemini FallbackProvider for the Aastha chatbot.
 * Same key list and rotation as getAIProvider — kept separate so chat and
 * analysis failures don't cross-contaminate their caches.
 */
export function getGeminiProvider(): AIProvider {
  if (!cachedGeminiProvider) {
    const providers = buildGeminiProviders("CHAT_EFF", "AASTHA ROUTER");
    if (providers.length === 0) {
      throw new Error("No Gemini API keys available for Aastha. Add at least one Gemini key to .env");
    }
    console.log(`[AASTHA ROUTER] Initialized with ${providers.length} Gemini provider(s).`);
    cachedGeminiProvider = new FallbackProvider(providers);
  }
  return cachedGeminiProvider;
}

/** Strips accidental markdown code fences some models add despite instructions. */
export function extractJson(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}
