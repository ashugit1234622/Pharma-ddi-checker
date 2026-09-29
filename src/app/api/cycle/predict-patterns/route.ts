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
    const { details } = await req.json();
    if (!details) {
      return NextResponse.json({ error: 'Missing details' }, { status: 400 });
    }

    const prompt = `
      You are an expert AI gynecologist and behavioral health specialist.
      The user has provided the following observations about their menstrual cycle patterns:
      
      Menstrual Phase: ${JSON.stringify(details.menstrual_phase)}
      Follicular Phase: ${JSON.stringify(details.follicular_phase)}
      Ovulation Phase: ${JSON.stringify(details.ovulation_phase)}
      Luteal Phase: ${JSON.stringify(details.luteal_phase)}
      Overall Patterns: ${details.final_question}
      
      Please rephrase these observations into concise, professional, and empathetic clinical predictions of their mood, energy, and physical changes for each phase. 
      Output the result as a raw JSON object with the exact following keys (no markdown wrapping, just the JSON):
      {
        "Menstruation": "prediction string",
        "Follicular Phase": "prediction string",
        "Ovulation Window": "prediction string",
        "Luteal Phase": "prediction string"
      }
    `;

    try {
      const ai = getGeminiProvider();
      const response = await ai.complete("You are a medical AI assistant that outputs raw JSON only.", prompt);
      
      let cleaned = response.trim();
      if (cleaned.startsWith('\`\`\`json')) cleaned = cleaned.replace(/^\`\`\`json/, '');
      if (cleaned.startsWith('\`\`\`')) cleaned = cleaned.replace(/^\`\`\`/, '');
      if (cleaned.endsWith('\`\`\`')) cleaned = cleaned.replace(/\`\`\`$/, '');
      
      const parsed = JSON.parse(cleaned.trim());
      return NextResponse.json({ patterns: parsed });
    } catch (aiError: any) {
      console.error('[Cycle Predict AI] Error:', aiError.message);
      return NextResponse.json({ error: 'AI Error' }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
