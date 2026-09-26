import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDatabase } from '@/lib/db';

function tryGetDatabase() {
  try {
    return getDatabase();
  } catch (e: any) {
    console.error('[Tips API] Database initialization failed:', e.message);
    return null;
  }
}

export async function GET(req: NextRequest) {
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
      return NextResponse.json({ tips: null });
    }
    const userId = userRes.rows[0].id;

    // Optional: filter by type from query param
    const { searchParams } = new URL(req.url);
    const tipType = searchParams.get('type');

    let query: string;
    let params: any[];

    if (tipType) {
      query = 'SELECT * FROM user_tips WHERE user_id = $1 AND tip_type = $2 ORDER BY priority DESC, created_at DESC';
      params = [userId, tipType];
    } else {
      query = 'SELECT * FROM user_tips WHERE user_id = $1 ORDER BY tip_type, priority DESC, created_at DESC';
      params = [userId];
    }

    const result = await pool.query(query, params);

    // Group by type
    const grouped: Record<string, any[]> = {
      random_tip: [],
      diet_plan: [],
      diet_restriction: [],
      medical_tip: [],
    };

    for (const row of result.rows) {
      if (grouped[row.tip_type]) {
        grouped[row.tip_type].push({
          id: row.id,
          title: row.title,
          content: row.content,
          category: row.category,
          priority: row.priority,
        });
      }
    }

    return NextResponse.json({
      tips: grouped,
      count: result.rows.length,
    });
  } catch (e: any) {
    console.error('[Tips API] Error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
