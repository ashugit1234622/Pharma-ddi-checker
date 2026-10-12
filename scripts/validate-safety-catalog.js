const fs = require('fs');
const path = require('path');
const { z } = require('zod');

// Schema definitions
const ProductMatchStatusEnum = z.enum([
  "exact_formulation",
  "active_ingredient_monotherapy",
  "ambiguous_or_combination_alias",
  "unspecified"
]);

const DataCompletenessStatusEnum = z.enum([
  "available",
  "partial",
  "unavailable",
  "ambiguous"
]);

const SourceDocumentTypeEnum = z.enum([
  "fda_spl_label",
  "cdsco_package_insert",
  "national_formulary",
  "pharmacopoeia",
  "peer_reviewed_monograph"
]);

const SourceCitationSchema = z.object({
  sourceId: z.string().min(1),
  name: z.string().min(1),
  jurisdiction: z.string().min(1),
  documentType: SourceDocumentTypeEnum,
  referenceIdentifier: z.string().min(1),
  url: z.string().url().optional().or(z.literal("")),
  revisionDate: z.string().optional(),
  retrievalDate: z.string().min(1),
  accessTermsAndLicensing: z.string().min(1),
  limitations: z.string().min(1),
});

const ProductScopeSchema = z.object({
  matchStatus: ProductMatchStatusEnum,
  formulationDescription: z.string().min(1),
  scopeNotes: z.string().optional(),
});

const ContraindicationCategoryEnum = z.enum(["absolute", "relative"]);
const VerificationStatusEnum = z.enum([
  "verified_labeling",
  "statutory_formulary",
  "unverified"
]);

const ContraindicationItemSchema = z.object({
  id: z.string().min(1),
  clinicalCondition: z.string().min(1),
  category: ContraindicationCategoryEnum,
  rationale: z.string().min(1),
  sourceId: z.string().min(1),
  verificationStatus: VerificationStatusEnum,
});

const FrequencyCategoryEnum = z.enum([
  "very_common",
  "common",
  "uncommon",
  "rare",
  "frequency_not_quantified"
]);

const AdverseEffectBasisEnum = z.enum([
  "clinical_trials",
  "product_labeling",
  "systematic_review"
]);

const AdverseEffectItemSchema = z.object({
  id: z.string().min(1),
  reaction: z.string().min(1),
  frequencyRange: z.string().min(1),
  frequencyCategory: FrequencyCategoryEnum,
  systemOrganClass: z.string().min(1),
  sourceId: z.string().min(1),
  evidenceBasis: AdverseEffectBasisEnum,
});

const WarningSeverityEnum = z.enum(["critical", "high", "moderate"]);

const SeriousWarningItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  severity: WarningSeverityEnum,
  monitoringRecommendations: z.array(z.string()).optional(),
  sourceId: z.string().min(1),
});

const BoxedWarningSchema = z.object({
  present: z.boolean(),
  title: z.string().optional(),
  summary: z.string().optional(),
  riskFactors: z.array(z.string()).optional(),
  sourceId: z.string().optional(),
}).nullable();

const PopulationRiskStatusEnum = z.enum([
  "contraindicated",
  "caution_potential_benefit",
  "caution",
  "compatible",
  "unestablished"
]);

const SpecialPopulationsSchema = z.object({
  pregnancy: z.object({
    status: PopulationRiskStatusEnum,
    summary: z.string().min(1),
    sourceId: z.string().min(1),
  }),
  lactation: z.object({
    status: PopulationRiskStatusEnum,
    summary: z.string().min(1),
    sourceId: z.string().min(1),
  }),
  renalImpairment: z.object({
    doseAdjustmentRequired: z.boolean(),
    contraindicatedCutoff: z.string().optional(),
    guidance: z.string().min(1),
    sourceId: z.string().min(1),
  }),
  hepaticImpairment: z.object({
    contraindicatedInSevere: z.boolean(),
    guidance: z.string().min(1),
    sourceId: z.string().min(1),
  }),
  geriatric: z.object({
    guidance: z.string().min(1),
    sourceId: z.string().min(1),
  }).optional(),
  pediatric: z.object({
    guidance: z.string().min(1),
    sourceId: z.string().min(1),
  }).optional(),
});

const DosageContextSchema = z.object({
  hasSpecificGuidance: z.boolean(),
  route: z.string().min(1),
  standardAdultContext: z.string().min(1),
  maxCeilingDose: z.string().min(1),
  titrationGuidance: z.string().optional(),
  mandatoryDisclaimer: z.string().min(1),
  sourceId: z.string().min(1),
}).nullable();

