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

const SYSTEM_PROMPT = `You are an expert clinical pharmacist AI specialized in reading difficult, messy, and handwritten medical prescriptions.
Your task is to carefully analyze the prescription image and accurately extract all text, especially the names of medicines, dosages, and instructions.
Pay close attention to doctor's handwriting. Guess the most likely medication name if it's partially illegible, based on common drugs.
Return ONLY valid JSON with this exact structure:
{
  "patient": string|null,
  "date": string|null,
  "doctor": string|null,
  "clinic": string|null,
  "medicines": [
    {
      "name": string,
      "genericName": string,
      "dose": string,
      "frequency": string,
      "duration": string,
      "instructions": string
    }
  ],
  "rawInstructions": string|null,
  "confidence": "High"|"Medium"|"Low"
}
Extract ALL medicines listed. If a field is unreadable, leave it empty or null. Always return at least an empty medicines array. Never add markdown.`;

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }

  const { image } = body as { image?: string };
  if (!image || typeof image !== "string" || image.length < 100) {
    return NextResponse.json({ error: "No valid image data provided." }, { status: 400 });
  }

  const keys = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_SECONDARY].filter(Boolean) as string[];
  if (keys.length === 0) {
    return NextResponse.json({ error: "No Gemini API key available." }, { status: 500 });
  }

  let lastError = "";

  for (let i = 0; i < keys.length; i++) {
    const apiKey = keys[i];
    try {
      console.log(`[Prescription] Attempting AI generation with API Key ${i + 1}/${keys.length}...`);
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: [{
          role: "user",
          parts: [
            { inlineData: { mimeType: "image/jpeg", data: image } },
            { text: SYSTEM_PROMPT + "\n\nExtract all prescription data from this image." }
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
      try { parsed = JSON.parse(extractJson(raw)); }
      catch { throw new Error("Could not parse AI response as JSON."); }

      if (!Array.isArray(parsed.medicines)) parsed.medicines = [];
      console.log(`[Prescription] Extracted ${parsed.medicines.length} medicines using API Key ${i + 1}`);
      return NextResponse.json(parsed);
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
      console.error(`[Prescription] API Key ${i + 1} failed:`, lastError);
      
      // Stop retrying on errors like invalid JSON parsing from our own side, 
      // but continue retrying for API errors like 503, 429, etc.
      if (lastError.includes("Could not parse") && !lastError.includes("503") && !lastError.includes("429")) {
        break; 
      }
    }
  }

  return NextResponse.json({ error: "Failed to analyze the prescription image.", details: lastError }, { status: 500 });
}
