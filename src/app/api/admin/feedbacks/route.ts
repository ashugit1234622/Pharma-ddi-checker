import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDatabase } from "@/lib/db";

const ADMIN_EMAIL = 'pharmaddichecker.app@gmail.com';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const pool = getDatabase();
    
    const res = await pool.query(
      'SELECT id, user_name, user_tier, category, content, created_at FROM feedbacks ORDER BY created_at DESC'
    );

    return NextResponse.json({ feedbacks: res.rows });
  } catch (error: any) {
    console.error("[Admin Feedback API Error]:", error);
    return NextResponse.json({ error: "Failed to fetch feedbacks" }, { status: 500 });
  }
}
