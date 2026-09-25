import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

function tryGetDatabase() {
  try {
    const { getDatabase } = require('@/lib/db');
    return getDatabase();
  } catch (e) {
    return null;
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const db = tryGetDatabase();
    if (!db) return NextResponse.json({ profile: null });
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(session.user.email) as any;
    if (!user) return NextResponse.json({ profile: null });
    const profile = db.prepare('SELECT * FROM patient_profiles WHERE user_id = ?').get(user.id) as any;
    if (!profile) return NextResponse.json({ profile: null });
    return NextResponse.json({
      profile: {
        ...profile,
        underlying_diseases: JSON.parse(profile.underlying_diseases || '[]'),
        allergies: JSON.parse(profile.allergies || '[]'),
        current_medications: JSON.parse(profile.current_medications || '[]'),
      }
    });
  } catch (e) {
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Step 1: Verify session
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized: no session', step: 'auth' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      display_name, age, gender, blood_group,
      underlying_diseases, allergies, current_medications,
      medical_history, emergency_contact
    } = body;

    // Step 2: Get DB
    const db = tryGetDatabase();
    if (!db) {
      return NextResponse.json({ 
        error: 'Database unavailable on this server. Native module (better-sqlite3) failed to load.',
        step: 'db_init'
      }, { status: 503 });
    }

    // Step 3: Upsert user
    let user = db.prepare('SELECT id FROM users WHERE email = ?').get(session.user.email) as any;
    if (!user) {
      const newId = uuidv4();
      db.prepare(`INSERT INTO users (id, name, email, image) VALUES (?, ?, ?, ?)`)
        .run(newId, session.user.name || '', session.user.email, (session.user as any).image || '');
      user = { id: newId };
    }

    // Step 4: Upsert profile
    const existing = db.prepare('SELECT id FROM patient_profiles WHERE user_id = ?').get(user.id) as any;
    const profileId = existing?.id || uuidv4();

    if (existing) {
      db.prepare(`
        UPDATE patient_profiles SET
          display_name=?, age=?, gender=?, blood_group=?,
          underlying_diseases=?, allergies=?, current_medications=?,
          medical_history=?, emergency_contact=?, updated_at=datetime('now')
        WHERE user_id=?
      `).run(
        display_name || null, age ? parseInt(age) : null, gender || null, blood_group || null,
        JSON.stringify(underlying_diseases || []), JSON.stringify(allergies || []),
        JSON.stringify(current_medications || []), medical_history || null,
        emergency_contact || null, user.id
      );
    } else {
      db.prepare(`
        INSERT INTO patient_profiles 
          (id, user_id, display_name, age, gender, blood_group,
           underlying_diseases, allergies, current_medications, medical_history, emergency_contact)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        profileId, user.id, display_name || null, age ? parseInt(age) : null,
        gender || null, blood_group || null,
        JSON.stringify(underlying_diseases || []), JSON.stringify(allergies || []),
        JSON.stringify(current_medications || []), medical_history || null,
        emergency_contact || null
      );
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[Profile API] Error:', e.message, e.stack);
    return NextResponse.json({ error: e.message, step: 'db_write' }, { status: 500 });
  }
}

