import { NextRequest, NextResponse } from "next/server";
import { getAIProvider, extractJson } from "../../../lib/ai/provider";
import { z } from "zod";

const RequestSchema = z.object({
  drugName: z.string().min(1),
  foodName: z.string().min(1)
});

const SYSTEM_PROMPT = `You are a clinical pharmacology expert specializing in drug-food and drug-supplement interactions.
Analyze the interaction between the provided Medicine and the provided Food/Supplement.
Return a STRICT JSON object (no markdown, no extra text) with the following structure:
{
  "status": boolean, // true if there is an interaction, false if none
  "severity": "minor" | "moderate" | "major" | "contraindicated" | "none" | "unknown",
  "mechanism": "string explaining how the food/supplement affects the drug's ADME or pharmacodynamics",
  "recommendation": "string giving actionable clinical advice (e.g. 'Take 2 hours apart')",
  "confidence": "high" | "moderate" | "low"
}
If no interaction exists, set status to false, severity to "none", and explain that it is safe to consume together in the mechanism and recommendation fields.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = RequestSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ error: "Invalid request. Please provide drugName and foodName." }, { status: 400 });
    }

    const { drugName, foodName } = result.data;
    
    const userPrompt = `Medicine: ${drugName}\nFood/Supplement: ${foodName}`;
    
    const provider = getAIProvider();
    
    // We don't strictly need a massive timeout here because it's a small prompt,
    // but we use the provider.complete which has a built-in 35s timeout and 3 retries anyway!
    const rawResponse = await provider.complete(SYSTEM_PROMPT, userPrompt, false);
    
    const jsonStr = extractJson(rawResponse);
    const parsed = JSON.parse(jsonStr);
    
    return NextResponse.json(parsed);

  } catch (err: any) {
    console.error("[FOOD-CHECK API ERROR]", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
