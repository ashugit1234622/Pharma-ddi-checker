import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { getGeminiProvider, extractJson } from "@/lib/ai/provider";
import { DERMA_SYSTEM_PROMPT, buildDermaPrompt } from "@/lib/ai/prompts";
import { DermaChatSchema } from "@/lib/ai/schemas";

function tryGetDatabase() {
  try { return getDatabase(); }
  catch (e: any) { return null; }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { message, history } = body;
  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  let profile = null;
  if (session?.user?.email) {
    const pool = tryGetDatabase();
    if (pool) {
      try {
        const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [session.user.email]);
        if (userRes.rows.length > 0) {
          const userId = userRes.rows[0].id;
          const profileRes = await pool.query('SELECT * FROM patient_profiles WHERE user_id = $1', [userId]);
          if (profileRes.rows.length > 0) {
            const p = profileRes.rows[0];
            profile = {
              age: p.age,
              gender: p.gender,
              underlying_diseases: typeof p.underlying_diseases === 'string' ? JSON.parse(p.underlying_diseases) : p.underlying_diseases,
              current_medications: typeof p.current_medications === 'string' ? JSON.parse(p.current_medications) : p.current_medications,
            };
          }
        }
      } catch (e) {
        console.error("[Derma API] DB Error:", e);
      }
    }
  }

  try {
    const provider = getGeminiProvider();
    const prompt = buildDermaPrompt(history || [], profile, message);
    const rawRes = await provider.complete(DERMA_SYSTEM_PROMPT, prompt, false, req.signal);
    const jsonStr = extractJson(rawRes);
    const parsed = DermaChatSchema.parse(JSON.parse(jsonStr));

    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error("[Derma API] Error:", error);
    return NextResponse.json(
      { error: "Dermatology AI service error.", details: error.message },
      { status: 503 }
    );
  }
}
