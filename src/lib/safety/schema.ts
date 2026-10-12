import { z } from "zod";

/**
 * Product & formulation matching status enum.
 */
export const ProductMatchStatusEnum = z.enum([
  "exact_formulation",
  "active_ingredient_monotherapy",
  "ambiguous_or_combination_alias",
  "unspecified"
]);
export type ProductMatchStatus = z.infer<typeof ProductMatchStatusEnum>;

/**
 * Explicit completeness state for drug safety records.
 */
export const DataCompletenessStatusEnum = z.enum([
  "available",
  "partial",
  "unavailable",
  "ambiguous"
]);
export type DataCompletenessStatus = z.infer<typeof DataCompletenessStatusEnum>;

/**
 * Regulatory & statutory document types.
 */
export const SourceDocumentTypeEnum = z.enum([
  "fda_spl_label",
  "cdsco_package_insert",
  "national_formulary",
  "pharmacopoeia",
  "peer_reviewed_monograph"
]);
export type SourceDocumentType = z.infer<typeof SourceDocumentTypeEnum>;

/**
 * Verifiable source citation metadata.
 */
export const SourceCitationSchema = z.object({
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
export type SourceCitation = z.infer<typeof SourceCitationSchema>;

/**
 * Formulation scope definition.
 */
export const ProductScopeSchema = z.object({
  matchStatus: ProductMatchStatusEnum,
  formulationDescription: z.string().min(1),
  scopeNotes: z.string().optional(),
});
export type ProductScope = z.infer<typeof ProductScopeSchema>;

/**
 * Contraindication structure.
 */
export const ContraindicationCategoryEnum = z.enum(["absolute", "relative"]);
export const VerificationStatusEnum = z.enum([
  "verified_labeling",
  "statutory_formulary",
  "unverified"
]);

export const ContraindicationItemSchema = z.object({
  id: z.string().min(1),
  clinicalCondition: z.string().min(1),
  category: ContraindicationCategoryEnum,
  rationale: z.string().min(1),
  sourceId: z.string().min(1),
  verificationStatus: VerificationStatusEnum,
});
export type ContraindicationItem = z.infer<typeof ContraindicationItemSchema>;

/**
 * Adverse effects with strict evidence-based frequency categories.
 */
export const FrequencyCategoryEnum = z.enum([
  "very_common", // >= 10%
  "common",      // 1% to 10%
  "uncommon",    // 0.1% to 1%
  "rare",        // < 0.1%
  "frequency_not_quantified"
]);

export const AdverseEffectBasisEnum = z.enum([
  "clinical_trials",
  "product_labeling",
  "systematic_review"
]);

export const AdverseEffectItemSchema = z.object({
  id: z.string().min(1),
  reaction: z.string().min(1),
  frequencyRange: z.string().min(1),
  frequencyCategory: FrequencyCategoryEnum,
  systemOrganClass: z.string().min(1),
  sourceId: z.string().min(1),
  evidenceBasis: AdverseEffectBasisEnum,
});
export type AdverseEffectItem = z.infer<typeof AdverseEffectItemSchema>;

/**
 * Serious warnings & boxed warnings.
 */
export const WarningSeverityEnum = z.enum(["critical", "high", "moderate"]);

export const SeriousWarningItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  severity: WarningSeverityEnum,
  monitoringRecommendations: z.array(z.string()).optional(),
  sourceId: z.string().min(1),
});
export type SeriousWarningItem = z.infer<typeof SeriousWarningItemSchema>;

export const BoxedWarningSchema = z.object({
  present: z.boolean(),
  title: z.string().optional(),
  summary: z.string().optional(),
  riskFactors: z.array(z.string()).optional(),
  sourceId: z.string().optional(),
}).nullable();
export type BoxedWarning = z.infer<typeof BoxedWarningSchema>;

/**
 * Precautions and special populations.
 */
export const PopulationRiskStatusEnum = z.enum([
  "contraindicated",
  "caution_potential_benefit",
  "caution",
  "compatible",
  "unestablished"
]);

export const SpecialPopulationsSchema = z.object({
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
export type SpecialPopulations = z.infer<typeof SpecialPopulationsSchema>;

/**
 * Dosage and administration reference context.
 */
export const DosageContextSchema = z.object({
  hasSpecificGuidance: z.boolean(),
  route: z.string().min(1),
  standardAdultContext: z.string().min(1),
  maxCeilingDose: z.string().min(1),
  titrationGuidance: z.string().optional(),
  mandatoryDisclaimer: z.string().min(1),
  sourceId: z.string().min(1),
}).nullable();
export type DosageContext = z.infer<typeof DosageContextSchema>;

/**
 * Actionable adverse drug reaction (ADR) guidance.
 */
export const AdrUrgencyEnum = z.enum([
  "emergency_immediate_care",
  "urgent_physician_consult",
  "routine_clinical_monitoring"
]);

export const AdrActionGuidanceItemSchema = z.object({
  id: z.string().min(1),
  urgency: AdrUrgencyEnum,
  symptomsOrTriggers: z.array(z.string().min(1)).min(1),
  recommendedAction: z.string().min(1),
  clinicalRationale: z.string().min(1),
  sourceId: z.string().min(1),
});
export type AdrActionGuidanceItem = z.infer<typeof AdrActionGuidanceItemSchema>;

/**
 * Complete Individual Drug Safety Profile Schema.
 */
export const IndividualDrugSafetyProfileSchema = z.object({
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
export type IndividualDrugSafetyProfile = z.infer<typeof IndividualDrugSafetyProfileSchema>;

/**
 * Top-level catalog wrapper schema.
 */
export const SafetyCatalogSchema = z.object({
  catalogVersion: z.string().min(1),
  catalogName: z.string().min(1),
  lastUpdated: z.string().min(1),
  description: z.string().min(1),
  profiles: z.array(IndividualDrugSafetyProfileSchema),
});
export type SafetyCatalog = z.infer<typeof SafetyCatalogSchema>;
