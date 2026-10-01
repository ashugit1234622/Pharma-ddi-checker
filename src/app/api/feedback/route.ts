import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';

const ADMIN_EMAIL = 'pharmaddichecker.app@gmail.com';

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

    // Send Email Notification
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER || ADMIN_EMAIL,
          pass: process.env.EMAIL_PASS
        }
      });

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #4f46e5; padding: 20px; text-align: center;">
            <h2 style="color: white; margin: 0;">New App Feedback</h2>
          </div>
          <div style="padding: 20px; background-color: #ffffff;">
            <p style="margin: 0 0 10px 0; color: #64748b; font-size: 14px;"><strong>Category:</strong> <span style="color: #0f172a;">${category}</span></p>
            <p style="margin: 0 0 10px 0; color: #64748b; font-size: 14px;"><strong>User:</strong> <span style="color: #0f172a;">${userName}</span></p>
            <p style="margin: 0 0 20px 0; color: #64748b; font-size: 14px;"><strong>Account Type:</strong> <span style="background-color: ${userTier === 'PRO' ? '#f59e0b' : '#3b82f6'}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">${userTier}</span></p>
            
            <h3 style="color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-top: 0;">Feedback Content</h3>
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; color: #334155; line-height: 1.6; white-space: pre-wrap;">${content}</div>
          </div>
          <div style="background-color: #f1f5f9; padding: 15px; text-align: center; color: #94a3b8; font-size: 12px;">
            Pharma DDI Checker Automated System
          </div>
        </div>
      `;

      if (process.env.EMAIL_PASS) {
        await transporter.sendMail({
          from: process.env.EMAIL_USER || ADMIN_EMAIL,
          to: ADMIN_EMAIL,
          subject: `[Farma Feedback] ${category} from ${userName} (${userTier})`,
          html: htmlContent
        });
      } else {
        console.warn("[Feedback] EMAIL_PASS not set in environment variables. Email not sent.");
      }
    } catch (emailError) {
      console.error("[Feedback] Failed to send email:", emailError);
      // We don't fail the request if email fails, since DB insert succeeded
    }

    return NextResponse.json({ success: true, feedbackId });
  } catch (error: any) {
    console.error("[Feedback API Error]:", error);
    return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
  }
}
