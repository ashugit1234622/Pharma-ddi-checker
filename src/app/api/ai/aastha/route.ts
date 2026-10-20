import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getGeminiProvider, extractJson } from "@/lib/ai/provider";
import { buildAasthaPrompt } from "@/lib/ai/prompts";
import { AasthaResponseSchema } from "@/lib/ai/schemas";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { enforceRateLimit, RATE_LIMIT_POLICIES, rateLimitResponse, createRateLimitHeaders } from "@/lib/security/rateLimit";

const AasthaRequestSchema = z.object({
  message: z.string().min(1),
  conversationHistory: z.array(z.object({
    role: z.string(),
    content: z.string()
  })),
  drugContext: z.object({
    drug1: z.string(),
    drug2: z.string()
  }).nullable().optional(),
  reportContext: z.record(z.string(), z.unknown()).nullable().optional(),
  userProfile: z.record(z.string(), z.unknown()).nullable().optional()
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = AasthaRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", detail: parsed.error.issues },
      { status: 400 }
    );
  }

  const { message, conversationHistory, drugContext, reportContext, userProfile } = parsed.data;

  if (message.length > 1000) {
    return NextResponse.json({ error: "Message exceeds maximum allowable length of 1000 characters." }, { status: 400 });
  }

  let userRole = 'user';
  let userId: string | undefined = undefined;
  try {
    const session = await getServerSession(authOptions);
    if (session?.user) {
      userRole = (session.user as any).userRole || 'user';
      userId = (session.user as any).id || session.user.email || undefined;
    }
  } catch (e) {}

  const rateLimitResult = await enforceRateLimit(req, {
    category: 'aastha',
    policy: RATE_LIMIT_POLICIES.AI_CHAT,
    userId,
  });

  if (!rateLimitResult.allowed) {
    return rateLimitResponse(
      rateLimitResult,
      "Rate limit exceeded. Please wait a few moments before sending more messages."
    );
  }

  let rawResponse: string | null = null;
  try {
    const provider = getGeminiProvider();

    // Build the constrained prompt based on current context
    const prompt = buildAasthaPrompt(
      conversationHistory,
      drugContext || null,
      reportContext || null,
      message,
      userProfile || null,
      userRole as any
    );

    // Call the provider
    rawResponse = await provider.complete(
      "You are Aastha, an AI assistant for Pharma DDI Checker. Output structured JSON only.",
      prompt
    );

    // Parse JSON then validate schema
    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJson(rawResponse));
    } catch {
      console.error("[AASTHA] JSON parse failed. Raw response:", rawResponse?.slice(0, 500));
      throw new Error("AI returned non-JSON response.");
    }

    const parsedAiResponse = AasthaResponseSchema.parse(parsed);
    return NextResponse.json({ data: parsedAiResponse }, {
      headers: createRateLimitHeaders(rateLimitResult),
    });

  } catch (err) {
    console.error("[AASTHA API Error]:", err instanceof Error ? err.message : err);
    if (rawResponse) console.error("[AASTHA] Raw AI response was:", rawResponse.slice(0, 500));
    return NextResponse.json(
      { error: "I couldn't generate a response right now. Please try again." },
      { status: 500 }
    );
  }
}
