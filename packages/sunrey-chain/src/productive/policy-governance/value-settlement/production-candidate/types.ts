/**
 * Chunk 146 — MoonRey production-candidate GPUV → MoonRey conversion types.
 *
 * 1 GPUV is not 1 MoonRey. Unconfigured conversion fails closed.
 * Conversion authorization cannot mint. Chunk 71 remains the mint gate.
 */

import type { ProductiveCategory } from '../../../types.ts';
import { GPUV_UNIT, MOONREY_OUTPUT_ASSET, type ConversionRoundingRule } from '../types.ts';

export const MOONREY_PRODUCTION_CONVERSION_UNCONFIGURED = 'MOONREY_PRODUCTION_CONVERSION_UNCONFIGURED' as const;
export const PRODUCTION_CONVERSION_CANDIDATE_ID = 'moonrey.gpuv-settlement.production-candidate.v1' as const;
export const PRODUCTION_CONVERSION_CANDIDATE_DOMAIN = 'SUNREY_MOONREY_PRODUCTION_CONVERSION_CANDIDATE_V1' as const;
export const GPUV_EQUALS_MOONREY_BY_DEFINITION = false as const;
export const PRODUCTION_CONVERSION_SELECTED = false as const;
export const CONVERSION_AUTHORIZATION_CAN_MINT = false as const;

export const CANONICAL_MOONREY_ISSUANCE_CLASS = 'VERIFIED_PRODUCTIVE_CONTRIBUTION' as const;

export const FORBIDDEN_MOONREY_ISSUANCE_CLASSES = [
  'GOVERNED_ISSUANCE',
  'ADMIN_MINT',
  'TREASURY_MINT',
  'AI_MINT',
  'PROVIDER_MINT',
] as const;
export type ForbiddenMoonReyIssuanceClass = (typeof FORBIDDEN_MOONREY_ISSUANCE_CLASSES)[number];

export const PRODUCTION_CONVERSION_REJECTION_CODES = [
  MOONREY_PRODUCTION_CONVERSION_UNCONFIGURED,
  'GPUV_EQUALS_MOONREY_FORBIDDEN',
  'DENOMINATOR_ZERO',
  'FLOAT_MATH_FORBIDDEN',
  'PER_EVENT_CAP_EXCEEDED',
  'PER_OBJECT_CAP_EXCEEDED',
  'PER_CONTROLLER_CAP_EXCEEDED',
  'PER_CATEGORY_EPOCH_CAP_EXCEEDED',
  'GLOBAL_EPOCH_CAP_EXCEEDED',
  'MAXIMUM_SUPPLY_GUARD',
  'GENESIS_EXCEEDS_MAXIMUM_SUPPLY',
  'CONVERSION_CANNOT_BYPASS_MAXIMUM_SUPPLY',
  'EVENT_CAP_EXCEEDS_BROADER_CAP',
  'CONTROLLER_CAP_EXCEEDS_GLOBAL_CAP',
  'INCOMPLETE_EVIDENCE_CHAIN',
  'CONVERSION_AUTHORIZATION_CANNOT_MINT',
  'GPUV_RESULT_CANNOT_MINT',
  'REFERENCE_PRICE_ALONE_CANNOT_ISSUE',
  'FORBIDDEN_ISSUANCE_CLASS',
  'LEGACY_V1_CANNOT_QUALIFY_PRODUCTION',
  'FIXTURE_V2_CANNOT_QUALIFY_PRODUCTION',
  'AI_CANNOT_AUTHORIZE',
  'S3M_CANNOT_AUTHORIZE',
  'GROK_CANNOT_AUTHORIZE',
  'PROVIDER_CANNOT_AUTHORIZE',
  'PRODUCTION_CANDIDATE_CANNOT_ACTIVATE',
] as const;
export type ProductionConversionRejectionCode = (typeof PRODUCTION_CONVERSION_REJECTION_CODES)[number];

