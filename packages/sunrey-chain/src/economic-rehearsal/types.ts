/**
 * Chunk 80 — SunRey Economic Mainnet Rehearsal types.
 *
 * This is a production-like economic dry run. It does not activate
 * SunRey mainnet, customer funds, live Exchange, live custody, or
 * LIVE_* flags.
 */

import type { LaunchControlRoomState, LaunchPhase, RehearsalFinding } from '../launch-rehearsal/types.ts';
import type { TraceConformanceResult } from '../formal/types.ts';

export const ECONOMIC_REHEARSAL_SCHEMA_VERSION = 1 as const;
export const ECONOMIC_REHEARSAL_TOOL_VERSION = 'sunrey-launch/economic/1' as const;

export const REHEARSAL_ONLY = 'REHEARSAL_ONLY' as const;
export const NO_PRODUCTION_VALUE = 'NO_PRODUCTION_VALUE' as const;
export const PRODUCTION_UNAUTHORIZED = false;

export const ECONOMIC_REHEARSAL_RESULT_STATES = [
  'ECONOMIC_REHEARSAL_INCOMPLETE',
  'ECONOMIC_REHEARSAL_COMPLETED_WITH_FINDINGS',
  'ECONOMIC_ENGINEERING_REHEARSAL_QUALIFIED',
] as const;
export type EconomicRehearsalResultState = (typeof ECONOMIC_REHEARSAL_RESULT_STATES)[number];

export const ECONOMIC_CONTROL_ROOM_GATES = [
  'monetaryPolicyReady',
  'sunreySupplyReady',
  'moonreySupplyReady',
  'feesReady',
  'validatorEconomicsReady',
  'oracleHealthReady',
  'productiveIssuanceReady',
  'treasuryReady',
  'exchangeReady',
  'economicRcReady',
  'economicStressReady',
  'activeGovernanceVersionReady',
] as const;
export type EconomicControlRoomGate = (typeof ECONOMIC_CONTROL_ROOM_GATES)[number];

export type EconomicLaunchControlRoomState = LaunchControlRoomState & {
  readonly monetaryPolicyReady: boolean;
  readonly sunreySupplyReady: boolean;
  readonly moonreySupplyReady: boolean;
  readonly feesReady: boolean;
  readonly validatorEconomicsReady: boolean;
  readonly oracleHealthReady: boolean;
  readonly productiveIssuanceReady: boolean;
  readonly treasuryReady: boolean;
  readonly exchangeReady: boolean;
  readonly economicRcReady: boolean;
  readonly economicStressReady: boolean;
  readonly activeGovernanceVersionReady: boolean;
  readonly activeGovernanceVersion: string;
  readonly economicPhase: LaunchPhase;
};

export type RehearsalAllocationLine = {
  readonly lineId: string;
  readonly asset: 'SUNREY_COIN' | 'MOONREY_COIN';
  readonly category: string;
  readonly quantityMinorUnits: bigint;
  readonly destination: string;
  readonly classification: typeof REHEARSAL_ONLY;
  readonly productionValue: typeof NO_PRODUCTION_VALUE;
};

export type RehearsalAllocationManifest = {
  readonly schemaVersion: 1;
  readonly policyVersion: 'sunrey.allocation.economic-rehearsal.v1';
  readonly productionAllocationAuthorized: false;
  readonly inheritedTestnetFaucet: false;
  readonly migratedApplicationLedgerBalances: false;
  readonly wrappedFiat: false;
  readonly hiddenPremint: false;
  readonly lines: readonly RehearsalAllocationLine[];
  readonly totalByAsset: { readonly SUNREY_COIN: bigint; readonly MOONREY_COIN: bigint };
  readonly classification: typeof REHEARSAL_ONLY;
  readonly productionValue: typeof NO_PRODUCTION_VALUE;
  readonly notes: string;
};

export type PolicyHashRecord = {
  readonly name: string;
  readonly version: string;
  readonly hash: string;
};

