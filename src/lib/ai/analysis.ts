import { getAIProvider, extractJson } from './provider';
import { buildSystemPrompt, buildAnalysisPrompt } from './prompts';
import { UserRole } from './roleContext';
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
  options?: { forceRefresh?: boolean, signal?: AbortSignal, userProfile?: any, userRole?: UserRole }
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

  const userRole = options?.userRole || 'user';

  // 1. Check cache if database is available and refresh not forced
  // IMPORTANT: We MUST bypass the global cache if a userProfile is provided,
  // to prevent leaking personalized reports to other users.
  if (pool && !options?.forceRefresh && !options?.userProfile) {
    try {
      const res = await pool.query(
        'SELECT result_json FROM ddi_cache_v2 WHERE drug1_id = $1 AND drug2_id = $2 AND user_role = $3',
        [d1, d2, userRole]
      );
      if (res.rows.length > 0) {
        console.log(`[DDI Cache Hit] ${d1} + ${d2} (${userRole})`);
        const parsed = DDIAnalysisSchema.parse(JSON.parse(res.rows[0].result_json));
        return { analysis: parsed, fromCache: true, model: 'cache' };
      }
    } catch (error) {
      console.warn("Error reading from DDI cache:", error);
    }
  }

  // 2. Cache miss: Call AI Provider
  console.log(`[DDI Cache Miss] Fetching from AI for ${d1} + ${d2} (${userRole})`);
  const provider = getAIProvider();
  let raw: string;
  try {
    raw = await provider.complete(buildSystemPrompt(userRole), buildAnalysisPrompt(bundle, options?.userProfile, userRole), false, options?.signal);
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
  if (pool && !options?.userProfile) {
    pool.query(
      `INSERT INTO ddi_cache_v2 (id, drug1_id, drug2_id, user_role, result_json)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (drug1_id, drug2_id, user_role) DO UPDATE SET result_json = EXCLUDED.result_json, created_at = CURRENT_TIMESTAMP`,
      [uuidv4(), d1, d2, userRole, cleanJsonString]
    ).catch(e => console.error("Failed to write to DDI cache:", e));
  }

  return { analysis, fromCache: false, model: provider.modelId };
}
