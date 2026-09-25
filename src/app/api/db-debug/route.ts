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
    const pool = tryGetDatabase();
    if (pool && !('error' in pool)) {
      const result = await (pool as any).query("SELECT tablename as name FROM pg_catalog.pg_tables WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema'");
      return NextResponse.json({ 
        status: 'connected', 
        tables: result.rows.map((t: any) => t.name),
        database_type: 'postgres'
      });
    } else {
      return NextResponse.json({ status: 'error', details: (pool as any)?.error || 'Unknown' });
    }
  } catch (e: any) {
    return NextResponse.json({ status: 'fatal', error: e.message });
  }
}