export type EconomicRcBundle = {
  readonly rcId: typeof import('./identity.ts').ECONOMIC_RC_ID | string;
  readonly sourceCommit: string;
  readonly protocolVersion: string;
  readonly manifestHash: string;
  readonly releaseSignatureVerified: boolean;
  readonly policyHashes: readonly PolicyHashRecord[];
  readonly qualificationEvidence: readonly string[];
  readonly productionAuthorized: false;
  readonly ok: boolean;
  readonly canonicalEconomicRcId?: string;
  readonly canonicalQualificationDigest?: string;
  readonly canonicalStressReportHash?: string;
  readonly canonicalTreasuryPolicyHash?: string;
};

export type IntegratedEconomicEvidenceHashes = {
  readonly chunk76StressReportHash: string;
  readonly chunk77TreasuryPolicyHash: string;
  readonly chunk77TreasuryFormalHash: string;
  readonly chunk77TreasuryStressHash: string;
  readonly chunk78EconomicRcHash: string;
  readonly chunk79GovernancePackageHash: string;
};

export type EconomicGenesisBundle = {
  readonly genesisHash: string;
  readonly validatorSetHash: string;
  readonly allocationHash: string;
  readonly policyHashes: readonly PolicyHashRecord[];
  readonly verification: {
    readonly ok: boolean;
    readonly checks: readonly { readonly id: string; readonly ok: boolean; readonly detail: string }[];
  };
};

export type SupplyAuditResult = {
  readonly asset: 'SUNREY_COIN' | 'MOONREY_COIN';
  readonly genesis: bigint;
  readonly issuedPostGenesis: bigint;
  readonly burned: bigint;
  readonly circulating: bigint;
  readonly locked: bigint;
  readonly expectedTotal: bigint;
  readonly observedTotal: bigint;
  readonly exact: boolean;
  readonly classification: typeof REHEARSAL_ONLY;
};

export type FeeRehearsalResult = {
  readonly normalUtilization: boolean;
  readonly highUtilization: boolean;
  readonly pqHeavy: boolean;
  readonly exchangeHeavy: boolean;
  readonly oracleHeavy: boolean;
  readonly basePriceEvolved: boolean;
  readonly maxFeeProtection: boolean;
  readonly validatorReward: bigint;
  readonly burned: bigint;
  readonly treasury: bigint;
  readonly charged: bigint;
  readonly dispositionExact: boolean;
  readonly productionParametersConfigured: false;
};

export type ValidatorEconomicsResult = {
  readonly bondedValidators: 7;
  readonly rewardEpochs: number;
  readonly participationRecorded: boolean;
  readonly oneTimeEntitlement: boolean;
  readonly penaltyApplied: boolean;
  readonly bondAffected: boolean;
  readonly customerAssetsUnaffected: boolean;
  readonly evidenceUsedOnce: boolean;
  readonly jailed: boolean;
  readonly unbondDelayHonored: boolean;
  readonly supplyReconciled: boolean;
  readonly productionBondAsset: 'UNCONFIGURED';
  readonly units: typeof REHEARSAL_ONLY;
};

export type MoonReyIssuanceResult = {
  readonly categoriesExercised: readonly string[];
  readonly observationToReceipt: boolean;
  readonly eligibilityHonored: boolean;
  readonly normalizationHonored: boolean;
  readonly duplicateRejected: boolean;
  readonly crossCategoryDuplicateRejected: boolean;
  readonly capacityOutputDuplicateRejected: boolean;
  readonly issued: bigint;
  readonly supplyExact: boolean;
  readonly productionAuthorized: false;
};

export type TreasuryRehearsalResult = {
  readonly feeFunding: bigint;
  readonly budget: bigint;
  readonly reserved: bigint;
  readonly disbursed: bigint;
  readonly cancelled: bigint;
  readonly returned: bigint;
  readonly remaining: bigint;
  readonly duplicateDisbursementRejected: boolean;
  readonly customerWalletIsolated: boolean;
  readonly custodyIsolated: boolean;
  readonly exchangeObligationsIsolated: boolean;
  readonly fiatLedgerIsolated: boolean;
  readonly reconciled: boolean;
  readonly productionAuthorized: false;
};

