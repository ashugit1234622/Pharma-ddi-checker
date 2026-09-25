import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';

function tryGetDatabase() {
  try {
    return getDatabase();
  } catch (e: any) {
    console.error('[DB-Debug API] Database initialization failed:', e.message);
    return { error: e.message };
  }
}

export async function GET() {
  try {
    const db = tryGetDatabase();
    if (db && !('error' in db)) {
      const tables = (db as any).prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      return NextResponse.json({ 
        status: 'connected', 
        tables: tables.map((t: any) => t.name),
        db_path: process.env.DATABASE_PATH || './data/pharma.db',
        cwd: process.cwd()
      });
    } else {
      return NextResponse.json({ status: 'error', details: (db as any)?.error || 'Unknown' });
    }
  } catch (e: any) {
    return NextResponse.json({ status: 'fatal', error: e.message });
  }
}
