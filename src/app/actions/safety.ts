'use server';

import { getIndividualSafety, SafetyResolutionResult } from '@/lib/safety/resolver';

const MAX_QUERY_LENGTH = 100;

/**
 * Server Action: Resolves individual drug safety profile from the verified catalog.
 *
 * Security Invariants Enforced:
 * - Strict type checking (rejects non-strings)
 * - Input length bounding (max 100 characters to prevent DoS)
 * - Rejection of control characters and null bytes
 * - Safe error boundary: Zero internal filesystem paths or stack traces leaked to client
 * - Read-only execution: Client cannot alter catalog or select arbitrary files
 */
export async function resolveIndividualSafety(drugId: unknown): Promise<SafetyResolutionResult> {
  try {
    // 1. Strict Type Validation
    if (typeof drugId !== 'string') {
      return {
        status: 'unavailable',
        queriedDrugId: '',
        matchedDrugId: null,
        matchedName: null,
        matchType: 'unknown_drug',
        unavailableReason: 'Invalid drug query type: identifier must be a string.',
        profile: null,
      };
    }

    // 2. Length & Whitespace Bounding
    const trimmed = drugId.trim();
    if (!trimmed) {
      return {
        status: 'unavailable',
        queriedDrugId: '',
        matchedDrugId: null,
        matchedName: null,
        matchType: 'unknown_drug',
        unavailableReason: 'Medication identifier cannot be empty.',
        profile: null,
      };
    }

    if (trimmed.length > MAX_QUERY_LENGTH) {
      return {
        status: 'unavailable',
        queriedDrugId: trimmed.slice(0, 30) + '...',
        matchedDrugId: null,
        matchedName: null,
        matchType: 'unknown_drug',
        unavailableReason: `Medication query exceeds maximum allowable length of ${MAX_QUERY_LENGTH} characters.`,
        profile: null,
      };
    }

    // 3. Disallow Control Characters and Null Bytes
    if (/[\x00-\x1F\x7F]/.test(trimmed)) {
      return {
        status: 'unavailable',
        queriedDrugId: 'invalid_characters',
        matchedDrugId: null,
        matchedName: null,
        matchType: 'unknown_drug',
        unavailableReason: 'Medication query contains invalid control characters.',
        profile: null,
      };
    }

    // 4. Safe Read-Only Resolver Execution
    const result = getIndividualSafety(trimmed);

    // 5. Explicit Serializable Response Mapping (Excludes any internal or prototype properties)
    return {
      status: result.status,
      queriedDrugId: result.queriedDrugId,
      matchedDrugId: result.matchedDrugId,
      matchedName: result.matchedName,
      matchType: result.matchType,
      scopeNotes: result.scopeNotes,
      ambiguityReason: result.ambiguityReason,
      unavailableReason: result.unavailableReason,
      missingCategories: result.missingCategories,
      profile: result.profile,
    };
  } catch (err) {
    // Exception Boundary: Never leak internal error objects, file paths, or stack traces
    console.error('Individual safety action caught exception:', err instanceof Error ? err.message : String(err));
    return {
      status: 'unavailable',
      queriedDrugId: typeof drugId === 'string' ? drugId.slice(0, 50) : '',
      matchedDrugId: null,
      matchedName: null,
      matchType: 'unknown_drug',
      unavailableReason: 'Individual safety catalog is temporarily unavailable.',
      profile: null,
    };
  }
}