const AdrUrgencyEnum = z.enum([
  "emergency_immediate_care",
  "urgent_physician_consult",
  "routine_clinical_monitoring"
]);

const AdrActionGuidanceItemSchema = z.object({
  id: z.string().min(1),
  urgency: AdrUrgencyEnum,
  symptomsOrTriggers: z.array(z.string().min(1)).min(1),
  recommendedAction: z.string().min(1),
  clinicalRationale: z.string().min(1),
  sourceId: z.string().min(1),
});

const IndividualDrugSafetyProfileSchema = z.object({
  drugId: z.string().min(1),
  genericName: z.string().min(1),
  aliases: z.array(z.string()),
  productScope: ProductScopeSchema,
  dataCompleteness: DataCompletenessStatusEnum,
  boxedWarning: BoxedWarningSchema,
  contraindications: z.array(ContraindicationItemSchema),
  commonAdverseEffects: z.array(AdverseEffectItemSchema),
  seriousAdverseEffectsAndWarnings: z.array(SeriousWarningItemSchema),
  precautionsAndSpecialPopulations: SpecialPopulationsSchema,
  dosageAndAdministrationContext: DosageContextSchema,
  adverseReactionGuidance: z.array(AdrActionGuidanceItemSchema),
  sources: z.array(SourceCitationSchema).min(1),
});

const SafetyCatalogSchema = z.object({
  catalogVersion: z.string().min(1),
  catalogName: z.string().min(1),
  lastUpdated: z.string().min(1),
  description: z.string().min(1),
  profiles: z.array(IndividualDrugSafetyProfileSchema),
});