export type ExchangeRehearsalResult = {
  readonly marketId: 'SUNREY_COIN / MOONREY_COIN';
  readonly orderEntry: boolean;
  readonly partialFill: boolean;
  readonly multipleTrades: boolean;
  readonly atomicDvp: boolean;
  readonly settlementFinal: boolean;
  readonly custodyAttributed: boolean;
  readonly noPeg: true;
  readonly noGuaranteedRatio: true;
  readonly duplicateDvpRejected: boolean;
  readonly reconciled: boolean;
  readonly productionExchangeActivated: false;
};

export type MachineCommerceResult = {
  readonly aiToCompute: boolean;
  readonly robotToEnergy: boolean;
  readonly factoryToLogistics: boolean;
  readonly automatedServiceToStorage: boolean;
  readonly humanMachineBridge: boolean;
  readonly syntheticHumanDataOnly: true;
  readonly settled: boolean;
};

export type GovernanceRehearsalResult = {
  readonly rehearsalApprovalsValidOnlyHere: true;
  readonly feePolicyUpgrade: {
    readonly oldVersion: string;
    readonly newVersion: string;
    readonly activated: boolean;
    readonly historicalReceiptsValid: boolean;
  };
  readonly moonreyPolicyUpgrade: {
    readonly oldVersion: string;
    readonly newVersion: string;
    readonly activated: boolean;
  };
  readonly treasuryPolicyUpgrade: {
    readonly oldVersion: string;
    readonly newVersion: string;
    readonly activated: boolean;
  };
  readonly productionAuthorized: false;
};

