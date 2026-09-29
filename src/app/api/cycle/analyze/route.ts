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
      
      Provide a highly personalized 2-sentence insight or health tip for today.
      If she has specific conditions like PCOS or thyroid issues, or is taking specific meds (like birth control or iron supplements), explicitly mention how her phase interacts with them.
      Include a specific dietary or lifestyle tip for this specific phase.
      Keep it encouraging, medically safe, and very concise.
    `;

    try {
      const ai = getGeminiProvider();
      const response = await ai.complete("You are a medical AI assistant.", prompt);
      
      // getGeminiProvider().complete returns a string directly
      return NextResponse.json({ insight: response.trim() });
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