function validateSafetyCatalog(catalogData) {
  const errors = [];
  const warnings = [];

  const parseResult = SafetyCatalogSchema.safeParse(catalogData);
  if (!parseResult.success) {
    for (const issue of parseResult.error.issues) {
      errors.push({
        severity: "error",
        code: "SCHEMA_VALIDATION_ERROR",
        field: issue.path.join("."),
        message: issue.message,
      });
    }
    return {
      valid: false,
      totalProfiles: 0,
      errors,
      warnings,
      stats: {
        profilesWithBoxedWarning: 0,
        profilesWithContraindications: 0,
        profilesWithAdverseEffects: 0,
        totalSourcesCited: 0,
      },
    };
  }

  const catalog = parseResult.data;
  const seenDrugIds = new Set();

  let profilesWithBoxedWarning = 0;
  let profilesWithContraindications = 0;
  let profilesWithAdverseEffects = 0;
  let totalSourcesCited = 0;

  for (const profile of catalog.profiles) {
    const { drugId } = profile;

    if (seenDrugIds.has(drugId.toLowerCase())) {
      errors.push({
        severity: "error",
        code: "DUPLICATE_DRUG_ID",
        drugId,
        message: `Duplicate canonical drug ID '${drugId}' found in catalog.`,
      });
    }
    seenDrugIds.add(drugId.toLowerCase());

    if (!profile.sources || profile.sources.length === 0) {
      errors.push({
        severity: "error",
        code: "MISSING_SOURCES",
        drugId,
        message: `Drug profile '${drugId}' must contain at least one verifiable source citation.`,
      });
    }

    const availableSourceIds = new Set(profile.sources.map((s) => s.sourceId));
    totalSourcesCited += profile.sources.length;

    for (const src of profile.sources) {
      if (!src.retrievalDate || !src.accessTermsAndLicensing || !src.referenceIdentifier) {
        errors.push({
          severity: "error",
          code: "INCOMPLETE_SOURCE_METADATA",
          drugId,
          field: `sources.${src.sourceId}`,
          message: `Source citation '${src.sourceId}' is missing mandatory provenance fields.`,
        });
      }
    }

    const checkSourceRef = (sourceId, itemType, itemId) => {
      if (!availableSourceIds.has(sourceId)) {
        errors.push({
          severity: "error",
          code: "UNRESOLVED_SOURCE_REFERENCE",
          drugId,
          field: `${itemType}.${itemId}`,
          message: `Clinical item '${itemId}' references sourceId '${sourceId}' which is not declared in the profile sources list.`,
        });
      }
    };

    if (profile.boxedWarning && profile.boxedWarning.present) {
      profilesWithBoxedWarning++;
      if (profile.boxedWarning.sourceId) {
        checkSourceRef(profile.boxedWarning.sourceId, "boxedWarning", "boxed_warning");
      }
    }

    if (profile.contraindications.length > 0) {
      profilesWithContraindications++;
      for (const contra of profile.contraindications) {
        checkSourceRef(contra.sourceId, "contraindications", contra.id);
        if (!contra.rationale || contra.rationale.trim().length === 0) {
          errors.push({
            severity: "error",
            code: "MISSING_CONTRAINDICATION_RATIONALE",
            drugId,
            field: `contraindications.${contra.id}`,
            message: `Contraindication '${contra.id}' must provide clinical rationale.`,
          });
        }
      }
    }

    if (profile.commonAdverseEffects.length > 0) {
      profilesWithAdverseEffects++;
      for (const ae of profile.commonAdverseEffects) {
        checkSourceRef(ae.sourceId, "commonAdverseEffects", ae.id);
        if (ae.evidenceBasis === "spontaneous_reporting" || ae.evidenceBasis === "faers") {
          errors.push({
            severity: "error",
            code: "PROHIBITED_SPONTANEOUS_INCIDENCE",
            drugId,
            field: `commonAdverseEffects.${ae.id}`,
            message: `Adverse effect '${ae.id}' impermissibly cites spontaneous reporting for incidence rate.`,
          });
        }
      }
    }

    for (const warn of profile.seriousAdverseEffectsAndWarnings) {
      checkSourceRef(warn.sourceId, "seriousAdverseEffectsAndWarnings", warn.id);
    }

    const { precautionsAndSpecialPopulations: psp } = profile;
    checkSourceRef(psp.pregnancy.sourceId, "precautions.pregnancy", "pregnancy");
    checkSourceRef(psp.lactation.sourceId, "precautions.lactation", "lactation");
    checkSourceRef(psp.renalImpairment.sourceId, "precautions.renalImpairment", "renalImpairment");
    checkSourceRef(psp.hepaticImpairment.sourceId, "precautions.hepaticImpairment", "hepaticImpairment");
    if (psp.geriatric) checkSourceRef(psp.geriatric.sourceId, "precautions.geriatric", "geriatric");
    if (psp.pediatric) checkSourceRef(psp.pediatric.sourceId, "precautions.pediatric", "pediatric");

    if (profile.dosageAndAdministrationContext && profile.dosageAndAdministrationContext.hasSpecificGuidance) {
      const dosage = profile.dosageAndAdministrationContext;
      checkSourceRef(dosage.sourceId, "dosageAndAdministrationContext", "dosage");
      if (!dosage.mandatoryDisclaimer || dosage.mandatoryDisclaimer.trim().length < 20) {
        errors.push({
          severity: "error",
          code: "MISSING_DOSAGE_DISCLAIMER",
          drugId,
          field: "dosageAndAdministrationContext.mandatoryDisclaimer",
          message: "Dosage context must include an explicit disclaimer.",
        });
      }
    }

    if (profile.adverseReactionGuidance.length === 0) {
      warnings.push({
        severity: "warning",
        code: "EMPTY_ADR_GUIDANCE",
        drugId,
        message: `Profile '${drugId}' has no structured ADR action guidance.`,
      });
    } else {
      for (const adr of profile.adverseReactionGuidance) {
        checkSourceRef(adr.sourceId, "adverseReactionGuidance", adr.id);
        if (!adr.symptomsOrTriggers || adr.symptomsOrTriggers.length === 0) {
          errors.push({
            severity: "error",
            code: "MISSING_ADR_TRIGGERS",
            drugId,
            field: `adverseReactionGuidance.${adr.id}`,
            message: `ADR guidance item '${adr.id}' has no trigger symptoms.`,
          });
        }
      }
    }

    if (profile.productScope.matchStatus === "ambiguous_or_combination_alias" && !profile.productScope.scopeNotes) {
      errors.push({
        severity: "error",
        code: "AMBIGUOUS_SCOPE_WITHOUT_NOTES",
        drugId,
        field: "productScope.scopeNotes",
        message: `Drug profile '${drugId}' is marked as ambiguous/combination alias but lacks explanatory scopeNotes.`,
      });
    }

    if (profile.dataCompleteness === "unavailable") {
      if (profile.contraindications.length > 0 || profile.commonAdverseEffects.length > 0) {
        errors.push({
          severity: "error",
          code: "CONTRADICTORY_COMPLETENESS_STATE",
          drugId,
          field: "dataCompleteness",
          message: `Drug profile '${drugId}' is marked 'unavailable' but contains populated clinical fields.`,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    totalProfiles: catalog.profiles.length,
    errors,
    warnings,
    stats: {
      profilesWithBoxedWarning,
      profilesWithContraindications,
      profilesWithAdverseEffects,
      totalSourcesCited,
    },
  };
}

function run() {
  console.log("================================================================================");
  console.log("       FARMA DDI CHECKER — INDIVIDUAL DRUG SAFETY CATALOG VALIDATOR (JS)");
  console.log("================================================================================\n");

  const catalogPath = path.join(__dirname, "..", "data", "individual-safety-pilot.json");
  const raw = fs.readFileSync(catalogPath, "utf8");
  const catalogData = JSON.parse(raw);

  console.log(`[1/2] Validating Pilot Catalog: ${catalogData.catalogName} (v${catalogData.catalogVersion})`);
  const result = validateSafetyCatalog(catalogData);

  console.log(`  - Total Profiles Analyzed: ${result.totalProfiles}`);
  console.log(`  - Profiles with Boxed Warnings: ${result.stats.profilesWithBoxedWarning}`);
  console.log(`  - Profiles with Contraindications: ${result.stats.profilesWithContraindications}`);
  console.log(`  - Profiles with Common Adverse Reactions: ${result.stats.profilesWithAdverseEffects}`);
  console.log(`  - Total Verifiable Sources Cited: ${result.stats.totalSourcesCited}`);

  if (result.errors.length > 0) {
    console.error(`\n[X] Validation FAILED with ${result.errors.length} error(s):`);
    result.errors.forEach(e => console.error(`    - [${e.code}] ${e.field ? '(' + e.field + ') ' : ''}${e.message}`));
    process.exit(1);
  } else {
    console.log("\n[✓] Pilot Catalog Structure, Type Safety, and Clinical Provenance: PASSED (0 Errors)\n");
  }

  // Regression Suite
  console.log("[2/2] Running Integrity Rule & Edge-Case Validation Suite:");

  // Test A: Duplicate Drug ID
  {
    const clone = JSON.parse(JSON.stringify(catalogData));
    clone.profiles.push({ ...clone.profiles[0] });
    const res = validateSafetyCatalog(clone);
    if (!res.errors.some(e => e.code === "DUPLICATE_DRUG_ID")) {
      console.error("  [X] FAILED: Duplicate canonical drug ID was not detected!");
      process.exit(1);
    }
    console.log("  [✓] Test A: Duplicate canonical ID detection passed.");
  }

  // Test B: Unresolved Source
  {
    const clone = JSON.parse(JSON.stringify(catalogData));
    clone.profiles[0].contraindications[0].sourceId = "non_existent_source_999";
    const res = validateSafetyCatalog(clone);
    if (!res.errors.some(e => e.code === "UNRESOLVED_SOURCE_REFERENCE")) {
      console.error("  [X] FAILED: Unresolved source reference was not caught!");
      process.exit(1);
    }
    console.log("  [✓] Test B: Unresolved source provenance detection passed.");
  }

  // Test C: Prohibition of Spontaneous FAERS Reporting
  {
    const clone = JSON.parse(JSON.stringify(catalogData));
    clone.profiles[0].commonAdverseEffects[0].evidenceBasis = "spontaneous_reporting";
    const res = validateSafetyCatalog(clone);
    if (res.valid) {
      console.error("  [X] FAILED: Spontaneous reporting incidence was not blocked!");
      process.exit(1);
    }
    console.log("  [✓] Test C: Prohibition of ungrounded spontaneous reporting incidence passed.");
  }

  // Test D: Missing Mandatory Disclaimer
  {
    const clone = JSON.parse(JSON.stringify(catalogData));
    clone.profiles[0].dosageAndAdministrationContext.mandatoryDisclaimer = "";
    const res = validateSafetyCatalog(clone);
    if (res.valid) {
      console.error("  [X] FAILED: Missing mandatory dosage disclaimer was not detected!");
      process.exit(1);
    }
    console.log("  [✓] Test D: Mandatory dosage prescription disclaimer enforcement passed.");
  }

  // Test E: Missing Optional Fields
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
      console.error("  [X] FAILED: Minimal profile failed validation:", res.errors);
      process.exit(1);
    }
    console.log("  [✓] Test E: Graceful handling of partial/missing optional fields passed.");
  }

  // Test F: Contradictory State
  {
    const clone = JSON.parse(JSON.stringify(catalogData));
    clone.profiles[0].dataCompleteness = "unavailable";
    const res = validateSafetyCatalog(clone);
    if (!res.errors.some(e => e.code === "CONTRADICTORY_COMPLETENESS_STATE")) {
      console.error("  [X] FAILED: Contradictory unavailable state was not flagged!");
      process.exit(1);
    }
    console.log("  [✓] Test F: Explicit partial/unavailable state consistency check passed.");
  }

  console.log("\n================================================================================");
  console.log("ALL SAFETY CATALOG VALIDATION AND INTEGRITY SUITES PASSED CLEANLY!");
  console.log("================================================================================\n");
}

run();