export type ProductionConversionOk<T> = {
  readonly ok: true;
  readonly value: T;
};

export type ProductionConversionRefusal = {
  readonly ok: false;
  readonly code: ProductionConversionRejectionCode;
  readonly detail: string;
};

export type ProductionConversionResult<T> = ProductionConversionOk<T> | ProductionConversionRefusal;

export function productionConversionOk<T>(value: T): ProductionConversionOk<T> {
  return Object.freeze({ ok: true, value });
}

export function productionConversionRefuse(
  code: ProductionConversionRejectionCode,
  detail: string,
): ProductionConversionRefusal {
  return Object.freeze({ ok: false, code, detail });
}

export type MoonReyProductionSettlementConversionPolicyCandidate = {
  readonly policyId: string;
  readonly policyVersion: number;
  readonly inputValueUnit: typeof GPUV_UNIT;
  readonly outputAsset: typeof MOONREY_OUTPUT_ASSET;
  readonly conversionNumerator: bigint | null;
  readonly conversionDenominator: bigint | null;
  readonly roundingRule: ConversionRoundingRule;
  readonly perContributionCeiling: bigint | null;
  readonly perEventCeiling: bigint | null;
  readonly perObjectCeiling: bigint | null;
  readonly perControllerCeiling: bigint | null;
  readonly perCategoryEpochCeiling: bigint | null;
  readonly globalEpochCeiling: bigint | null;
  readonly effectiveHeightCandidate: number;
  readonly supersededHeightCandidate: number | null;
  readonly governanceReference: string;
  readonly sourceClass: 'UNCONFIGURED' | 'PRODUCTION_CANDIDATE' | 'REHEARSAL_ONLY' | 'FIXTURE';
  readonly fixture: boolean;
  readonly productionActivated: false;
  readonly gpuvEqualsMoonReyByDefinition: false;
  readonly canMint: false;
};

export const REQUIRED_SETTLEMENT_EVIDENCE = [
  'verifiedContribution',
  'eventIdentity',
  'eventFingerprint',
  'normalizationReceipt',
  'attributionDecision',
  'productiveValueResult',
  'productiveValueDigest',
  'pvfPolicy',
  'conversionPolicy',
  'settlementAuthorization',
  'chunk71MonetaryEvidence',
] as const;
export type RequiredSettlementEvidenceKey = (typeof REQUIRED_SETTLEMENT_EVIDENCE)[number];

export type ProductionCandidateSettlementEvidence = {
  readonly verifiedContribution: boolean;
  readonly eventIdentity: boolean;
  readonly eventFingerprint: boolean;
  readonly normalizationReceipt: boolean;
  readonly attributionDecision: boolean;
  readonly productiveValueResult: boolean;
  readonly productiveValueDigest: boolean;
  readonly pvfPolicy: boolean;
  readonly conversionPolicy: boolean;
  readonly settlementAuthorization: boolean;
  readonly chunk71MonetaryEvidence: boolean;
};

export type ProductionCandidateUsage = {
  readonly eventIssued: bigint;
  readonly objectIssued: bigint;
  readonly controllerIssued: bigint;
  readonly categoryEpochIssued: bigint;
  readonly globalEpochIssued: bigint;
  readonly canonicalSupply: bigint;
  readonly category: ProductiveCategory;
};

export type ProductionCandidateConversionInput = {
  readonly gpuvQuantity: bigint;
  readonly policy: MoonReyProductionSettlementConversionPolicyCandidate;
  readonly usage?: ProductionCandidateUsage;
  readonly evidence?: Partial<ProductionCandidateSettlementEvidence>;
  readonly authorizedBy?: string;
  readonly valuePath?: string;
  readonly fixturePolicy?: boolean;
  readonly referencePriceAlone?: boolean;
  readonly issuanceClass?: string;
  readonly maximumSupply?: bigint | null;
  readonly candidateIssuance?: bigint;
};
