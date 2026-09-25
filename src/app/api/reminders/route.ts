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

    const db = getDatabase();
    
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(session.user.email) as { id: string } | undefined;
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const reminders = db.prepare('SELECT * FROM medication_reminders WHERE user_id = ? ORDER BY created_at DESC').all(user.id);
    
    return NextResponse.json(reminders);
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

    const db = getDatabase();
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(session.user.email) as { id: string } | undefined;
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const newReminderId = uuidv4();
    db.prepare(`
      INSERT INTO medication_reminders (id, user_id, drug_name, dosage, frequency, times_json, instructions)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(newReminderId, user.id, drug_name, dosage, frequency, JSON.stringify(times_json), instructions || '');

    return NextResponse.json({ success: true, id: newReminderId });
  } catch (error: any) {
    console.error('Reminders save error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
