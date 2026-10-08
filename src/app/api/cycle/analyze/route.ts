import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getGeminiProvider } from '@/lib/ai/provider';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    `;

    try {
      const ai = getGeminiProvider();
      const response = await ai.complete("You are a medical AI assistant.", prompt);
      
      const raw = response.trim();

      // The router uses responseMimeType: "application/json" by default, so the model
      // may return a JSON object. Extract just the insight string if that happens.
      let insightText = raw;
      try {
        // Strip markdown fences if present
        const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
        const parsed = JSON.parse(stripped);
        // Support {"insight":"..."} or {"phase":"...","insight":"..."} shapes
        if (parsed && typeof parsed.insight === 'string') {
          insightText = parsed.insight;
        } else if (parsed && typeof parsed.text === 'string') {
          insightText = parsed.text;
        }
      } catch {
        // Not JSON — already a plain text string, use as-is
      }

      return NextResponse.json({ insight: insightText });
    } catch (aiError: any) {
      console.error('[Cycle AI] Gemini API Error:', aiError.message);
      
      // Fallback insights based on phase if AI fails
      let fallback = "Stay hydrated and listen to your body today!";
      if (currentPhase.name === "Menstruation") {
        fallback = "Make sure to rest and eat iron-rich foods to help replenish your body during this phase.";
      } else if (currentPhase.name === "Follicular Phase") {
        fallback = "Your energy levels are rising! This is a great time to tackle complex tasks or higher-intensity workouts.";
      } else if (currentPhase.name === "Fertile Window") {
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
