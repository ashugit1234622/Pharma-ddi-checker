import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '@/lib/db';

function tryGetDatabase() {
  try {
    return getDatabase();
  } catch (e: any) {
    console.error('[Profile API] Database initialization failed:', e.message);
    return null;
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const pool = tryGetDatabase();
    if (!pool) return NextResponse.json({ profile: null });
    const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [session.user.email]);
    if (userRes.rows.length === 0) return NextResponse.json({ profile: null });
    const user = userRes.rows[0];
    
    const profileRes = await pool.query('SELECT * FROM patient_profiles WHERE user_id = $1', [user.id]);
    if (profileRes.rows.length === 0) return NextResponse.json({ profile: null });
    const profile = profileRes.rows[0];
    
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
    const pool = tryGetDatabase();
    if (!pool) {
      return NextResponse.json({ 
        error: 'Database unavailable on this server.',
        step: 'db_init'
      }, { status: 503 });
    }

    // Step 3: Upsert user
    const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [session.user.email]);
    let user = userRes.rows[0];
    if (!user) {
      const newId = uuidv4();
      await pool.query(
        `INSERT INTO users (id, name, email, image) VALUES ($1, $2, $3, $4)`,
        [newId, session.user.name || '', session.user.email, (session.user as any).image || '']
      );
      user = { id: newId };
    }

    // Step 4: Upsert profile
    const existingRes = await pool.query('SELECT id FROM patient_profiles WHERE user_id = $1', [user.id]);
    const existing = existingRes.rows[0];
    const profileId = existing?.id || uuidv4();

    if (existing) {
      await pool.query(`
        UPDATE patient_profiles SET
          display_name=$1, age=$2, gender=$3, blood_group=$4,
          underlying_diseases=$5, allergies=$6, current_medications=$7,
          medical_history=$8, emergency_contact=$9, updated_at=CURRENT_TIMESTAMP
        WHERE user_id=$10
      `, [
        display_name || null, age ? parseInt(age) : null, gender || null, blood_group || null,
        JSON.stringify(underlying_diseases || []), JSON.stringify(allergies || []),
        JSON.stringify(current_medications || []), medical_history || null,
        emergency_contact || null, user.id
      ]);
    } else {
      await pool.query(`
        INSERT INTO patient_profiles 
          (id, user_id, display_name, age, gender, blood_group,
           underlying_diseases, allergies, current_medications, medical_history, emergency_contact)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        profileId, user.id, display_name || null, age ? parseInt(age) : null,
        gender || null, blood_group || null,
        JSON.stringify(underlying_diseases || []), JSON.stringify(allergies || []),
        JSON.stringify(current_medications || []), medical_history || null,
        emergency_contact || null
      ]);
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[Profile API] Error:', e.message, e.stack);
    return NextResponse.json({ error: e.message, step: 'db_write' }, { status: 500 });
  }
}

