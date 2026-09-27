import { getAIProvider, extractJson } from './provider';
import { ANALYSIS_SYSTEM_PROMPT, buildAnalysisPrompt } from './prompts';
import { DDIAnalysisSchema, DDIAnalysis } from './schemas';
import { getDatabase } from '../db';
import { v4 as uuidv4 } from 'uuid';

export class AIUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIUnavailableError';
  }
}

export class AIValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIValidationError';
  }
}

export async function runDDIAnalysis(
  drug1Id: string,
  drug2Id: string,
  bundle: any,
  options?: { forceRefresh?: boolean, signal?: AbortSignal }
): Promise<{ analysis: DDIAnalysis; fromCache: boolean; model: string }> {
  
  // Sort IDs alphabetically to ensure consistent cache keys
  const sortedIds = [drug1Id.toLowerCase(), drug2Id.toLowerCase()].sort();
  const d1 = sortedIds[0];
  const d2 = sortedIds[1];

  let pool;
  try {
    pool = getDatabase();
  } catch (e) {
    console.warn("Database unavailable for cache:", e);
  }

  // 1. Check cache if database is available and refresh not forced
  if (pool && !options?.forceRefresh) {
    try {
      const res = await pool.query(
        'SELECT result_json FROM ddi_cache WHERE drug1_id = $1 AND drug2_id = $2',
        [d1, d2]
      );
      if (res.rows.length > 0) {
        console.log(`[DDI Cache Hit] ${d1} + ${d2}`);
        const parsed = DDIAnalysisSchema.parse(JSON.parse(res.rows[0].result_json));
        return { analysis: parsed, fromCache: true, model: 'cache' };
      }
    } catch (error) {
      console.warn("Error reading from DDI cache:", error);
    }
  }

  // 2. Cache miss: Call AI Provider
  console.log(`[DDI Cache Miss] Fetching from AI for ${d1} + ${d2}`);
  const provider = getAIProvider();
  let raw: string;
  try {
    raw = await provider.complete(ANALYSIS_SYSTEM_PROMPT, buildAnalysisPrompt(bundle), false, options?.signal);
  } catch (error) {
    throw new AIUnavailableError(`Failed to fetch from AI provider: ${error}`);
  }

  let analysis: DDIAnalysis;
  let cleanJsonString: string;
  try {
    cleanJsonString = extractJson(raw);
    analysis = DDIAnalysisSchema.parse(JSON.parse(cleanJsonString));
  } catch (error) {
    throw new AIValidationError(`AI returned invalid schema: ${error}`);
  }

  // 3. Save to cache asynchronously if DB is available
  if (pool) {
    pool.query(
      `INSERT INTO ddi_cache (id, drug1_id, drug2_id, result_json)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (drug1_id, drug2_id) DO UPDATE SET result_json = EXCLUDED.result_json, created_at = CURRENT_TIMESTAMP`,
      [uuidv4(), d1, d2, cleanJsonString]
    ).catch(e => console.error("Failed to write to DDI cache:", e));
  }

  return { analysis, fromCache: false, model: provider.modelId };
}
