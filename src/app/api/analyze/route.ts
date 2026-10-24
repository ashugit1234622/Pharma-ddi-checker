import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildEvidenceBundle, DrugNotFoundError } from "../../../lib/ddi/evidenceBundle";
import { runDDIAnalysis, AIUnavailableError, AIValidationError } from "../../../lib/ai/analysis";
import { DDIAnalysisSchema } from "../../../lib/ai/schemas";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { enforceRateLimit, RATE_LIMIT_POLICIES, rateLimitResponse, createRateLimitHeaders } from "@/lib/security/rateLimit";

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

  // Rate Limiting (Dual-dimension: User + IP, Burst + Sustained)
  let session = null;
  let userId: string | undefined = undefined;
  let userRole = 'user';
  try {
    session = await getServerSession(authOptions);
    if (session?.user) {
      userId = (session.user as any).id || session.user.email || undefined;
      userRole = (session.user as any).userRole || 'user';
    }
  } catch (e) {
    console.error("Failed to fetch session in analyze route", e);
  }

  const rateLimitResult = await enforceRateLimit(req, {
    category: 'ddi',
    policy: RATE_LIMIT_POLICIES.DDI,
    userId,
  });

  if (!rateLimitResult.allowed) {
    return rateLimitResponse(
      rateLimitResult,
      "Rate limit exceeded for DDI analysis. Please wait a few moments before requesting more analyses."
    );
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

  // 2.5 Check User's Neon DB Patient Records (History Reuse)
  if (session?.user?.email && !forceRefresh) {
    try {
      const pool = getDatabase();
      const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [session.user.email]);
      if (userRes.rows.length > 0) {
        const dbUserId = userRes.rows[0].id;
        
        const d1Name = (bundle.drug1?.generic_name || drug1Id).toLowerCase().trim();
        const d2Name = (bundle.drug2?.generic_name || drug2Id).toLowerCase().trim();
        const d1Id = drug1Id.toLowerCase().trim();
        const d2Id = drug2Id.toLowerCase().trim();

        const historyRes = await pool.query(`
          SELECT id, data_json, created_at, title
          FROM patient_records
          WHERE user_id = $1 AND record_type = 'ddi_check'
          ORDER BY created_at DESC
        `, [dbUserId]);

        for (const row of historyRes.rows) {
          try {
            const parsedData = typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json;
            const meta = parsedData?._meta;

            let isMatch = false;

            // Priority 1: Exact canonical ID match via stored _meta
            if (meta?.drug1Id && meta?.drug2Id) {
              const metaIds = [String(meta.drug1Id).toLowerCase().trim(), String(meta.drug2Id).toLowerCase().trim()].sort();
              const targetIds = [d1Id, d2Id].sort();
              if (metaIds[0] === targetIds[0] && metaIds[1] === targetIds[1]) {
                isMatch = true;
              }
            }

            // Priority 2: Title bidirectional matching
            if (!isMatch && row.title) {
              const lowerTitle = String(row.title).toLowerCase();
              if (
                (lowerTitle.includes(d1Name) && lowerTitle.includes(d2Name)) ||
                (lowerTitle.includes(d1Id) && lowerTitle.includes(d2Id))
              ) {
                isMatch = true;
              }
            }

            if (isMatch) {
              const cleanData = { ...parsedData };
              delete cleanData._meta;
              const validated = DDIAnalysisSchema.parse(cleanData);

              console.log(`[DDI History Hit] Reusing saved report for user ${dbUserId} (${row.title})`);
              return NextResponse.json({
                data: {
                  analysis: validated,
                  evidenceBundle: bundle,
                  meta: {
                    fromCache: true,
                    model: 'user_history',
                    aiAvailable: true,
                    savedAt: row.created_at,
                    recordId: row.id
                  },
                }
              }, {
                headers: createRateLimitHeaders(rateLimitResult),
              });
            }
          } catch {
            // Ignore unparseable historical record safely
          }
        }
      }
    } catch (e) {
      console.warn("Error reading from user patient_records history:", e);
    }
  }

  // 3. Run AI analysis over the bundle.
  try {
    const { analysis, fromCache, model } = await runDDIAnalysis(drug1Id, drug2Id, bundle, {
      forceRefresh,
      signal: req.signal,
      userProfile,
      userRole: userRole as any
    });

    return NextResponse.json({
      data: {
        analysis,
        evidenceBundle: bundle,
        meta: { fromCache, model, aiAvailable: true },
      }
    }, {
      headers: createRateLimitHeaders(rateLimitResult),
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
