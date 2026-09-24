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

/** Returns all real (non-placeholder) API keys in priority order for OCR. */
function getOcrApiKeys(): Array<{ name: string; key: string }> {
  const candidates = [
    { name: "PRESCRIPTION_GEMINI_API_KEY_3", val: process.env.PRESCRIPTION_GEMINI_API_KEY_3 },
    { name: "PRESCRIPTION_GEMINI_API_KEY_4", val: process.env.PRESCRIPTION_GEMINI_API_KEY_4 },
    { name: "GEMINI_API_KEY_SECONDARY",       val: process.env.GEMINI_API_KEY_SECONDARY },
    { name: "GEMINI_API_KEY",                  val: process.env.GEMINI_API_KEY },
    { name: "GEMINI_API_KEY_5",               val: process.env.GEMINI_API_KEY_5 },
  ];
  return candidates
    .filter(c => c.val && !c.val.startsWith("your-"))
    .map(c => ({ name: c.name, key: c.val! }));
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }

  const { image } = body as { image?: string };
  if (!image || typeof image !== "string" || image.length < 100) {
    return NextResponse.json({ error: "No valid image data provided." }, { status: 400 });
  }

  const ocrKeys = getOcrApiKeys();

  if (ocrKeys.length === 0) {
    console.error("[PRESCRIPTION OCR] No valid Gemini API key found for OCR.");
    return NextResponse.json({ error: "Prescription OCR is not configured. Please add a Gemini API key." }, { status: 500 });
  }

  console.log(`[PRESCRIPTION OCR] ${ocrKeys.length} key(s) available: ${ocrKeys.map(k => k.name).join(", ")}`);

  // Try each key in order — on failure, immediately rotate to the next key
  for (let i = 0; i < ocrKeys.length; i++) {
    const { name, key } = ocrKeys[i];
    const isLastKey = i === ocrKeys.length - 1;

    try {
      console.log(`[PRESCRIPTION OCR] Attempting with ${name} (${i + 1}/${ocrKeys.length})`);
      const ai = new GoogleGenAI({ apiKey: key });
      const response = await ai.models.generateContent({
        // gemini-3.6-flash: confirmed available for this API key tier
        model: "gemini-3.6-flash",
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
      console.log(`[PRESCRIPTION OCR] Success with ${name}. Extracted ${parsed.medicines.length} medicines.`);
      return NextResponse.json(parsed);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isRateLimit = msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota");
      const isBusy      = msg.includes("503") || msg.includes("overloaded");

      if (isLastKey) {
        console.error(`[PRESCRIPTION OCR] All ${ocrKeys.length} key(s) exhausted. Last error:`, msg);
        return NextResponse.json({
          error: "Prescription reading is temporarily busy.\nPlease try again in a moment."
        }, { status: 503 });
      }

      if (isRateLimit || isBusy) {
        console.warn(`[PRESCRIPTION OCR] ${name} rate-limited/busy — rotating to next key.`);
      } else {
        console.warn(`[PRESCRIPTION OCR] ${name} failed (${msg.slice(0, 120)}) — trying next key.`);
      }

      // Small pause before next key
      await delay(300);
    }
  }

  return NextResponse.json({ error: "Prescription reading is temporarily busy.\nPlease try again in a moment." }, { status: 503 });
}
