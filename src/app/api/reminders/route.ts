import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next"
import { authOptions } from '@/lib/auth';
import { getDatabase } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pool = getDatabase();
    
    const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [session.user.email]);
    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const user = userRes.rows[0];

    const remindersRes = await pool.query('SELECT * FROM medication_reminders WHERE user_id = $1 ORDER BY created_at DESC', [user.id]);
    
    return NextResponse.json(remindersRes.rows);
  } catch (error: any) {
    console.error('Reminders fetch error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { drug_name, dosage, frequency, times_json, instructions } = body;

    if (!drug_name || !dosage || !frequency || !times_json) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const pool = getDatabase();
    const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [session.user.email]);
    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const user = userRes.rows[0];

    const newReminderId = uuidv4();
    await pool.query(`
      INSERT INTO medication_reminders (id, user_id, drug_name, dosage, frequency, times_json, instructions)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [newReminderId, user.id, drug_name, dosage, frequency, JSON.stringify(times_json), instructions || '']);

    return NextResponse.json({ success: true, id: newReminderId });
  } catch (error: any) {
    console.error('Reminders save error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
