/**
 * Chunk 147 — Parameterized SunRey + MoonRey economic activation
 * rehearsal types.
 *
 * REHEARSAL ONLY. Fixture values have no production economic meaning.
 * NOT RECOMMENDED TOKENOMICS. NOT A PRODUCTION PROPOSAL.
 *
 * Extends packages/sunrey-chain/src/economic-rehearsal. Do not create
 * a second economic rehearsal owner.
 */

import type { ProductionEconomicActivationDecision } from '../../economics/production-activation/types.ts';
import type { NativeSupplySnapshot } from '../../economics/types.ts';

export const PARAMETERIZED_REHEARSAL_SCHEMA_VERSION = 1 as const;
export const PARAMETERIZED_REHEARSAL_TOOL_VERSION =
  'sunrey-launch/economic/parameterized-candidate/1' as const;
export const PARAMETER_CLASS = 'REHEARSAL_ONLY' as const;
export const REHEARSAL_FIXTURE_SOURCE = 'REHEARSAL_FIXTURE' as const;
export const NO_PRODUCTION_ECONOMIC_MEANING = 'NO_PRODUCTION_ECONOMIC_MEANING' as const;

export const PRODUCTION_PARAMETER_RECOMMENDATION = false as const;
export const PRODUCTION_AUTHORIZED = false as const;
export const FIXTURE_PARAMETERS = true as const;
export const LIVE_FLAGS_CHANGED = false as const;
export const EXCHANGE_PRICE_CONTROLS_ISSUANCE = false as const;
export const PEVE_USED_AS_SUNREY_FORMULA = false as const;
export const GPUV_EQUALS_MOONREY = false as const;
export const AI_PRODUCTION_AUTHORIZATION = false as const;
export const FIXTURE_PRODUCTION_AUTHORIZATION = false as const;

export const PARAMETERIZED_REHEARSAL_DISCLAIMER = Object.freeze({
  parameterClass: PARAMETER_CLASS,
  sourceClass: REHEARSAL_FIXTURE_SOURCE,
  fixture: true,
  rehearsalOnly: true,
  recommendedTokenomics: false,
  productionProposal: false,
  economicMeaningOutsideRehearsal: false,
  notes: [
    'NOT RECOMMENDED TOKENOMICS',
    'NOT A PRODUCTION PROPOSAL',
    'NO ECONOMIC MEANING OUTSIDE REHEARSAL',
    'NO_PRODUCTION_ECONOMIC_MEANING',
  ],
});

export type RehearsalFixtureMeta = {
  readonly sourceClass: typeof REHEARSAL_FIXTURE_SOURCE;
  readonly fixture: true;
  readonly rehearsalOnly: true;
};

export type RehearsalParameterValue<T> = RehearsalFixtureMeta & {
  readonly id: string;
  readonly value: T;
  readonly versionId: string;
};

export type RehearsalAllocationLine = RehearsalFixtureMeta & {
  readonly lineId: string;
  readonly assetId: 'SUNREY_COIN' | 'MOONREY_COIN';
  readonly category: string;
  readonly quantity: bigint;
  readonly destination: string;
};

