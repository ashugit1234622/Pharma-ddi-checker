import { NextRequest, NextResponse } from "next/server";
import { getGeminiProvider, extractJson } from "../../../lib/ai/provider";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { enforceRateLimit, RATE_LIMIT_POLICIES, rateLimitResponse, createRateLimitHeaders } from "@/lib/security/rateLimit";

const RequestSchema = z.object({
  drugName: z.string().min(1).max(100),
  foodName: z.string().min(1).max(100)
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
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const result = RequestSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid request. Please provide drugName and foodName." }, { status: 400 });
    }

    let userId: string | undefined = undefined;
    try {
      const session = await getServerSession(authOptions);
      if (session?.user) {
        userId = (session.user as any).id || session.user.email || undefined;
      }
    } catch (_) {}

    const rateLimitResult = await enforceRateLimit(req, {
      category: 'foodcheck',
      policy: RATE_LIMIT_POLICIES.AI_PUBLIC,
      userId,
    });

    if (!rateLimitResult.allowed) {
      return rateLimitResponse(
        rateLimitResult,
        "Rate limit exceeded for food-drug interaction check. Please wait a few moments before trying again."
      );
    }

    const { drugName, foodName } = result.data;
    const userPrompt = `Medicine: ${drugName}\nFood/Supplement: ${foodName}`;
    const provider = getGeminiProvider();
    
    const rawResponse = await provider.complete(SYSTEM_PROMPT, userPrompt, false);
    const jsonStr = extractJson(rawResponse);
    const parsed = JSON.parse(jsonStr);
    
    return NextResponse.json(parsed, {
      headers: createRateLimitHeaders(rateLimitResult),
    });

  } catch (err: any) {
    console.error("[FOOD-CHECK API ERROR]", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
