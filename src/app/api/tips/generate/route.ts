import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAIProvider, extractJson } from '@/lib/ai/provider';
import { TIPS_SYSTEM_PROMPT, buildTipsGenerationPrompt } from '@/lib/ai/prompts';
import { TipsGenerationSchema } from '@/lib/ai/schemas';
import { getDatabase } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

function tryGetDatabase() {
  try {
    return getDatabase();
  } catch (e: any) {
    console.error('[Tips Generate] Database initialization failed:', e.message);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const pool = tryGetDatabase();
    if (!pool) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    // Get user ID
    const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [session.user.email]);
    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const userId = userRes.rows[0].id;

    // Get patient profile
    const profileRes = await pool.query('SELECT * FROM patient_profiles WHERE user_id = $1', [userId]);
    if (profileRes.rows.length === 0) {
      return NextResponse.json({ error: 'No profile found. Complete onboarding first.' }, { status: 400 });
    }
    const profile = profileRes.rows[0];

    const profileData = {
      age: profile.age,
      gender: profile.gender,
      blood_group: profile.blood_group,
      underlying_diseases: JSON.parse(profile.underlying_diseases || '[]'),
      allergies: JSON.parse(profile.allergies || '[]'),
      current_medications: JSON.parse(profile.current_medications || '[]'),
    };

    // Check if tips already exist for this user — if so, delete old ones before regenerating
    await pool.query('DELETE FROM user_tips WHERE user_id = $1', [userId]);

    // Generate tips using the multi-API fallback provider
    console.log('[Tips Generate] Generating personalized tips for user:', userId);
    const ai = getAIProvider();
    const userPrompt = buildTipsGenerationPrompt(profileData);
    const rawResponse = await ai.complete(TIPS_SYSTEM_PROMPT, userPrompt);
    const cleanJson = extractJson(rawResponse);
    const parsed = TipsGenerationSchema.parse(JSON.parse(cleanJson));

    // Insert all tips into the database
    const tipRows: { id: string; type: string; title: string; content: string; category: string; priority: number }[] = [];

    for (const tip of parsed.randomTips) {
      tipRows.push({ id: uuidv4(), type: 'random_tip', title: tip.title, content: tip.content, category: tip.category || 'general', priority: tip.priority || 1 });
    }
    for (const tip of parsed.dietPlan) {
      tipRows.push({ id: uuidv4(), type: 'diet_plan', title: tip.title, content: tip.content, category: tip.category || 'nutrition', priority: tip.priority || 2 });
    }
    for (const tip of parsed.dietRestrictions) {
      tipRows.push({ id: uuidv4(), type: 'diet_restriction', title: tip.title, content: tip.content, category: tip.category || 'safety', priority: tip.priority || 3 });
    }
    for (const tip of parsed.medicalTips) {
      tipRows.push({ id: uuidv4(), type: 'medical_tip', title: tip.title, content: tip.content, category: tip.category || 'medication', priority: tip.priority || 2 });
    }

    // Batch insert
    for (const row of tipRows) {
      await pool.query(
        `INSERT INTO user_tips (id, user_id, tip_type, title, content, category, priority) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [row.id, userId, row.type, row.title, row.content, row.category, row.priority]
      );
    }

    console.log(`[Tips Generate] Inserted ${tipRows.length} tips for user ${userId}`);

    return NextResponse.json({
      success: true,
      count: tipRows.length,
      summary: {
        randomTips: parsed.randomTips.length,
        dietPlan: parsed.dietPlan.length,
        dietRestrictions: parsed.dietRestrictions.length,
        medicalTips: parsed.medicalTips.length,
      },
    });
  } catch (e: any) {
    console.error('[Tips Generate] Error:', e.message, e.stack);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