export type RehearsalParameterPackage = RehearsalFixtureMeta & {
  readonly schemaVersion: typeof PARAMETERIZED_REHEARSAL_SCHEMA_VERSION;
  readonly packageId: string;
  readonly policyVersion: string;
  readonly disclaimer: typeof PARAMETERIZED_REHEARSAL_DISCLAIMER;
  readonly sunreyMaximumSupply: RehearsalParameterValue<bigint>;
  readonly moonreyMaximumSupply: RehearsalParameterValue<bigint>;
  readonly sunreyGenesisSupply: RehearsalParameterValue<bigint>;
  readonly moonreyGenesisSupply: RehearsalParameterValue<bigint>;
  readonly sunreyPostGenesisIssuancePolicy: RehearsalParameterValue<string>;
  readonly moonreyPostGenesisIssuancePolicy: RehearsalParameterValue<string>;
  readonly sunreyConversion: RehearsalParameterValue<{
    readonly numerator: bigint;
    readonly denominator: bigint;
    readonly perContributionCeiling: bigint;
    readonly perClassCeiling: bigint;
    readonly perEpochCeiling: bigint;
    readonly globalSupplyGuard: bigint;
  }>;
  readonly moonreyConversion: RehearsalParameterValue<{
    readonly numerator: bigint;
    readonly denominator: bigint;
    readonly perContributionCeiling: bigint;
    readonly perEventCeiling: bigint;
    readonly perObjectCeiling: bigint;
    readonly perControllerCeiling: bigint;
    readonly perCategoryEpochCeiling: bigint;
    readonly globalEpochCeiling: bigint;
    readonly globalSupplyGuard: bigint;
  }>;
  readonly sunreyPerPeriodCaps: RehearsalParameterValue<{
    readonly perContribution: bigint;
    readonly perClass: bigint;
    readonly perEpoch: bigint;
  }>;
  readonly moonreyPerPeriodCaps: RehearsalParameterValue<{
    readonly perEvent: bigint;
    readonly perObject: bigint;
    readonly perController: bigint;
    readonly perCategory: bigint;
    readonly globalEpoch: bigint;
  }>;
  readonly globalSupplyGuards: RehearsalParameterValue<{
    readonly sunrey: bigint;
    readonly moonrey: bigint;
  }>;
  readonly perClassCaps: RehearsalParameterValue<Readonly<Record<string, bigint>>>;
  readonly feePolicy: RehearsalParameterValue<string>;
  readonly burnPolicy: RehearsalParameterValue<string>;
  readonly genesisAllocation: RehearsalParameterValue<readonly RehearsalAllocationLine[]>;
  readonly requireFinalizedHinAnchor: RehearsalParameterValue<boolean>;
};

export type ParameterValidationUse = {
  readonly typeValidation: 'CHUNK_143_CLASSIFY_PARAMETER' | 'CHUNK_144_TYPE_VALIDATION';
  readonly dependencyValidation: 'CHUNK_143_PRODUCTION_PARAMETER_IDS' | 'CHUNK_144_DEPENDENCY_VALIDATION';
  readonly crossParameterInvariants: 'CHUNK_143_PLUS_CANDIDATE_INVARIANTS' | 'CHUNK_144_CROSS_PARAMETER';
  readonly canonicalHashing: 'CHUNK_143_PARAMETER_MANIFEST_HASH' | 'CHUNK_144_CANONICAL_HASH';
  readonly assetPolicyValidators:
    | 'CHUNK_112_AND_125_CONVERSION_VALIDATORS'
    | 'CHUNK_145_146_ASSET_POLICY_VALIDATORS';
  readonly chunk144Present: boolean;
  readonly chunk145Present: boolean;
  readonly chunk146Present: boolean;
};

export type ParameterValidationResult = {
  readonly ok: boolean;
  readonly packageHash: string;
  readonly productionParameterHash: string;
  readonly sunreyPolicyHash: string;
  readonly moonreyPolicyHash: string;
  readonly typeValid: boolean;
  readonly dependenciesValid: boolean;
  readonly crossParameterValid: boolean;
  readonly genesisTotalsExact: boolean;
  readonly hiddenPremint: false;
  readonly faucetMigration: false;
  readonly applicationLedgerMigration: false;
  readonly usedValidators: ParameterValidationUse;
  readonly refusals: readonly string[];
};

export type SupplyView = {
  readonly assetId: 'SUNREY_COIN' | 'MOONREY_COIN';
  readonly genesis: bigint;
  readonly issued: bigint;
  readonly burned: bigint;
  readonly circulating: bigint;
  readonly locked: bigint;
  readonly escrowed: bigint;
  readonly feeReserved: bigint;
  readonly expected: bigint;
  readonly observed: bigint;
  readonly reconciled: boolean;
};

export type ReceiptRecord = {
  readonly receiptId: string;
  readonly assetId: 'SUNREY_COIN' | 'MOONREY_COIN';
  readonly quantity: bigint;
  readonly policyVersion: string;
  readonly conversionVersion: string;
  readonly sourceId: string;
  readonly fingerprint: string;
};

export type SunReyPathResult = {
  readonly complete: boolean;
  readonly steps: readonly string[];
  readonly issued: bigint;
  readonly receipts: readonly ReceiptRecord[];
  readonly syntheticHumanDataOnly: true;
  readonly peveUsedAsSunReyFormula: false;
  readonly hinConsentRevoked: boolean;
  readonly hinAnchorFinalized: boolean;
  readonly hinOutageBlockedIssuance: boolean;
};

