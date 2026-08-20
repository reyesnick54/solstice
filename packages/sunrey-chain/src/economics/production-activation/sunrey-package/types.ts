/**
 * Chunk 145 — SunRey production issuance parameter package.
 *
 * Assembled under the Chunk 143/144 production parameter framework.
 * Does not select production quantities or activate issuance.
 */

import type { SunReyIssuanceClass } from '../../types.ts';
import type { ProductionParameterRecord } from '../types.ts';
import type { SunReyProductionSettlementConversionPolicyCandidate } from '../../human-contribution-bridge/production-candidate/types.ts';
import type { HumanContributionProductionValuationPolicyCandidate } from '../../../../../human-economic-contribution/src/valuation/production-candidate/types.ts';

export const SUNREY_PRODUCTION_ISSUANCE_PACKAGE_ID =
  'sunrey.economics.production-issuance-parameter-package.v1' as const;
export const SUNREY_PRODUCTION_ISSUANCE_PACKAGE_SCHEMA_VERSION = 1 as const;
export const CHUNK_71_REMAINS_MONETARY_AUTHORITY = true as const;
export const CANDIDATE_PACKAGE_CAN_MINT = false as const;
export const PRODUCTION_ACTIVATED = false as const;
export const REHEARSAL_FIXTURE = 'REHEARSAL_FIXTURE' as const;
export const NO_PRODUCTION_ECONOMIC_MEANING = 'NO_PRODUCTION_ECONOMIC_MEANING' as const;

export type NumericPolicyValue =
  | { readonly status: 'UNCONFIGURED'; readonly value: null }
  | { readonly status: 'CONFIGURED'; readonly value: bigint };

export type PolicyVersionBinding = {
  readonly key: string;
  readonly versionId: string;
  readonly contentHash: string;
};

export type SunReyPostGenesisIssuancePolicyCandidate = {
  readonly policyId: string;
  readonly version: string;
  readonly authorizedIssuanceClasses: readonly SunReyIssuanceClass[];
  readonly unrestrictedIssuance: false;
  readonly rightsRequirement: true;
  readonly verificationRequirement: true;
  readonly valuationRequirement: true;
  readonly settlementAuthorizationRequirement: true;
  readonly hinConsentAloneInsufficient: true;
  readonly usageReceiptAloneInsufficient: true;
  readonly cleanRoomAloneInsufficient: true;
  readonly informationAssetAloneInsufficient: true;
  readonly chainAnchorIsNotEconomicVerification: true;
  readonly replayPolicy: 'REJECT_DUPLICATE_CONTRIBUTION_VALUATION_AUTHORIZATION';
  readonly capPolicy: 'MOST_RESTRICTIVE';
  readonly supplyGuard: 'MAXIMUM_SUPPLY_CANNOT_BE_BYPASSED';
  readonly correctionsRequireExplicitAdjustment: true;
  readonly clawbackForbidden: true;
  readonly historicalSettlementAuditable: true;
  readonly retroactivePolicyChangeForbidden: true;
  readonly productionActivated: false;
};

export type SunReyProductionIssuanceParameterPackage = {
  readonly packageId: typeof SUNREY_PRODUCTION_ISSUANCE_PACKAGE_ID;
  readonly schemaVersion: typeof SUNREY_PRODUCTION_ISSUANCE_PACKAGE_SCHEMA_VERSION;
  readonly maximumSupply: NumericPolicyValue;
  readonly genesisSupply: NumericPolicyValue;
  readonly postGenesisIssuancePolicy: SunReyPostGenesisIssuancePolicyCandidate;
  readonly contributionToSettlementConversion: SunReyProductionSettlementConversionPolicyCandidate;
  readonly valuationPolicy: HumanContributionProductionValuationPolicyCandidate;
  readonly perPeriodCaps: NumericPolicyValue;
  readonly perClassCaps: NumericPolicyValue;
  readonly globalSupplyGuards: NumericPolicyValue;
  readonly genesisAllocationManifestRef: PolicyVersionBinding;
  readonly feePolicyRef: PolicyVersionBinding;
  readonly burnPolicyRef: PolicyVersionBinding;
  readonly bindings: readonly PolicyVersionBinding[];
  readonly sourceClass: 'UNCONFIGURED' | 'FIXTURE' | 'REHEARSAL' | 'GOVERNED_PRODUCTION_PARAMETER';
  readonly fixture: boolean;
  readonly rehearsalOnly: true;
  readonly productionActivated: false;
  readonly chunk71RemainsMonetaryAuthority: true;
  readonly candidatePackageCanMint: false;
  readonly fixtureAuthorizesProduction: false;
  readonly rehearsalFixtureLabel: typeof REHEARSAL_FIXTURE | null;
  readonly economicMeaning: typeof NO_PRODUCTION_ECONOMIC_MEANING | 'UNCONFIGURED';
  readonly packageHash: string;
};

export type SunReyProductionPolicyCandidateReadiness = {
  readonly ontologyReady: boolean;
  readonly verificationReady: boolean;
  readonly rightsReady: boolean;
  readonly valuationStructureReady: boolean;
  readonly valuationValuesConfigured: boolean;
  readonly conversionStructureReady: boolean;
  readonly conversionValuesConfigured: boolean;
  readonly supplyParametersConfigured: boolean;
  readonly capsConfigured: boolean;
  readonly governanceEvidenceReady: boolean;
  readonly externalEvidenceReady: boolean;
  readonly humanAuthorizationReady: boolean;
  readonly productionActivated: false;
};

export type PackageValidationFailureCode =
  | 'GENESIS_EXCEEDS_MAXIMUM_SUPPLY'
  | 'POST_GENESIS_EXCEEDS_MAXIMUM_SUPPLY'
  | 'PERIOD_CAP_BYPASSES_GLOBAL_MAXIMUM'
  | 'CONTRIBUTION_CAP_BYPASSES_EPOCH_CAP'
  | 'CLASS_CAP_BYPASSES_GLOBAL_GUARD'
  | 'BINDING_LATEST_REJECTED'
  | 'UNRESTRICTED_ISSUANCE_FORBIDDEN'
  | 'FIXTURE_CANNOT_AUTHORIZE_PRODUCTION'
  | 'CANDIDATE_PACKAGE_CANNOT_MINT'
  | 'VALUES_UNCONFIGURED'
  | 'SUPPLY_BOOK_MUTATION_FORBIDDEN';

export type PackageValidationFailure = {
  readonly ok: false;
  readonly code: PackageValidationFailureCode;
  readonly message: string;
};

export type PackageValidationSuccess = {
  readonly ok: true;
  readonly package: SunReyProductionIssuanceParameterPackage;
  readonly parameters: readonly ProductionParameterRecord[];
  readonly readiness: SunReyProductionPolicyCandidateReadiness;
  readonly mutatedSupplyBook: false;
};

export type PackageValidationResult = PackageValidationSuccess | PackageValidationFailure;

export function packageFailure(code: PackageValidationFailureCode, message: string): PackageValidationFailure {
  return Object.freeze({ ok: false, code, message });
}
