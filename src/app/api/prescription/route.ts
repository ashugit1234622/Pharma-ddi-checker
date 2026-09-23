import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { extractJson } from "../../../lib/ai/provider";

export interface PrescribedMedicine {
  rawName: string;
  normalizedName: string;
  strength: string;
  dosageForm: string;
  frequency: string;
  duration: string;
  instructions: string;
  confidence: number;
  status: "verified" | "uncertain" | "unreadable";
}

export interface PrescriptionResult {
  medicines: PrescribedMedicine[];
  overallConfidence: number;
  error?: string;
}

const SYSTEM_PROMPT = `You are a strict Prescription OCR AI. Your ONLY job is to extract visible medicine data from the provided image.
Return ONLY valid JSON with this exact structure:
{
  "medicines": [
    {
      "rawName": "string",
      "normalizedName": "string",
      "strength": "string",
      "dosageForm": "string",
      "frequency": "string",
      "duration": "string",
      "instructions": "string",
      "confidence": number (0 to 100),
      "status": "verified" | "uncertain" | "unreadable"
    }
  ],
  "overallConfidence": number (0 to 100)
}
RULES:
1. Read ONLY what is visible. NEVER invent medicine names, strengths, dosages, or frequencies.
2. If text is unclear, mark status as "uncertain" or "unreadable".
3. Avoid guessing from common prescribing patterns if the text doesn't match.
4. If a field is unreadable or absent, leave it as an empty string "".
5. Never add markdown formatting or backticks around the JSON.`;

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }

  const { image } = body as { image?: string };
  if (!image || typeof image !== "string" || image.length < 100) {
    return NextResponse.json({ error: "No valid image data provided." }, { status: 400 });
  }

  // Use dedicated OCR key (API 3) first; fall back to any available real Gemini key
  const apiKey = (() => {
    const candidates = [
      { name: "PRESCRIPTION_GEMINI_API_KEY_3", val: process.env.PRESCRIPTION_GEMINI_API_KEY_3 },
      { name: "GEMINI_API_KEY_SECONDARY",       val: process.env.GEMINI_API_KEY_SECONDARY },
      { name: "GEMINI_API_KEY",                  val: process.env.GEMINI_API_KEY },
    ];
    for (const c of candidates) {
      if (c.val && !c.val.startsWith("your-")) {
        if (c.name !== "PRESCRIPTION_GEMINI_API_KEY_3") {
          console.warn(`[PRESCRIPTION OCR] Falling back to ${c.name} for OCR.`);
        }
        return c.val;
      }
    }
    return null;
  })();

  if (!apiKey) {
    console.error("[PRESCRIPTION OCR] No valid Gemini API key found for OCR.");
    return NextResponse.json({ error: "Prescription OCR is not configured. Please add a Gemini API key." }, { status: 500 });
  }

  const MAX_RETRIES = 3;
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      console.log(`[PRESCRIPTION OCR] Using API 3 (Attempt ${attempt + 1}/${MAX_RETRIES})`);
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        // gemini-1.5-flash: fast, multimodal, handles handwritten text well
        model: "gemini-1.5-flash",
        contents: [{
          role: "user",
          parts: [
            { inlineData: { mimeType: "image/jpeg", data: image } },
            { text: SYSTEM_PROMPT }
          ]
        }],
        config: { 
          temperature: 0,
          responseMimeType: "application/json"
        }
      });

      const raw = response.text || "";
      if (!raw) throw new Error("AI returned no content.");

      let parsed: PrescriptionResult;
      try { 
        parsed = JSON.parse(extractJson(raw)); 
      } catch { 
        throw new Error("Could not parse AI response as JSON."); 
      }

      if (!Array.isArray(parsed.medicines)) parsed.medicines = [];
      console.log(`[PRESCRIPTION OCR] OCR response received. Extracted ${parsed.medicines.length} medicines.`);
      return NextResponse.json(parsed);
      
    } catch (err: unknown) {
      attempt++;
      const msg = err instanceof Error ? err.message : String(err);
      
      const isRecoverable = msg.includes("503") || msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED");
      
      if (isRecoverable && attempt < MAX_RETRIES) {
        // Exponential backoff with jitter
        const baseDelay = 1000 * Math.pow(2, attempt);
        const jitter = Math.random() * 500;
        const waitTime = baseDelay + jitter;
        console.warn(`[PRESCRIPTION OCR] Recoverable error encountered: ${msg}. Retrying in ${Math.round(waitTime)}ms...`);
        await delay(waitTime);
      } else {
        console.error(`[PRESCRIPTION OCR] Failed after ${attempt} attempts:`, msg);
        // Do not expose raw Gemini errors or API keys to the user
        return NextResponse.json({ 
          error: "Prescription reading is temporarily busy.\nPlease try again in a moment." 
        }, { status: 503 });
      }
    }
  }

  return NextResponse.json({ error: "Prescription reading is temporarily busy.\nPlease try again in a moment." }, { status: 503 });
}
