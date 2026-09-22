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
    // Use llama-3.1-8b-instant as the supported and available free-tier model
    this.modelId = process.env.AI_MODEL || "llama-3.1-8b-instant";
  }

  async complete(system: string, user: string, useSearch?: boolean): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.modelId,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0,
      response_format: { type: "json_object" },
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
      const isApi1 = i === 0;
      const isApi2 = i === 1;
      
      if (isApi1) console.log(`[AI ROUTER] Using API 1`);
      
      try {
        const result = await provider.complete(system, user, useSearch);
        if (isApi2) console.log(`[AI ROUTER] API 2 response received`);
        return result;
      } catch (err: any) {
        const errMsg = err instanceof Error ? err.message : String(err);
        allErrors.push(`[${provider.modelId}]: ${errMsg}`);
        
        const isRecoverableQuotaError = errMsg.includes("503") || 
                                      errMsg.includes("429") || 
                                      errMsg.includes("UNAVAILABLE") || 
                                      errMsg.includes("high demand") || 
                                      errMsg.includes("RESOURCE_EXHAUSTED");
                                      
        if (isApi1 && isRecoverableQuotaError && this.providers.length > 1) {
          console.log(`[AI ROUTER] API 1 quota error → switching to API 2`);
          continue; // Try API 2
        } else if (isApi1) {
          // If it's an unrecoverable error for API 1, do NOT switch to API 2.
          break;
        }
        
        // If API 2 fails, we just exit the loop
      }
    }
    
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
    
    // Primary Gemini (API 1)
    try {
      const key1 = process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY;
      if (key1) {
        // We override the process.env just for the constructor check since it reads from process.env
        process.env.GEMINI_API_KEY_1_EFF = key1;
        availableProviders.push(new GeminiProvider("GEMINI_API_KEY_1_EFF", "gemini-2.5-flash"));
      }
    } catch (e) {
      console.warn("API 1 skipped:", e instanceof Error ? e.message : String(e));
    }

    // Secondary Gemini (API 2)
    try {
      const key2 = process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY_SECONDARY;
      if (key2) {
        process.env.GEMINI_API_KEY_2_EFF = key2;
        availableProviders.push(new GeminiProvider("GEMINI_API_KEY_2_EFF", "gemini-3.5-flash"));
      }
    } catch (e) {
      console.warn("API 2 skipped:", e instanceof Error ? e.message : String(e));
    }
    
    if (availableProviders.length === 0) {
      throw new Error("No AI providers could be initialized. Please check your API keys (.env).");
    }
    
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
