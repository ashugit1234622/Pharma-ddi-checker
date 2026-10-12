import fs from "fs";
import path from "path";
import {
  IndividualDrugSafetyProfile,
  SafetyCatalog,
  SafetyCatalogSchema,
} from "./schema";

export type SafetyResolutionStatus = "available" | "partial" | "unavailable" | "ambiguous";

export type MatchType =
  | "canonical_id"
  | "verified_alias"
  | "ambiguous_alias"
  | "known_drug_outside_pilot"
  | "unknown_drug";

export interface SafetyResolutionResult {
  status: SafetyResolutionStatus;
  queriedDrugId: string;
  matchedDrugId: string | null;
  matchedName: string | null;
  matchType: MatchType;
  scopeNotes?: string;
  ambiguityReason?: string;
  unavailableReason?: string;
  missingCategories?: string[];
  profile: IndividualDrugSafetyProfile | null;
}

// In-memory caches to avoid repeated disk reads
let cachedCatalog: SafetyCatalog | null = null;
let cachedSeedDrugs: any[] | null = null;

function loadCatalog(): SafetyCatalog | null {
  if (cachedCatalog) return cachedCatalog;
  try {
    const catalogPath = path.join(process.cwd(), "data", "individual-safety-pilot.json");
    if (!fs.existsSync(catalogPath)) {
      console.warn("Safety catalog file not found:", catalogPath);
      return null;
    }
    const raw = fs.readFileSync(catalogPath, "utf8");
    const parsed = JSON.parse(raw);
    const valid = SafetyCatalogSchema.safeParse(parsed);
    if (valid.success) {
      cachedCatalog = valid.data;
      return cachedCatalog;
    } else {
      console.error("Safety catalog schema validation failed on load:", valid.error);
      return null;
    }
  } catch (err) {
    console.error("Failed to load safety catalog:", err);
    return null;
  }
}

function loadSeedDrugs(): any[] {
  if (cachedSeedDrugs) return cachedSeedDrugs;
  try {
    const seedPath = path.join(process.cwd(), "data", "seed.json");
    if (fs.existsSync(seedPath)) {
      const raw = fs.readFileSync(seedPath, "utf8");
      cachedSeedDrugs = JSON.parse(raw);
      return cachedSeedDrugs || [];
    }
  } catch (err) {
    console.error("Failed to load seed drugs for catalog fallback:", err);
  }
  return [];
}

/**
 * Combination product mapping rules:
 * Explicitly guards against silently matching combination brand names to single-ingredient profiles.
 */
const COMBINATION_ALIASES: Record<string, { parentDrugId: string; combinationDescription: string }> = {
  augmentin: {
    parentDrugId: "amoxicillin",
    combinationDescription: "Augmentin is a fixed-dose combination product containing amoxicillin and clavulanate potassium. Single-ingredient amoxicillin safety data cannot be silently applied because clavulanate adds distinct hepatic cholestatic and gastrointestinal risks.",
  },
  caduet: {
    parentDrugId: "atorvastatin",
    combinationDescription: "Caduet is a fixed-dose combination product containing atorvastatin and amlodipine besylate. Single-ingredient atorvastatin safety data cannot be silently applied because amlodipine introduces distinct vasodilatory, hemodynamic, and peripheral edema considerations.",
  },
};

/**
 * Resolves the individual drug safety profile for a given drug ID or query name.
 * Strictly adheres to read-only clinical integrity rules.
 */
export function getIndividualSafety(drugIdOrQuery: string): SafetyResolutionResult {
  const query = (drugIdOrQuery || "").trim().toLowerCase();

  if (!query) {
    return {
      status: "unavailable",
      queriedDrugId: "",
      matchedDrugId: null,
      matchedName: null,
      matchType: "unknown_drug",
      unavailableReason: "No medication identifier provided.",
      profile: null,
    };
  }

  // 1. Guard against combination products / ambiguous formulation aliases
  if (COMBINATION_ALIASES[query]) {
    const comb = COMBINATION_ALIASES[query];
    return {
      status: "ambiguous",
      queriedDrugId: drugIdOrQuery,
      matchedDrugId: comb.parentDrugId,
      matchedName: drugIdOrQuery,
      matchType: "ambiguous_alias",
      ambiguityReason: comb.combinationDescription,
      profile: null,
    };
  }

  const catalog = loadCatalog();
  if (!catalog) {
    return {
      status: "unavailable",
      queriedDrugId: drugIdOrQuery,
      matchedDrugId: null,
      matchedName: null,
      matchType: "unknown_drug",
      unavailableReason: "Individual safety catalog is currently unreachable or failed validation.",
      profile: null,
    };
  }

  // 2. Exact Canonical Drug ID Match
  const canonicalMatch = catalog.profiles.find(
    (p) => p.drugId.toLowerCase() === query
  );

  if (canonicalMatch) {
    return {
      status: canonicalMatch.dataCompleteness,
      queriedDrugId: drugIdOrQuery,
      matchedDrugId: canonicalMatch.drugId,
      matchedName: canonicalMatch.genericName,
      matchType: "canonical_id",
      scopeNotes: canonicalMatch.productScope.scopeNotes,
      profile: canonicalMatch,
    };
  }

  // 3. Verified Monotherapy Alias Match
  const aliasMatch = catalog.profiles.find((p) =>
    p.aliases.some((alias) => alias.toLowerCase() === query)
  );

  if (aliasMatch) {
    return {
      status: aliasMatch.dataCompleteness,
      queriedDrugId: drugIdOrQuery,
      matchedDrugId: aliasMatch.drugId,
      matchedName: aliasMatch.genericName,
      matchType: "verified_alias",
      scopeNotes: aliasMatch.productScope.scopeNotes,
      profile: aliasMatch,
    };
  }

  // 4. Check if drug is a recognized medication in seed.json outside the pilot catalog
  const seedDrugs = loadSeedDrugs();
  const seedMatch = seedDrugs.find((d: any) => {
    const id = (d._id || d.id || "").toLowerCase();
    const name = (d.name || "").toLowerCase();
    const genericName = (d.genericName || "").toLowerCase();
    const hasSynonym = Array.isArray(d.synonyms) && d.synonyms.some((s: string) => s.toLowerCase() === query);
    return id === query || name === query || genericName === query || hasSynonym;
  });

  if (seedMatch) {
    const drugDisplayName = seedMatch.name || seedMatch.genericName || drugIdOrQuery;
    return {
      status: "unavailable",
      queriedDrugId: drugIdOrQuery,
      matchedDrugId: seedMatch._id || seedMatch.id || query,
      matchedName: drugDisplayName,
      matchType: "known_drug_outside_pilot",
      unavailableReason: `Individual safety profile for '${drugDisplayName}' is not yet indexed in the current clinical safety catalog (Pilot coverage includes Paracetamol, Warfarin, Metformin, Atorvastatin, and Amoxicillin).`,
      profile: null,
    };
  }

  // 5. Unknown Medication
  return {
    status: "unavailable",
    queriedDrugId: drugIdOrQuery,
    matchedDrugId: null,
    matchedName: null,
    matchType: "unknown_drug",
    unavailableReason: "Individual safety information is not yet available in the current catalog.",
    profile: null,
  };
}
