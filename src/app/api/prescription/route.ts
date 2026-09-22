import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { extractJson } from "../../../lib/ai/provider";

export interface PrescribedMedicine {
  name: string;
  genericName?: string;
  dose?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
}

export interface PrescriptionResult {
  patient?: string;
  date?: string;
  doctor?: string;
  clinic?: string;
  medicines: PrescribedMedicine[];
  rawInstructions?: string;
  confidence: "High" | "Medium" | "Low";
  error?: string;
}

const SYSTEM_PROMPT = `You are a clinical pharmacist AI specialized in reading handwritten and printed medical prescriptions. Return ONLY valid JSON with this structure: { "patient": string|null, "date": string|null, "doctor": string|null, "clinic": string|null, "medicines": [{ "name": string, "genericName": string, "dose": string, "frequency": string, "duration": string, "instructions": string }], "rawInstructions": string|null, "confidence": "High"|"Medium"|"Low" }. Extract ALL medicines listed. Always return at least an empty medicines array. Never add markdown.`;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_SECONDARY;
  if (!apiKey) throw new Error("No Gemini API key available.");
  return new GoogleGenAI({ apiKey });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }

  const { image } = body as { image?: string };
  if (!image || typeof image !== "string" || image.length < 100) {
    return NextResponse.json({ error: "No valid image data provided." }, { status: 400 });
  }

  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{
        role: "user",
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: image } },
          { text: SYSTEM_PROMPT + "\n\nExtract all prescription data from this image." }
        ]
      }],
      config: { temperature: 0 }
    });

    const raw = response.text || "";
    if (!raw) return NextResponse.json({ error: "AI returned no content." }, { status: 500 });

    let parsed: PrescriptionResult;
    try { parsed = JSON.parse(extractJson(raw)); }
    catch { return NextResponse.json({ error: "Could not parse AI response as JSON." }, { status: 500 }); }

    if (!Array.isArray(parsed.medicines)) parsed.medicines = [];
    console.log(`[Prescription] Extracted ${parsed.medicines.length} medicines`);
    return NextResponse.json(parsed);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Prescription] Error:", msg);
    return NextResponse.json({ error: "Failed to analyze the prescription image. Please try a clearer photo." }, { status: 500 });
  }
}
