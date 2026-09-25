import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next"
import { getDatabase } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDatabase();
    
    // Find user ID from email
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(session.user.email) as { id: string } | undefined;
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const records = db.prepare('SELECT * FROM patient_records WHERE user_id = ? ORDER BY created_at DESC').all(user.id);
    
    return NextResponse.json(records);
  } catch (error: any) {
    console.error('History fetch error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { record_type, title, summary, data_json } = body;

    if (!record_type || !title || !data_json) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = getDatabase();
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(session.user.email) as { id: string } | undefined;
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const newRecordId = uuidv4();
    db.prepare(`
      INSERT INTO patient_records (id, user_id, record_type, title, summary, data_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(newRecordId, user.id, record_type, title, summary || '', JSON.stringify(data_json));

    return NextResponse.json({ success: true, id: newRecordId });
  } catch (error: any) {
    console.error('History save error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
