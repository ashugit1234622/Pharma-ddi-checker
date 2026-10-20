import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getGeminiProvider } from '@/lib/ai/provider';
import { enforceRateLimit, RATE_LIMIT_POLICIES, rateLimitResponse, createRateLimitHeaders } from "@/lib/security/rateLimit";

function extractCleanInsight(raw: unknown): string {
  if (!raw) return '';
  if (typeof raw !== 'string') {
    if (Array.isArray(raw)) {
      return extractCleanInsight(raw[0]);
    }
    if (typeof raw === 'object' && raw !== null) {
      const obj = raw as Record<string, any>;
      return extractCleanInsight(obj.insight || obj.text || obj.tip || obj.message || obj.response || Object.values(obj)[0]);
    }
    return String(raw);
  }

  let text = raw.trim();
  // Strip markdown code fences if present
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // If text looks like a JSON array or object, parse and extract inner insight
  if (text.startsWith('[') || text.startsWith('{')) {
    try {
      let parsed = JSON.parse(text);
      while (Array.isArray(parsed) && parsed.length > 0) {
        parsed = parsed[0];
      }
      if (typeof parsed === 'string') {
        return extractCleanInsight(parsed);
      }
      if (parsed && typeof parsed === 'object') {
        const candidate = parsed.insight || parsed.text || parsed.tip || parsed.message || parsed.response;
        if (typeof candidate === 'string') {
          return extractCleanInsight(candidate);
        }
        for (const v of Object.values(parsed)) {
          if (typeof v === 'string' && v.length > 10) return extractCleanInsight(v);
        }
      }
    } catch {
      // Regex fallback if JSON was slightly malformed
      const match = text.match(/"insight"\s*:\s*"([^"]+)"/i);
      if (match && match[1]) {
        return match[1].replace(/\\"/g, '"');
      }
    }
  }

  // Remove any remaining outer bracket/brace artifacts
  return text.replace(/^[\[{\s"]+|[\]}\s"]+$/g, '').trim();
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any)?.id || session.user.email;
  const rateLimitResult = await enforceRateLimit(req, {
    category: 'cycle_analyze',
    policy: RATE_LIMIT_POLICIES.AI_EXPENSIVE,
    userId,
  });

  if (!rateLimitResult.allowed) {
    return rateLimitResponse(
      rateLimitResult,
      'Rate limit exceeded for menstrual cycle AI analysis. Please wait a few moments before trying again.'
    );
  }

  try {
    const { profile, prediction } = await req.json();

    if (!profile || !prediction) {
      return NextResponse.json({ error: 'Missing profile or prediction data' }, { status: 400 });
    }

    const today = new Date();
    // Find current phase
    let currentPhase = prediction.phases.find((p: any) => {
      const start = new Date(p.startDate);
      const end = new Date(p.endDate);
      return today >= start && today <= end;
    });

    if (!currentPhase) {
      currentPhase = prediction.phases[3]; // Fallback to Luteal
    }

    const prompt = `
      You are an expert AI gynecologist and women's health specialist.
      The user is currently in the ${currentPhase.name} of her menstrual cycle.
      
      User Profile context:
      - Age: ${profile.age || 'Unknown'}
      - Medical Conditions: ${JSON.stringify(profile.underlying_diseases || [])}
      - Current Medications: ${JSON.stringify(profile.current_medications || [])}
      - Cycle Type: ${profile.menstruation_details?.cycle_length_type === 'pcod' ? 'PCOD/PCOS/Hormonal issue' : (profile.menstruation_details?.cycle_length_type || '28 days')}
      - Custom Cycle Length: ${profile.menstruation_details?.custom_cycle_length || 'N/A'}
      
      Provide a highly personalized 2-sentence insight or health tip for today.
      If she has specific conditions like PCOS or thyroid issues, or is taking specific meds (like birth control or iron supplements), explicitly mention how her phase interacts with them and her cycle length.
      Include a specific dietary or lifestyle tip for this specific phase.
      Keep it encouraging, medically safe, and very concise.
      IMPORTANT: Return ONLY plain text sentences. Do NOT return JSON, do NOT return arrays, and do NOT wrap in brackets.
    `;

    try {
      const ai = getGeminiProvider();
      const response = await ai.complete("You are a medical AI assistant providing clear text advice without JSON formatting.", prompt);
      
      const insightText = extractCleanInsight(response);
      return NextResponse.json({ insight: insightText || "Stay hydrated and listen to your body today!" });
    } catch (aiError: any) {
      console.error('[Cycle AI] Gemini API Error:', aiError.message);
      
      // Fallback insights based on phase if AI fails
      let fallback = "Stay hydrated and listen to your body today!";
      if (currentPhase.name === "Menstruation") {
        fallback = "Make sure to rest and eat iron-rich foods to help replenish your body during this phase.";
      } else if (currentPhase.name === "Follicular Phase") {
        fallback = "Your energy levels are rising! This is a great time to tackle complex tasks or higher-intensity workouts.";
      } else if (currentPhase.name === "Fertile Window" || currentPhase.name === "Ovulation Window") {
        fallback = "Your estrogen peaks during this window. You might feel highly energetic and sociable.";
      } else if (currentPhase.name === "Luteal Phase") {
        fallback = "As progesterone rises, you may feel tired. Prioritize sleep and gentle stretching like yoga.";
      }

      return NextResponse.json({ insight: fallback });
    }
  } catch (e: any) {
    console.error('[Cycle AI] Server Error:', e.message);
    return NextResponse.json({ insight: "Remember to stay hydrated and listen to your body today." });
  }
}
