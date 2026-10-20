import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildEvidenceBundle, DrugNotFoundError } from "../../../lib/ddi/evidenceBundle";
import { getAIProvider, extractJson } from "../../../lib/ai/provider";
import { ASK_SYSTEM_PROMPT } from "../../../lib/ai/prompts";
import { getRoleInstruction, UserRole } from "../../../lib/ai/roleContext";
import { ConstrainedAnswerSchema } from "../../../lib/ai/schemas";
import { findSharedCypSignal } from "../../../lib/ddi/ruleEngine";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { enforceRateLimit, RATE_LIMIT_POLICIES, rateLimitResponse, createRateLimitHeaders } from "@/lib/security/rateLimit";

const RequestSchema = z.object({
  drug1Id: z.string().min(1),
  drug2Id: z.string().min(1),
  question: z.string().min(1).max(500),
});

const FALLBACK_ANSWER =
  "The available evidence in this analysis does not establish an answer to that question.";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized. Please sign in to use this service." }, { status: 401 });
  }

  const userId = (session.user as any)?.id || session.user.email || undefined;
  const rateLimitResult = await enforceRateLimit(req, {
    category: 'ask',
    policy: RATE_LIMIT_POLICIES.AI_CHAT,
    userId,
  });

  if (!rateLimitResult.allowed) {
    return rateLimitResponse(
      rateLimitResult,
      "Rate limit exceeded. Please wait a few moments before asking more questions."
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { drug1Id, drug2Id, question } = parsed.data;

  let bundle;
  try {
    bundle = await buildEvidenceBundle(drug1Id, drug2Id);
  } catch (err) {
    if (err instanceof DrugNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Could not load drug data." }, { status: 503 });
  }

  const userRole: UserRole = (session.user as any)?.userRole || 'user';

  try {
    const provider = getAIProvider();
    const cypSignals = findSharedCypSignal(bundle.drug1, bundle.drug2);
    const sanitizedQuestion = `<user_question>\n${question.replace(/<\/?user_question>/gi, '')}\n</user_question>`;
    const userPrompt = JSON.stringify(
      { question: sanitizedQuestion, evidenceBundle: bundle, cypSignals },
      null,
      2
    );
    const systemPrompt = ASK_SYSTEM_PROMPT + '\n\n' + getRoleInstruction(userRole);

    const raw = await provider.complete(systemPrompt, userPrompt);
    const parsedAnswer = ConstrainedAnswerSchema.safeParse(JSON.parse(extractJson(raw)));

    if (!parsedAnswer.success) {
      return NextResponse.json({ answerable: false, answer: FALLBACK_ANSWER, sourceIds: [] });
    }

    return NextResponse.json(parsedAnswer.data, {
      headers: createRateLimitHeaders(rateLimitResult),
    });
  } catch (err) {
    return NextResponse.json(
      { answerable: false, answer: "The AI service is currently unavailable. Please try again.", sourceIds: [] },
      { status: 200 }
    );
  }
}
