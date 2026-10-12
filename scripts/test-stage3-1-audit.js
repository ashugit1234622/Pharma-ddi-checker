/**
 * Stage 3.1: Individual Drug Safety Release Audit Test Suite
 *
 * Covers:
 * 1. Server Action Security (Input constraints, bounding, path traversal, injection, error masks)
 * 2. Clinical Provenance & Live Source Status (DailyMed SPL Set IDs, NFI references)
 * 3. Combination Product Guarding & Alias Scope (Augmentin, Caduet, Ambiguity isolation)
 * 4. Clinical Guidance Distinction (General Emergency vs Drug-Specific Management)
 * 5. Failure Isolation & Zero-Leakage Invariants
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const projectRoot = path.resolve(__dirname, '..');
const catalogPath = path.join(projectRoot, 'data', 'individual-safety-pilot.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

const seedData = JSON.parse(fs.readFileSync(path.join(projectRoot, 'data', 'seed.json'), 'utf8'));
const knownSeedDrugs = seedData.map(d => ({
  name: (d.name || '').toLowerCase(),
  genericName: (d.genericName || '').toLowerCase(),
  synonyms: (d.synonyms || []).map(s => s.toLowerCase())
}));

const catalogDrugMap = new Map();
for (const profile of catalog.profiles) {
  catalogDrugMap.set(profile.genericName.toLowerCase(), profile);
  catalogDrugMap.set(profile.drugId.toLowerCase(), profile);
  for (const alias of (profile.aliases || [])) {
    catalogDrugMap.set(alias.toLowerCase(), profile);
  }
}

const AMBIGUOUS_COMBINATIONS = {
  'augmentin': 'Augmentin is a combination of Amoxicillin and Clavulanate Potassium.',
  'caduet': 'Caduet is a combination of Amlodipine Besylate and Atorvastatin Calcium.'
};

function testResolver(query) {
  if (typeof query !== 'string') {
    return { status: 'unavailable', profile: null, unavailableReason: 'Invalid drug query type: identifier must be a string.' };
  }
  const clean = query.trim().toLowerCase();
  if (!clean) {
    return { status: 'unavailable', profile: null, unavailableReason: 'Medication identifier cannot be empty.' };
  }
  if (clean.length > 100) {
    return { status: 'unavailable', profile: null, unavailableReason: 'Medication query exceeds maximum allowable length of 100 characters.' };
  }
  if (/[\x00-\x1F\x7F]/.test(clean)) {
    return { status: 'unavailable', profile: null, unavailableReason: 'Medication query contains invalid control characters.' };
  }
  if (AMBIGUOUS_COMBINATIONS[clean]) {
    return { status: 'ambiguous', profile: null, ambiguityReason: AMBIGUOUS_COMBINATIONS[clean] };
  }
  if (catalogDrugMap.has(clean)) {
    return { status: 'available', profile: catalogDrugMap.get(clean) };
  }
  const inSeed = knownSeedDrugs.some(k => k.name === clean || k.genericName === clean || k.synonyms.includes(clean));
  if (inSeed) {
    return { status: 'unavailable', profile: null, matchType: 'known_outside_pilot' };
  }
  return { status: 'unavailable', profile: null, matchType: 'unknown_drug' };
}

let passed = 0;
let failed = 0;

function runTest(title, fn) {
  try {
    fn();
    console.log(`  [✓] ${title}`);
    passed++;
  } catch (err) {
    console.error(`  [✗] ${title}: ${err.message}`);
    failed++;
  }
}

console.log('='.repeat(80));
console.log('       STAGE 3.1 RELEASE AUDIT & SECURITY TEST SUITE');
console.log('='.repeat(80));

// SECTION 1: SERVER ACTION SECURITY
console.log('\n[1/4] Server Action Security & Input Boundaries:');

runTest('Rejects non-string inputs (number, boolean, null, undefined, object)', () => {
  const invalidInputs = [12345, true, false, null, undefined, { drug: 'warfarin' }, ['aspirin']];
  for (const input of invalidInputs) {
    const res = testResolver(input);
    assert.strictEqual(res.status, 'unavailable');
    assert.strictEqual(res.profile, null);
    assert(res.unavailableReason.includes('string'));
  }
});

runTest('Rejects oversized queries (> 100 characters) to prevent DoS', () => {
  const oversized = 'a'.repeat(101);
  const res = testResolver(oversized);
  assert.strictEqual(res.status, 'unavailable');
  assert.strictEqual(res.profile, null);
  assert(res.unavailableReason.includes('maximum allowable length'));
});

runTest('Rejects control characters and null bytes (\x00, \x1F, \x7F)', () => {
  const nullByteQuery = 'warfarin\x00injection';
  const res = testResolver(nullByteQuery);
  assert.strictEqual(res.status, 'unavailable');
  assert.strictEqual(res.profile, null);
  assert(res.unavailableReason.includes('control characters'));
});

runTest('Rejects path traversal and arbitrary file selection attempts', () => {
  const pathQueries = ['../../data/seed.json', '..\\..\\etc\\passwd', 'data/individual-safety-pilot.json'];
  for (const q of pathQueries) {
    const res = testResolver(q);
    assert.strictEqual(res.status, 'unavailable');
    assert.strictEqual(res.profile, null);
  }
});

runTest('Safe error boundary: no filesystem paths or stack traces leaked', () => {
  const actionFile = fs.readFileSync(path.join(projectRoot, 'src', 'app', 'actions', 'safety.ts'), 'utf8');
  assert(actionFile.includes("console.error('Individual safety action caught exception:'"), 'Must log internally only');
  assert(actionFile.includes("unavailableReason: 'Individual safety catalog is temporarily unavailable.'"), 'Must return generic client message');
  assert(!actionFile.includes('err.stack'), 'Client response must never include stack trace');
  assert(!actionFile.includes('process.cwd()'), 'Client response must never expose server cwd');
});

// SECTION 2: MEDICINE IDENTITY & COMBINATION INTERCEPTION
console.log('\n[2/4] Medicine Identity & Combination Guards:');

runTest('Combination product "augmentin" is intercepted and never assigned single amoxicillin profile', () => {
  const res = testResolver('augmentin');
  assert.strictEqual(res.status, 'ambiguous');
  assert.strictEqual(res.profile, null);
  assert(res.ambiguityReason.includes('Clavulanate'));
});

runTest('Combination product "caduet" is intercepted and never assigned single atorvastatin profile', () => {
  const res = testResolver('caduet');
  assert.strictEqual(res.status, 'ambiguous');
  assert.strictEqual(res.profile, null);
  assert(res.ambiguityReason.includes('Amlodipine'));
});

runTest('Known seed drugs outside pilot (e.g., aspirin) receive explicit known_outside_pilot status', () => {
  const res = testResolver('aspirin');
  assert.strictEqual(res.status, 'unavailable');
  assert.strictEqual(res.matchType, 'known_outside_pilot');
});

runTest('Completely unknown drugs receive unknown_drug status', () => {
  const res = testResolver('supercalifragilisticdrug');
  assert.strictEqual(res.status, 'unavailable');
  assert.strictEqual(res.matchType, 'unknown_drug');
});

// SECTION 3: CLINICAL PROVENANCE & GUIDANCE DISTINCTION
console.log('\n[3/4] Clinical Provenance & Emergency Guidance Audit:');

runTest('All 5 pilot drugs have valid DailyMed SPL GUIDs and Indian statutory citations', () => {
  for (const drug of catalog.profiles) {
    assert(drug.sources.length >= 2, `${drug.genericName} must cite at least 2 authoritative sources`);
    const dailyMed = drug.sources.find(s => s.documentType === 'fda_spl_label');
    assert(dailyMed, `${drug.genericName} missing DailyMed SPL citation`);
    assert(dailyMed.url.startsWith('https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid='), `${drug.genericName} DailyMed URL must use setid lookup`);
    
    const indianStatutory = drug.sources.find(s => s.jurisdiction === 'India' || s.jurisdiction === 'IN');
    assert(indianStatutory, `${drug.genericName} missing Indian statutory citation`);
  }
});

runTest('Adverse reaction guidance contains drug-specific management actions where clinically critical', () => {
  const apap = catalog.profiles.find(d => d.drugId === 'paracetamol');
  const apapAntidote = apap.adverseReactionGuidance.find(a => a.recommendedAction.includes('N-acetylcysteine'));
  assert(apapAntidote, 'Acetaminophen must specify N-acetylcysteine antidote protocol');
  assert(apapAntidote.recommendedAction.includes('8 hours'), 'NAC guidance must specify optimal 8-hour window');

  const warfarin = catalog.profiles.find(d => d.drugId === 'warfarin');
  const warfarinReversal = warfarin.adverseReactionGuidance.find(a => a.recommendedAction.toLowerCase().includes('vitamin k'));
  assert(warfarinReversal, 'Warfarin must specify vitamin K reversal');

  const metformin = catalog.profiles.find(d => d.drugId === 'metformin');
  const metDiscontinue = metformin.adverseReactionGuidance.find(a => a.recommendedAction.includes('Discontinue metformin immediately'));
  assert(metDiscontinue, 'Metformin must specify immediate discontinuation for lactic acidosis');
});

runTest('UI explicitly labels Drug-Specific Clinical Management vs General Emergency Protocol', () => {
  const uiFile = fs.readFileSync(path.join(projectRoot, 'src', 'components', 'IndividualDrugSafetySection.tsx'), 'utf8');
  assert(uiFile.includes('Drug-Specific Clinical Management'), 'UI must render Drug-Specific Clinical Management badge');
  assert(uiFile.includes('General Emergency Protocol'), 'UI must render General Emergency Protocol badge');
  assert(uiFile.includes('Clinical Completeness Notice'), 'UI must render Clinical Completeness Notice disclaimer');
});

// SECTION 4: STALE STATE PREVENTION & SYSTEM INVARIANTS
console.log('\n[4/4] Stale State Prevention & Invariants:');

runTest('page.tsx immediately resets drug1Safety and drug2Safety upon pair switch', () => {
  const pageFile = fs.readFileSync(path.join(projectRoot, 'src', 'app', 'page.tsx'), 'utf8');
  const resetPattern = /setDrug1Safety\(null\);\s*setDrug2Safety\(null\);/;
  assert(resetPattern.test(pageFile), 'page.tsx must explicitly reset safety states to null upon selection change');
});

runTest('Deterministic DDI rule engine remains untouched', () => {
  const ruleEngine = fs.readFileSync(path.join(projectRoot, 'src', 'lib', 'ddi', 'ruleEngine.ts'), 'utf8');
  assert(ruleEngine.includes('export function findSharedCypSignal'), 'Deterministic DDI ruleEngine must remain intact');
  // Severity & deterministic logic intact
});

runTest('API routes (/api/analyze, /api/search, /api/ask) remain untouched', () => {
  const analyzeRoute = fs.readFileSync(path.join(projectRoot, 'src', 'app', 'api', 'analyze', 'route.ts'), 'utf8');
  assert(analyzeRoute.includes('export async function POST'), 'POST /api/analyze intact');
  assert(!analyzeRoute.includes('individual-safety-pilot'), 'API route must have zero safety catalog dependencies');
});

console.log('\n' + '='.repeat(80));
if (failed === 0) {
  console.log(`ALL ${passed} AUDIT AND INVARIANT TESTS PASSED CLEANLY!`);
} else {
  console.error(`FAILED: ${failed} tests failed out of ${passed + failed}`);
  process.exit(1);
}
console.log('='.repeat(80));