export type RehearsalStressFinding = {
export type RehearsalStressFinding = EconomicRehearsalStressFinding;
export type EconomicRehearsalStressFinding = {
export type EconomicStressFinding = {
  readonly findingId: string;
  readonly scenario: string;
  readonly severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly accountingSafe: boolean;
  readonly description: string;
  readonly becomesMainnetBlocker: boolean;
};
export type EconomicRehearsalStressFinding = RehearsalStressFinding;

export type RehearsalStressResult = {
export type RehearsalStressFinding = EconomicRehearsalStressFinding;

export type EconomicRehearsalStressFinding = RehearsalStressFinding;

export type RehearsalStressResult = {
export type RehearsalStressResult = EconomicRehearsalStressResult;
export type EconomicRehearsalStressResult = {
export type EconomicStressResult = {
  readonly oracleDegradation: boolean;
  readonly liquidityStress: boolean;
  readonly networkCongestion: boolean;
  readonly validatorFailure: boolean;
  readonly productiveConcentration: boolean;
  readonly treasuryFundingPressure: boolean;
  readonly custodyDelay: boolean;
  readonly compoundEnergyOracleLiquidityCongestion: boolean;
  readonly accountingSafe: boolean;
  readonly findings: readonly RehearsalStressFinding[];
  readonly chunk76CampaignId?: string;
  readonly chunk76ReportHash?: string;
  readonly chunk76Violations?: number;
};
export type RehearsalStressResult = EconomicRehearsalStressResult;

export type EconomicRehearsalStressResult = RehearsalStressResult;

export type RecoveryResult = {
  readonly scenario: string;
  readonly injected: boolean;
  readonly recovered: boolean;
  readonly safetyHolds: boolean;
  readonly notes: string;
};

export type ExplorerRebuildResult = {
  readonly banner: typeof import('./identity.ts').ECONOMIC_REHEARSAL_BANNER | string;
  readonly productionLabel: false;
  readonly supplyReproduced: boolean;
  readonly feesReproduced: boolean;
  readonly validatorEconomicsReproduced: boolean;
  readonly moonreyIssuanceReproduced: boolean;
  readonly treasuryReproduced: boolean;
};

export type EconomicActivationEvidenceBundle = {
  readonly schemaVersion: 1;
  readonly rehearsalId: string;
  readonly displayName: typeof import('./identity.ts').ECONOMIC_REHEARSAL_DISPLAY_NAME | string;
  readonly sourceCommit: string;
  readonly economicRc: EconomicRcBundle;
  readonly rehearsalGenesisHash: string;
  readonly policyHashes: readonly PolicyHashRecord[];
  readonly validatorTopology: {
    readonly validatorCount: 7;
    readonly sentryCount: 14;
    readonly failureDomains: readonly string[];
  };
  readonly formalResults: readonly TraceConformanceResult[];
  readonly stressResults: RehearsalStressResult;
  readonly stressResults: EconomicRehearsalStressResult;
  readonly stressResults: EconomicStressResult;
  readonly supplyAudits: readonly SupplyAuditResult[];
  readonly treasuryAudit: TreasuryRehearsalResult;
  readonly exchangeReconciliation: ExchangeRehearsalResult;
  readonly recoveryResults: readonly RecoveryResult[];
  readonly governanceRehearsal: GovernanceRehearsalResult;
  readonly knownLimitations: readonly string[];
  readonly productionAuthorized: false;
  readonly liveFlagsRemainDisabled: true;
  readonly integratedEvidenceHashes?: IntegratedEconomicEvidenceHashes;
};

export type EconomicMainnetRehearsalReport = {
  readonly schemaVersion: 1;
  readonly toolVersion: typeof ECONOMIC_REHEARSAL_TOOL_VERSION;
  readonly rehearsalId: string;
  readonly displayName: typeof import('./identity.ts').ECONOMIC_REHEARSAL_DISPLAY_NAME | string;
  readonly sourceCommit: string;
  readonly economicRc: EconomicRcBundle;
  readonly rehearsalGenesis: {
    readonly networkId: string;
    readonly chainId: string;
    readonly genesisHash: string;
    readonly addressHrp: string;
    readonly networkClass: 'REHEARSAL';
    readonly allocationHash: string;
  };
  readonly validatorCount: 7;
  readonly sentryCount: 14;
  readonly failureDomains: readonly string[];
  readonly sunreySupply: SupplyAuditResult;
  readonly moonreySupply: SupplyAuditResult;
  readonly fees: FeeRehearsalResult;
  readonly validatorEconomics: ValidatorEconomicsResult;
  readonly moonreyIssuance: MoonReyIssuanceResult;
  readonly treasury: TreasuryRehearsalResult;
  readonly exchange: ExchangeRehearsalResult;
  readonly machineCommerce: MachineCommerceResult;
  readonly governance: GovernanceRehearsalResult;
  readonly dualEconomy: {
    readonly epochs: number;
    readonly humanActivity: boolean;
    readonly productiveOutput: boolean;
    readonly automation: boolean;
    readonly supplyTracked: boolean;
    readonly classification: 'ENGINEERING_SIMULATION';
  };
  readonly stress: RehearsalStressResult;
  readonly stress: EconomicRehearsalStressResult;
  readonly stress: EconomicStressResult;
  readonly recoveries: readonly RecoveryResult[];
  readonly explorer: ExplorerRebuildResult;
  readonly formal: readonly TraceConformanceResult[];
  readonly controlRoom: EconomicLaunchControlRoomState;
  readonly findings: readonly RehearsalFinding[];
  readonly economicFindings: readonly RehearsalStressFinding[];
  readonly economicFindings: readonly EconomicRehearsalStressFinding[];
  readonly economicFindings: readonly EconomicStressFinding[];
  readonly engineeringBlockers: readonly RehearsalFinding[];
  readonly classification: EconomicRehearsalResultState;
  readonly productionCandidateAllocationUnchanged: true;
  readonly productionAuthorized: false;
  readonly liveFlagsRemainDisabled: true;
  readonly tickersAssigned: false;
  readonly knownLimitations: readonly string[];
  readonly integratedEvidenceHashes?: IntegratedEconomicEvidenceHashes;
};
