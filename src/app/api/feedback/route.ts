import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { category, content } = body;

    if (!category || !content) {
      return NextResponse.json({ error: "Category and content are required." }, { status: 400 });
    }

    const pool = getDatabase();
    
    // Get user details to populate feedback
    const userRes = await pool.query('SELECT id, name FROM users WHERE email = $1', [session.user.email]);
    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    const userId = userRes.rows[0].id;
    const userName = userRes.rows[0].name || session.user.name || 'Anonymous';
    
    // Check if user is PRO (pharmacist/doctor) or NORMAL (user) based on patient_profiles user_role
    let userTier = 'NORMAL';
    const profileRes = await pool.query('SELECT user_role FROM patient_profiles WHERE user_id = $1', [userId]);
    if (profileRes.rows.length > 0) {
      const role = profileRes.rows[0].user_role;
      if (role === 'pharmacist' || role === 'doctor' || role === 'professional') {
        userTier = 'PRO';
      }
    }

    const feedbackId = uuidv4();
    
    await pool.query(
      `INSERT INTO feedbacks (id, user_id, user_name, user_tier, category, content) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [feedbackId, userId, userName, userTier, category, content]
    );

    return NextResponse.json({ success: true, feedbackId });
  } catch (error: any) {
    console.error("[Feedback API Error]:", error);
    return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
  }
}
