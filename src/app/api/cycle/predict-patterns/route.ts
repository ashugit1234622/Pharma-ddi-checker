import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getGeminiProvider } from '@/lib/ai/provider';

function extractCleanText(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'string') {
    let s = val.trim();
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    if (s.startsWith('{') || s.startsWith('[')) {
      try {
        const p = JSON.parse(s);
        return extractCleanText(p);
      } catch {
        const m = s.match(/"(?:prediction|insight|tip)"\s*:\s*"([^"]+)"/i);
        if (m && m[1]) return m[1].replace(/\\"/g, '"');
      }
    }
    return s.replace(/^[\[{\s"]+|[\]}\s"]+$/g, '').trim();
  }
  if (Array.isArray(val) && val.length > 0) return extractCleanText(val[0]);
  if (typeof val === 'object' && val !== null) {
    const obj = val as Record<string, any>;
    return extractCleanText(obj.prediction || obj.insight || obj.tips || obj.text || Object.values(obj)[0]);
  }
  return String(val);
}

function getFallbackPatterns(details: any) {
  const isPcod = details?.cycle_length_type === 'pcod';

  return {
    "Menstruation": isPcod
      ? "Hormonal variations during menstruation can intensify fatigue and pelvic discomfort. Avoid inflammatory fried foods, excess caffeine, and dairy. Prioritize magnesium-rich leafy greens, warm herbal tea, and gentle walking to support healthy circulation."
      : "Energy levels are at baseline as hormone levels reset. Avoid strenuous high-intensity workouts and sleep deprivation. Prioritize iron-rich foods (lentils, spinach), gentle stretching, and restorative hydration.",
    "Follicular Phase": isPcod
      ? "As estrogen rises, insulin sensitivity should be supported. Avoid refined sugars and high-glycemic carbohydrates. Emphasize fiber-rich vegetables, lean proteins, and moderate strength training to support steady metabolic balance."
      : "Rising estrogen boosts mental clarity, stamina, and positive mood. This is an optimal window for higher-intensity workouts and creative projects. Fuel your body with balanced complex carbs and antioxidant-rich foods.",
    "Fertile Window": isPcod
      ? "Estrogen and luteinizing hormone surge toward ovulation, though timing may be variable with PCOD. Avoid chronic stress, crash diets, and skipped meals. Support reproductive health with healthy fats (avocado, flaxseeds), zinc, and restorative yoga."
      : "Peak estrogen and LH surge drive highest energy, social confidence, and metabolic resilience. Avoid dehydration and sleep deficits. Fuel this active phase with nutrient-dense light meals, healthy fats, and strength-based movement.",
    "Ovulation Window": isPcod
      ? "Estrogen and luteinizing hormone surge toward ovulation, though timing may be variable with PCOD. Avoid chronic stress, crash diets, and skipped meals. Support reproductive health with healthy fats (avocado, flaxseeds), zinc, and restorative yoga."
      : "Peak estrogen and LH surge drive highest energy, social confidence, and metabolic resilience. Avoid dehydration and sleep deficits. Fuel this active phase with nutrient-dense light meals, healthy fats, and strength-based movement.",
    "Luteal Phase": isPcod
      ? "Progesterone rise can trigger water retention, mood fluctuations, and sugar cravings. Avoid salty snacks and processed sweets. Focus on vitamin B6-rich foods (bananas, chickpeas), calming chamomile tea, and a consistent sleep schedule."
      : "Progesterone dominates, naturally increasing metabolic demand and mild premenstrual fatigue. Avoid excess stimulants and dehydration. Prioritize calming complex carbohydrates, magnesium, and gentle restorative movement."
  };
}

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
      Fertile Window / Ovulation: ${JSON.stringify(details.ovulation_phase)}
      Luteal Phase: ${JSON.stringify(details.luteal_phase)}
      Overall Patterns: ${details.final_question}
      Cycle Length/Type: ${details.cycle_length_type === 'pcod' ? 'PCOD/PCOS/Hormonal issue' : (details.cycle_length_type || '28 days')}
      Custom Cycle Length: ${details.custom_cycle_length || 'N/A'}
      
      Please rephrase these observations into concise, professional, and empathetic clinical predictions of their mood, energy, and physical changes for each phase. 
      CRITICAL INSTRUCTION: For EACH phase, your prediction string MUST also include suitable health tips, explicitly covering:
      1. What to avoid
      2. Diet recommendations
      3. Medical/lifestyle tips related to their specific menstruation condition (e.g. if they have PCOD/PCOS or irregular cycles).
      Make sure the prediction explicitly factors in their cycle length type or hormonal issues.
      Output the result as a raw JSON object with the exact following keys (no markdown wrapping, just the JSON):
      {
        "Menstruation": "prediction and tips string",
        "Follicular Phase": "prediction and tips string",
        "Fertile Window": "prediction and tips string",
        "Luteal Phase": "prediction and tips string"
      }
    `;

    try {
      const ai = getGeminiProvider();
      const response = await ai.complete("You are a medical AI assistant that outputs raw JSON only.", prompt);
      
      let cleaned = response.trim();
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

      let parsed: any = null;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) {
          try { parsed = JSON.parse(match[0]); } catch {}
        }
      }

      if (!parsed || typeof parsed !== 'object') {
        console.warn('[Cycle Predict AI] Could not parse AI JSON response, serving clinical fallbacks.');
        return NextResponse.json({ patterns: getFallbackPatterns(details) });
      }

      const normalized: Record<string, string> = {};
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === 'object') {
            const key = item.phase || item.name || item.stage;
            const val = item.prediction || item.insight || item.tips || item.text;
            if (key && val) {
              normalized[key] = extractCleanText(val);
            }
          }
        }
      } else {
        for (const [k, v] of Object.entries(parsed)) {
          normalized[k] = extractCleanText(v);
        }
      }

      // Synchronize Fertile Window & Ovulation Window so lookups never fail
      const fertileText = normalized["Fertile Window"] || 
                          normalized["Ovulation Window"] || 
                          normalized["Ovulation"] || 
                          normalized["Fertile Phase"] || 
                          "";

      const fallback = getFallbackPatterns(details);

      if (fertileText) {
        normalized["Fertile Window"] = fertileText;
        normalized["Ovulation Window"] = fertileText;
      } else {
        normalized["Fertile Window"] = fallback["Fertile Window"];
        normalized["Ovulation Window"] = fallback["Ovulation Window"];
      }

      if (!normalized["Menstruation"]) normalized["Menstruation"] = fallback["Menstruation"];
      if (!normalized["Follicular Phase"]) normalized["Follicular Phase"] = fallback["Follicular Phase"];
      if (!normalized["Luteal Phase"]) normalized["Luteal Phase"] = fallback["Luteal Phase"];

      return NextResponse.json({ patterns: normalized });
    } catch (aiError: any) {
      console.error('[Cycle Predict AI] Gemini Error, serving fallback patterns:', aiError.message);
      return NextResponse.json({ patterns: getFallbackPatterns(details) });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
