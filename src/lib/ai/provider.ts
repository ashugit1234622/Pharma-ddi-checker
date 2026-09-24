import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";

export interface AIProvider {
  /** Sends a system + user prompt pair, expects back a raw JSON string. */
  complete(system: string, user: string, useSearch?: boolean): Promise<string>;
  readonly modelId: string;
}

/**
 * Groq implementation using the OpenAI-compatible SDK.
 */
export class GroqProvider implements AIProvider {
  private client: OpenAI;
  readonly modelId: string;

  constructor() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("GROQ_API_KEY is not set.");
    }
    this.client = new OpenAI({
      apiKey,
      baseURL: "https://api.groq.com/openai/v1",
    });
    // llama-3.3-70b-versatile: current free-tier Groq model with strong JSON generation
    this.modelId = process.env.AI_MODEL || "llama-3.3-70b-versatile";
  }

  async complete(system: string, user: string, _useSearch?: boolean): Promise<string> {
    // Groq free tier does not support response_format: json_object reliably.
    // We instruct JSON via the system prompt instead.
    const response = await this.client.chat.completions.create({
      model: this.modelId,
      messages: [
        { role: "system", content: system + "\n\nYou MUST respond with valid JSON only. No markdown, no extra text." },
        { role: "user", content: user },
      ],
      temperature: 0,
    });

    const text = response.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error("Groq returned no text content.");
    }
    return text;
  }
}

/**
 * Gemini implementation.
 */
export class GeminiProvider implements AIProvider {
  private ai: GoogleGenAI;
  readonly modelId: string;
  private envVarName: string;
  private modelName: string;

  constructor(envVarName: string = "GEMINI_API_KEY", modelName: string = "gemini-2.5-flash") {
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
      // The model needs to return grounded text which we'll parse ourselves
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
 * Fallback provider that tries multiple providers in sequence with retries.
 */
export class FallbackProvider implements AIProvider {
  private providers: AIProvider[];
  
  constructor(providers: AIProvider[]) {
    if (providers.length === 0) {
      throw new Error("FallbackProvider requires at least one provider.");
    }
    this.providers = providers;
  }

  // Uses the modelId of the primary (first) provider for reporting purposes
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
        }
      }
    }

    // Reset cache so next request can re-initialize with fresh providers
    cachedProvider = null;

    throw new Error(`All AI providers failed.\nErrors:\n${allErrors.join('\n')}`);
  }
}

let cachedProvider: AIProvider | null = null;

/** 
 * Returns a FallbackProvider that tries providers sequentially.
 */
export function getAIProvider(): AIProvider {
  if (!cachedProvider) {
    const availableProviders: AIProvider[] = [];

    // All available Gemini keys registered as separate providers in priority order.
    // FallbackProvider will rotate through them automatically on any failure.
    const ddiKeys = [
      { envVar: "GEMINI_API_KEY_SECONDARY", val: process.env.GEMINI_API_KEY_SECONDARY },
      { envVar: "GEMINI_API_KEY",           val: process.env.GEMINI_API_KEY },
    ];

    for (const { envVar, val } of ddiKeys) {
      if (val && !val.startsWith("your-")) {
        try {
          const effVar = `${envVar}_EFF`;
          process.env[effVar] = val;
          availableProviders.push(new GeminiProvider(effVar, "gemini-3.6-flash"));
          console.log(`[AI ROUTER] Registered provider: ${envVar}`);
        } catch (e) {
          console.warn(`[AI ROUTER] Skipped ${envVar}:`, e instanceof Error ? e.message : String(e));
        }
      }
    }

    // Groq as final fallback if Gemini is completely unavailable
    if (process.env.GROQ_API_KEY) {
      try {
        availableProviders.push(new GroqProvider());
        console.log(`[AI ROUTER] Registered provider: GROQ_API_KEY (final fallback)`);
      } catch (e) {
        console.warn("[AI ROUTER] Groq skipped:", e instanceof Error ? e.message : String(e));
      }
    }

    if (availableProviders.length === 0) {
      throw new Error("No AI providers could be initialized. Please check your API keys (.env).");
    }

    console.log(`[AI ROUTER] Initialized with ${availableProviders.length} provider(s).`);
    cachedProvider = new FallbackProvider(availableProviders);
  }
  return cachedProvider;
}

/** Strips accidental markdown code fences some models add despite instructions. */
export function extractJson(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}
