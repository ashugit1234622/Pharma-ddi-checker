import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildEvidenceBundle, DrugNotFoundError } from "../../../lib/ddi/evidenceBundle";
import { runDDIAnalysis, AIUnavailableError, AIValidationError } from "../../../lib/ai/analysis";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDatabase } from "@/lib/db";

const RequestSchema = z.object({
  drug1Id: z.string().min(1),
  drug2Id: z.string().min(1),
  forceRefresh: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", detail: parsed.error.issues },
      { status: 400 }
    );
  }

  const { drug1Id, drug2Id, forceRefresh } = parsed.data;

  if (drug1Id === drug2Id) {
    return NextResponse.json({ error: "Select two different drugs." }, { status: 400 });
  }

  // 1. Build the deterministic evidence bundle (DB + rule engine).
  let bundle;
  try {
    bundle = await buildEvidenceBundle(drug1Id, drug2Id);
  } catch (err) {
    if (err instanceof DrugNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Could not load drug data.", detail: err instanceof Error ? err.message : String(err) },
      { status: 503 }
    );
  }

  // 2. Fetch User Profile
  let userProfile = null;
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.email) {
      const pool = getDatabase();
      const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [session.user.email]);
      if (userRes.rows.length > 0) {
        const userId = userRes.rows[0].id;
        const profileRes = await pool.query('SELECT * FROM patient_profiles WHERE user_id = $1', [userId]);
        if (profileRes.rows.length > 0) {
          const profile = profileRes.rows[0];
          userProfile = {
            ...profile,
            underlying_diseases: JSON.parse(profile.underlying_diseases || '[]'),
            allergies: JSON.parse(profile.allergies || '[]'),
            current_medications: JSON.parse(profile.current_medications || '[]'),
          };
        }
      }
    }
  } catch (e) {
    console.error("Failed to fetch user profile for AI analysis", e);
  }

  // 3. Run AI analysis over the bundle.
  try {
    const { analysis, fromCache, model } = await runDDIAnalysis(drug1Id, drug2Id, bundle, {
      forceRefresh,
      signal: req.signal,
      userProfile
    });

    return NextResponse.json({
      data: {
        analysis,
        evidenceBundle: bundle,
        meta: { fromCache, model, aiAvailable: true },
      }
    });
  } catch (err) {
    const aiError =
      err instanceof AIUnavailableError || err instanceof AIValidationError
        ? err.message
        : "The AI analysis service could not be reached.";

    return NextResponse.json(
      {
        data: {
          analysis: null,
          evidenceBundle: bundle,
          meta: { fromCache: false, model: null, aiAvailable: false },
          aiError,
        }
      },
      { status: 200 }
    );
  }
}
