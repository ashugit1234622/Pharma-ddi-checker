import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

let foodsCache: any[] | null = null;

function loadFoods(): any[] {
  if (foodsCache) return foodsCache;
  try {
    const filePath = path.join(process.cwd(), 'data', 'foods.json');
    foodsCache = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return foodsCache || [];
  } catch (err) {
    console.error("Failed to load foods.json", err);
    return [];
  }
}

// ── Levenshtein distance (for fuzzy matching) ─────────────────────────────────
function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const dp: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    dp[i] = [i];
    for (let j = 1; j <= b.length; j++) {
      if (i === 0) {
        dp[i][j] = j;
      } else {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,      // deletion
          dp[i][j - 1] + 1,      // insertion
          dp[i - 1][j - 1] + cost // substitution
        );
      }
    }
  }
  return dp[a.length][b.length];
}

// Fuzzy similarity: 1.0 = perfect, 0 = completely different
function fuzzyScore(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() ?? '';

  if (q.length < 1) {
    return NextResponse.json({ data: [] });
  }

  const queryLower = q.toLowerCase();
  const allFoods = loadFoods();

  const results = allFoods.map(food => {
    // Exact substring matches get highest priority
    let maxScore = 0;
    
    // Check main name
    const nameLower = food.name.toLowerCase();
    if (nameLower.includes(queryLower)) maxScore = 1.0;
    else maxScore = Math.max(maxScore, fuzzyScore(queryLower, nameLower));

    // Check synonyms
    if (food.synonyms) {
      for (const syn of food.synonyms) {
        const synLower = syn.toLowerCase();
        if (synLower.includes(queryLower)) maxScore = Math.max(maxScore, 0.95);
        else maxScore = Math.max(maxScore, fuzzyScore(queryLower, synLower));
      }
    }

    // Boost if query matches start of the word
    if (nameLower.startsWith(queryLower)) {
      maxScore = Math.max(maxScore, 1.1); // push to top
    }

    return { ...food, score: maxScore };
  });

  // Filter out low scores (threshold 0.4) and sort
  const threshold = 0.35;
  const filtered = results.filter(d => d.score >= threshold);
  
  filtered.sort((a, b) => b.score - a.score);

  return NextResponse.json({ data: filtered.slice(0, 10) });
}