export type MoonReyPathResult = {
  readonly complete: boolean;
  readonly v2Primary: true;
  readonly v1Primary: false;
  readonly categories: readonly string[];
  readonly issued: bigint;
  readonly receipts: readonly ReceiptRecord[];
  readonly gpuvEqualsMoonRey: false;
  readonly categoryConcentration: Readonly<Record<string, bigint>>;
  readonly controllerIssued: Readonly<Record<string, bigint>>;
  readonly oracleOutageBlockedNewFacts: boolean;
  readonly existingSupplyUnchangedAfterOutage: boolean;
};

export type SharedEventResult = {
  readonly humanContributionId: string;
  readonly productiveEventId: string;
  readonly humanFingerprint: string;
  readonly productiveFingerprint: string;
  readonly lineagePreserved: true;
  readonly attributionPreserved: true;
  readonly doubleIssued: false;
  readonly forcedSplit: false;
};

export type ExchangeRehearsalResult = {
  readonly marketId: string;
  readonly baseAsset: 'SUNREY_COIN';
  readonly quoteAsset: 'MOONREY_COIN';
  readonly ordersEntered: number;
  readonly partialFills: number;
  readonly trades: number;
  readonly dvpSettled: number;
  readonly custodyAttributed: boolean;
  readonly reconciled: boolean;
  readonly noPeg: true;
  readonly noGuaranteedRatio: true;
  readonly duplicateDvpRejected: boolean;
  readonly inventedTicker: false;
};

export type PolicyUpgradeResult = {
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly historicalReceiptsStable: boolean;
  readonly newIssuanceUsesNewVersion: boolean;
  readonly retroactiveRecompute: false;
  readonly conversionChangeNonRetroactive: boolean;
  readonly maxSupplyTighteningRejected: boolean;
  readonly existingBalancesUnburned: boolean;
};

export type ReplayResult = {
  readonly humanReplayRejected: boolean;
  readonly productiveReplayRejected: boolean;
  readonly dvpReplayRejected: boolean;
  readonly genesisReplayRejected: boolean;
  readonly doubleIssuance: false;
};

export type CorrectionResult = {
  readonly humanRevaluationRequiresReview: boolean;
  readonly productiveRevaluationRequiresReview: boolean;
  readonly attributionCorrectionRequiresReview: boolean;
  readonly silentRemint: false;
  readonly arbitraryClawback: false;
};

export type StressScenarioResult = {
  readonly scenarioId: string;
  readonly title: string;
  readonly held: boolean;
  readonly accountingPreserved: boolean;
  readonly notes: string;
};

export type ParameterizedDualEconomyRehearsalReportFields = {
  readonly schemaVersion: typeof PARAMETERIZED_REHEARSAL_SCHEMA_VERSION;
  readonly toolVersion: typeof PARAMETERIZED_REHEARSAL_TOOL_VERSION;
  readonly parameterClass: typeof PARAMETER_CLASS;
  readonly parameterPackageHash: string;
  readonly sunreyPolicyHash: string;
  readonly moonreyPolicyHash: string;
  readonly sunreyIssued: bigint;
  readonly moonreyIssued: bigint;
  readonly sunreySupply: SupplyView;
  readonly moonreySupply: SupplyView;
  readonly sunreySupplyReconciled: boolean;
  readonly moonreySupplyReconciled: boolean;
  readonly exchangeReconciled: boolean;
  readonly epochReconciliations: readonly {
    readonly epoch: number;
    readonly sunreyReconciled: boolean;
    readonly moonreyReconciled: boolean;
  }[];
  readonly stressScenarios: readonly StressScenarioResult[];
  readonly stressFailures: readonly string[];
  readonly policyUpgradeResults: PolicyUpgradeResult;
  readonly replayResults: ReplayResult;
  readonly correctionResults: CorrectionResult;
  readonly firewallBefore: ProductionEconomicActivationDecision;
  readonly firewallAfter: ProductionEconomicActivationDecision;
  readonly productionAuthorized: false;
  readonly fixtureParameters: true;
  readonly liveFlagsChanged: false;
  readonly environment: 'simulation';
  readonly productionActive: false;
  readonly exchangePriceControlsIssuance: false;
  readonly peveUsedAsSunReyFormula: false;
  readonly gpuvEqualsMoonRey: false;
  readonly fixtureCanAuthorizeProduction: false;
  readonly sunreyPathComplete: boolean;
  readonly moonreyV2PathComplete: boolean;
  readonly suppliesReconciled: boolean;
  readonly usedValidators: ParameterValidationUse;
  readonly snapshots: readonly NativeSupplySnapshot[];
};
