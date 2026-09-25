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
    
    // Find user ID from email
    const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [session.user.email]);
    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const user = userRes.rows[0];

    const recordsRes = await pool.query('SELECT * FROM patient_records WHERE user_id = $1 ORDER BY created_at DESC', [user.id]);
    
    return NextResponse.json(recordsRes.rows);
  } catch (error: any) {
    console.error('History fetch error:', error);
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
    const { record_type, title, summary, data_json } = body;

    if (!record_type || !title || !data_json) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const pool = getDatabase();
    const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [session.user.email]);
    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const user = userRes.rows[0];

    const newRecordId = uuidv4();
    await pool.query(`
      INSERT INTO patient_records (id, user_id, record_type, title, summary, data_json)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [newRecordId, user.id, record_type, title, summary || '', JSON.stringify(data_json)]);

    return NextResponse.json({ success: true, id: newRecordId });
  } catch (error: any) {
    console.error('History save error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing record id' }, { status: 400 });
    }

    const pool = getDatabase();
    const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [session.user.email]);
    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const user = userRes.rows[0];

    const result = await pool.query('DELETE FROM patient_records WHERE id = $1 AND user_id = $2', [id, user.id]);
    
    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Record not found or not authorized' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('History delete error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
