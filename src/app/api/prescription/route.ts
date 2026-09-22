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

  const apiKey = process.env.GEMINI_API_KEY_SECONDARY;
  if (!apiKey) {
    return NextResponse.json({ error: "Secondary Gemini API key not found. Please set GEMINI_API_KEY_SECONDARY for OCR token separation." }, { status: 500 });
  }

  let lastError = "";
  let retries = 3;
  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

  while (retries > 0) {
    try {
      console.log(`[Prescription] Attempting AI generation... (Retries left: ${retries - 1})`);
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
      console.log(`[Prescription] Extracted ${parsed.medicines.length} medicines successfully.`);
      return NextResponse.json(parsed);
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
      console.error(`[Prescription] OCR API failed:`, lastError);
      
      // Stop retrying on errors like invalid JSON parsing from our own side, 
      // but continue retrying for API errors like 503, 429, etc.
      if (lastError.includes("Could not parse") && !lastError.includes("503") && !lastError.includes("429")) {
        break; 
      }
      
      retries--;
      if (retries > 0) {
        console.log(`[Prescription] Waiting 2 seconds before retrying OCR...`);
        await delay(2000);
      }
    }
  }

  return NextResponse.json({ error: "Failed to analyze the prescription image.", details: lastError }, { status: 500 });
}
