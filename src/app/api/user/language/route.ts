import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDatabase } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const pool = getDatabase();
    const userRes = await pool.query('SELECT preferred_voice_language FROM users WHERE email = $1', [session.user.email]);
    if (userRes.rows.length === 0) return NextResponse.json({ language: 'en-US' });
    
    return NextResponse.json({ language: userRes.rows[0].preferred_voice_language || 'en-US' });
  } catch (e) {
    console.error('Failed to get voice language:', e);
    return NextResponse.json({ language: 'en-US' }); // Fallback
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const body = await req.json();
    const { language } = body;
    if (!language) {
      return NextResponse.json({ error: 'Language is required' }, { status: 400 });
    }
    
    const pool = getDatabase();
    await pool.query(
      'UPDATE users SET preferred_voice_language = $1 WHERE email = $2',
      [language, session.user.email]
    );
    
    return NextResponse.json({ success: true, language });
  } catch (e) {
    console.error('Failed to update voice language:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
