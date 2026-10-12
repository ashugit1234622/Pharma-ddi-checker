import {
  SafetyCatalog,
  SafetyCatalogSchema,
  IndividualDrugSafetyProfile,
} from "./schema";

export interface ValidationIssue {
  severity: "error" | "warning";
  code: string;
  drugId?: string;
  field?: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  totalProfiles: number;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  stats: {
    profilesWithBoxedWarning: number;
    profilesWithContraindications: number;
    profilesWithAdverseEffects: number;
    totalSourcesCited: number;
  };
}

/**
 * Validates the safety catalog against structure, type, and clinical integrity rules.
 */
export function validateSafetyCatalog(catalogData: unknown): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  // 1. Zod Structural and Type Validation
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
  const seenDrugIds = new Set<string>();

  let profilesWithBoxedWarning = 0;
  let profilesWithContraindications = 0;
  let profilesWithAdverseEffects = 0;
  let totalSourcesCited = 0;

  // 2. Per-profile clinical and integrity rules
  for (const profile of catalog.profiles) {
    const { drugId } = profile;

    // Rule: Duplicate Canonical Drug ID Check
    if (seenDrugIds.has(drugId.toLowerCase())) {
      errors.push({
        severity: "error",
        code: "DUPLICATE_DRUG_ID",
        drugId,
        message: `Duplicate canonical drug ID '${drugId}' found in catalog.`,
      });
    }
    seenDrugIds.add(drugId.toLowerCase());

    // Rule: Source Provenance and Citation Check
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

    // Verify all source citations contain non-empty critical metadata
    for (const src of profile.sources) {
      if (!src.retrievalDate || !src.accessTermsAndLicensing || !src.referenceIdentifier) {
        errors.push({
          severity: "error",
          code: "INCOMPLETE_SOURCE_METADATA",
          drugId,
          field: `sources.${src.sourceId}`,
          message: `Source citation '${src.sourceId}' is missing mandatory provenance fields (retrievalDate, referenceIdentifier, or accessTermsAndLicensing).`,
        });
      }
    }

    // Rule: Clinical elements must refer to a valid sourceId present in profile.sources
    const checkSourceRef = (sourceId: string, itemType: string, itemId: string) => {
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

    // Boxed Warning
    if (profile.boxedWarning && profile.boxedWarning.present) {
      profilesWithBoxedWarning++;
      if (profile.boxedWarning.sourceId) {
        checkSourceRef(profile.boxedWarning.sourceId, "boxedWarning", "boxed_warning");
      }
    }

    // Contraindications
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

    // Common Adverse Effects
    if (profile.commonAdverseEffects.length > 0) {
      profilesWithAdverseEffects++;
      for (const ae of profile.commonAdverseEffects) {
        checkSourceRef(ae.sourceId, "commonAdverseEffects", ae.id);

        // Clinical Integrity Rule: Do not infer incidence from spontaneous reporting (FAERS)
        if (ae.evidenceBasis as string === "spontaneous_reporting" || ae.evidenceBasis as string === "faers") {
          errors.push({
            severity: "error",
            code: "PROHIBITED_SPONTANEOUS_INCIDENCE",
            drugId,
            field: `commonAdverseEffects.${ae.id}`,
            message: `Adverse effect '${ae.id}' impermissibly cites spontaneous reporting for incidence rate. Clinical trial or label data is required.`,
          });
        }
      }
    }

    // Serious Warnings
    for (const warn of profile.seriousAdverseEffectsAndWarnings) {
      checkSourceRef(warn.sourceId, "seriousAdverseEffectsAndWarnings", warn.id);
    }

    // Precautions & Special Populations
    const { precautionsAndSpecialPopulations: psp } = profile;
    checkSourceRef(psp.pregnancy.sourceId, "precautions.pregnancy", "pregnancy");
    checkSourceRef(psp.lactation.sourceId, "precautions.lactation", "lactation");
    checkSourceRef(psp.renalImpairment.sourceId, "precautions.renalImpairment", "renalImpairment");
    checkSourceRef(psp.hepaticImpairment.sourceId, "precautions.hepaticImpairment", "hepaticImpairment");
    if (psp.geriatric) checkSourceRef(psp.geriatric.sourceId, "precautions.geriatric", "geriatric");
    if (psp.pediatric) checkSourceRef(psp.pediatric.sourceId, "precautions.pediatric", "pediatric");

    // Dosage Guidance & Mandatory Disclaimer Check
    if (profile.dosageAndAdministrationContext && profile.dosageAndAdministrationContext.hasSpecificGuidance) {
      const dosage = profile.dosageAndAdministrationContext;
      checkSourceRef(dosage.sourceId, "dosageAndAdministrationContext", "dosage");

      if (!dosage.mandatoryDisclaimer || dosage.mandatoryDisclaimer.trim().length < 20) {
        errors.push({
          severity: "error",
          code: "MISSING_DOSAGE_DISCLAIMER",
          drugId,
          field: "dosageAndAdministrationContext.mandatoryDisclaimer",
          message: "Dosage context must include an explicit disclaimer stating that guidance is reference information only and not an individualized prescription.",
        });
      }
    }

    // Adverse Reaction Guidance
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

    // Product Scope & Ambiguity Verification
    if (profile.productScope.matchStatus === "ambiguous_or_combination_alias" && !profile.productScope.scopeNotes) {
      errors.push({
        severity: "error",
        code: "AMBIGUOUS_SCOPE_WITHOUT_NOTES",
        drugId,
        field: "productScope.scopeNotes",
        message: `Drug profile '${drugId}' is marked as ambiguous/combination alias but lacks explanatory scopeNotes.`,
      });
    }

    // Completeness state validation
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
