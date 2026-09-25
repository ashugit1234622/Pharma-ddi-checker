import { NextResponse } from 'next/server';

function tryGetDatabase() {
  try {
    const { getDatabase } = require('@/lib/db');
    return getDatabase();
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function GET() {
  try {
    const db = tryGetDatabase();
    if (db && !db.error) {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      return NextResponse.json({ 
        status: 'connected', 
        tables: tables.map((t: any) => t.name),
        db_path: process.env.DATABASE_PATH || './data/pharma.db',
        cwd: process.cwd()
      });
    } else {
      return NextResponse.json({ status: 'error', details: db?.error || 'Unknown' });
    }
  } catch (e: any) {
    return NextResponse.json({ status: 'fatal', error: e.message });
  }
}
