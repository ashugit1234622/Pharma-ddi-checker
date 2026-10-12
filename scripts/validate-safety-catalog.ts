import fs from "fs";
import path from "path";
import { validateSafetyCatalog } from "../src/lib/safety/validator";
import { SafetyCatalog } from "../src/lib/safety/schema";

function runValidation() {
  console.log("================================================================================");
  console.log("       FARMA DDI CHECKER — INDIVIDUAL DRUG SAFETY CATALOG VALIDATOR");
  console.log("================================================================================\n");

  const catalogPath = path.join(process.cwd(), "data", "individual-safety-pilot.json");
  if (!fs.existsSync(catalogPath)) {
    console.error(`FATAL: Catalog file not found at ${catalogPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(catalogPath, "utf8");
  const catalogData = JSON.parse(raw);

  console.log(`[1/2] Validating Pilot Catalog: ${catalogData.catalogName} (v${catalogData.catalogVersion})`);
  const result = validateSafetyCatalog(catalogData);

  console.log(`  - Total Profiles Analyzed: ${result.totalProfiles}`);
  console.log(`  - Profiles with Boxed Warnings: ${result.stats.profilesWithBoxedWarning}`);
  console.log(`  - Profiles with Contraindications: ${result.stats.profilesWithContraindications}`);
  console.log(`  - Profiles with Common Adverse Reactions: ${result.stats.profilesWithAdverseEffects}`);
  console.log(`  - Total Verifiable Sources Cited: ${result.stats.totalSourcesCited}`);

  if (result.warnings.length > 0) {
    console.log(`\n[!] Warnings (${result.warnings.length}):`);
    result.warnings.forEach(w => console.log(`    - [${w.code}] (${w.drugId}): ${w.message}`));
  }

  if (result.errors.length > 0) {
    console.error(`\n[X] Validation FAILED with ${result.errors.length} error(s):`);
    result.errors.forEach(e => console.error(`    - [${e.code}] ${e.field ? '(' + e.field + ') ' : ''}${e.message}`));
    process.exit(1);
  } else {
    console.log("\n[✓] Pilot Catalog Structure, Type Safety, and Clinical Provenance: PASSED (0 Errors)\n");
  }

  // [2/2] Clinical Integrity & Edge Case Regression Tests
  console.log("[2/2] Running Integrity Rule & Edge-Case Validation Suite:");

  // Test A: Duplicate Drug ID Detection
  {
    const clone = JSON.parse(JSON.stringify(catalogData));
    clone.profiles.push({ ...clone.profiles[0] });
    const res = validateSafetyCatalog(clone);
    const hasDuplicateError = res.errors.some(e => e.code === "DUPLICATE_DRUG_ID");
    if (!hasDuplicateError) {
      console.error("  [X] FAILED: Duplicate canonical drug ID was not detected!");
      process.exit(1);
    }
    console.log("  [✓] Test A: Duplicate canonical ID detection passed.");
  }

  // Test B: Unresolved Source Citation Detection
  {
    const clone = JSON.parse(JSON.stringify(catalogData));
    clone.profiles[0].contraindications[0].sourceId = "non_existent_source_999";
    const res = validateSafetyCatalog(clone);
    const hasSourceError = res.errors.some(e => e.code === "UNRESOLVED_SOURCE_REFERENCE");
    if (!hasSourceError) {
      console.error("  [X] FAILED: Unresolved clinical source reference was not caught!");
      process.exit(1);
    }
    console.log("  [✓] Test B: Unresolved source provenance detection passed.");
  }

  // Test C: Prohibition of Spontaneous FAERS Reporting for Incidence
  {
    const clone = JSON.parse(JSON.stringify(catalogData));
    clone.profiles[0].commonAdverseEffects[0].evidenceBasis = "spontaneous_reporting";
    const res = validateSafetyCatalog(clone);
    const hasFaersError = res.errors.some(e => !res.valid);
    if (!hasFaersError) {
      console.error("  [X] FAILED: Spontaneous reporting incidence was not blocked!");
      process.exit(1);
    }
    console.log("  [✓] Test C: Prohibition of ungrounded spontaneous reporting incidence passed.");
  }

  // Test D: Missing Mandatory Dosage Disclaimer Detection
  {
    const clone = JSON.parse(JSON.stringify(catalogData));
    clone.profiles[0].dosageAndAdministrationContext.mandatoryDisclaimer = "";
    const res = validateSafetyCatalog(clone);
    const hasDisclaimerError = res.errors.some(e => e.code === "SCHEMA_VALIDATION_ERROR" || e.code === "MISSING_DOSAGE_DISCLAIMER");
    if (!hasDisclaimerError) {
      console.error("  [X] FAILED: Missing mandatory dosage disclaimer was not detected!");
      process.exit(1);
    }
    console.log("  [✓] Test D: Mandatory dosage prescription disclaimer enforcement passed.");
  }

  // Test E: Safe Handling of Missing Optional Fields
  {
    const minimalProfile = {
      drugId: "test_minimal_med",
      genericName: "test minimal medicine",
      aliases: [],
      productScope: {
        matchStatus: "active_ingredient_monotherapy",
        formulationDescription: "Oral tablet",
      },
      dataCompleteness: "partial",
      boxedWarning: null,
      contraindications: [],
      commonAdverseEffects: [],
      seriousAdverseEffectsAndWarnings: [],
      precautionsAndSpecialPopulations: {
        pregnancy: { status: "unestablished", summary: "Data unestablished", sourceId: "ref_1" },
        lactation: { status: "unestablished", summary: "Data unestablished", sourceId: "ref_1" },
        renalImpairment: { doseAdjustmentRequired: false, guidance: "No specific data", sourceId: "ref_1" },
        hepaticImpairment: { contraindicatedInSevere: false, guidance: "No specific data", sourceId: "ref_1" }
      },
      dosageAndAdministrationContext: null,
      adverseReactionGuidance: [],
      sources: [
        {
          sourceId: "ref_1",
          name: "Test Reference Authority",
          jurisdiction: "International",
          documentType: "peer_reviewed_monograph",
          referenceIdentifier: "MONO-001",
          retrievalDate: "2026-10-12",
          accessTermsAndLicensing: "Open Access",
          limitations: "Minimal test stub"
        }
      ]
    };
    const clone = { ...catalogData, profiles: [minimalProfile] };
    const res = validateSafetyCatalog(clone);
    if (!res.valid) {
      console.error("  [X] FAILED: Minimal profile with omitted optional fields failed validation:", res.errors);
      process.exit(1);
    }
    console.log("  [✓] Test E: Graceful handling of partial/missing optional fields passed.");
  }

  // Test F: Contradictory Unavailable State Detection
  {
    const clone = JSON.parse(JSON.stringify(catalogData));
    clone.profiles[0].dataCompleteness = "unavailable"; // but has populated contraindications
    const res = validateSafetyCatalog(clone);
    const hasStateError = res.errors.some(e => e.code === "CONTRADICTORY_COMPLETENESS_STATE");
    if (!hasStateError) {
      console.error("  [X] FAILED: Contradictory unavailable state was not flagged!");
      process.exit(1);
    }
    console.log("  [✓] Test F: Explicit partial/unavailable state consistency check passed.");
  }

  console.log("\n================================================================================");
  console.log("ALL SAFETY CATALOG VALIDATION AND INTEGRITY SUITES PASSED CLEANLY!");
  console.log("================================================================================\n");
}

runValidation();
