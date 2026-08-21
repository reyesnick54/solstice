/**
 * Chunk 166 — staged capability activation plan, domain-scoped canary
 * rehearsal, progressive readiness gates, and independent product
 * sequencing.
 *
 * Extends Chunk 89 post-genesis stabilization. This is a rehearsal
 * control plane. It does not turn everything on, invent production
 * limits, flip LIVE_* flags, or activate mainnet.
 */

import type { ActivationDomain } from '../../mainnet/types.ts';
import type { EconomicActivationDomain } from '../../economics/production-activation/types.ts';
import type { HealthComponentState, PostGenesisActorKind } from '../types.ts';

export const STAGED_ACTIVATION_SCHEMA_VERSION = 1 as const;
export const STAGED_ACTIVATION_TOOL_VERSION = 'sunrey-mainnet/staged-activation/1' as const;
export const STAGED_ACTIVATION_DOMAIN = 'sunrey.post-genesis.staged-activation.v1' as const;
export const CHUNK_166_ID = 'CHUNK-166' as const;

export const ALL_AT_ONCE_ACTIVATION = false as const;
export const READ_ONLY_EQUALS_FINANCIAL_ACTIVATION = false as const;
export const SUNREY_ISSUANCE_INDEPENDENT = true as const;
export const MOONREY_ISSUANCE_INDEPENDENT = true as const;
export const DOMAIN_FAILURE_MINIMALLY_SCOPED = true as const;
export const CANARY_REAL_CUSTOMERS = false as const;
export const AI_CAN_ADVANCE_STAGE = false as const;
export const CONTROL_ROOM_CAN_ACTIVATE_DOMAIN = false as const;
export const LIVE_FLAGS_ENABLED = false as const;
export const PRODUCTION_ACTIVE = false as const;
export const MAINNET_ENABLED = false as const;
export const HUMAN_ACTIVATION_REMAINS_SEPARATE = true as const;
export const NATIVE_ASSET_EQUALS_ISSUANCE = false as const;
export const ORACLE_SUCCESS_ISSUES_MOONREY = false as const;
export const HIN_ANCHOR_IS_LEGAL_AUTHORITY = false as const;
export const RAW_PROVIDER_FEED_MINTS_MOONREY = false as const;
export const EXCHANGE_IMPLIES_BANKING = false as const;
export const SUPPLY_BOOK_MAY_BE_OVERWRITTEN = false as const;
export const PROVIDER_FAILOVER_INHERITS_ELIGIBILITY = false as const;

export const STAGED_ACTIVATION_STAGES = [
  'STAGE_0_GENESIS_AND_CONSENSUS',
  'STAGE_1_READ_ONLY_PUBLIC_SURFACES',
  'STAGE_2_NATIVE_ASSET_BASE',
  'STAGE_3_ECONOMIC_EVIDENCE_READ_ONLY',
  'STAGE_4_CUSTODY_CANDIDATE',
  'STAGE_5_EXCHANGE_CANDIDATE',
  'STAGE_6_GOVERNED_NATIVE_ISSUANCE',
  'STAGE_7_REGULATED_FINANCIAL_SERVICES',
  'STAGE_8_HIN_AND_PRODUCTIVE_MARKETS',
] as const;
export type StagedActivationStage = (typeof STAGED_ACTIVATION_STAGES)[number];

export const STAGED_DOMAIN_STATES = [
  'NOT_ELIGIBLE',
  'BLOCKED',
  'READY_FOR_REHEARSAL',
  'CANARY_REHEARSAL',
  'REHEARSAL_PASSED',
  'AWAITING_HUMAN_ACTIVATION',
  'ACTIVATION_CANDIDATE',
] as const;
export type StagedDomainState = (typeof STAGED_DOMAIN_STATES)[number];

export const STAGED_ACTIVATION_DOMAINS = [
  'SUNREY_CHAIN',
  'SUNREY_COIN_NATIVE_ASSET',
  'MOONREY_COIN_NATIVE_ASSET',
  'SUNREY_COIN_ISSUANCE',
  'MOONREY_COIN_ISSUANCE',
  'SUNREY_EXCHANGE',
  'SUNREY_EXCHANGE_SETTLEMENT',
  'INSTITUTIONAL_CUSTODY',
  'FIAT_BANKING',
  'PAYMENT_RAILS',
  'CARDS',
  'INVESTMENTS',
  'HUMAN_INFORMATION_MARKET',
  'PRODUCTIVE_CAPACITY_MARKET',
  'PRODUCTIVE_ECONOMIC_DATA',
  'INTEROPERABILITY',
] as const;
export type StagedActivationDomain = (typeof STAGED_ACTIVATION_DOMAINS)[number];

export type MainnetActivationDomainRef = ActivationDomain;
export type EconomicActivationDomainRef = EconomicActivationDomain;

export const PRODUCTION_LIMIT_CLASS = 'UNCONFIGURED' as const;
export type ProductionLimitClass = typeof PRODUCTION_LIMIT_CLASS;

export const PRODUCTION_LIMIT_KEYS = [
  'transactionLimits',
  'issuanceLimits',
  'userCounts',
  'assetQuantities',
  'paymentVolumes',
] as const;
export type ProductionLimitKey = (typeof PRODUCTION_LIMIT_KEYS)[number];

export type ProductionLimitRecord = {
  readonly key: ProductionLimitKey;
  readonly class: ProductionLimitClass;
  readonly invented: false;
  readonly value: null;
};

export const CANARY_FIXTURE_CLASS = 'REHEARSAL_ONLY' as const;
export type CanaryFixtureClass = typeof CANARY_FIXTURE_CLASS;

export const STAGED_ACTOR_KINDS = ['HUMAN', 'AI', 'AGENT', 'AUTOMATION', 'CONTROL_ROOM'] as const;
export type StagedActivationActorKind = (typeof STAGED_ACTOR_KINDS)[number] | PostGenesisActorKind;

export const FAILURE_KINDS = [
  'CHAIN_SAFETY',
  'KYC_PROVIDER_OUTAGE',
  'BANKING_PROVIDER_OUTAGE',
  'PAYMENT_RAIL_OUTAGE',
  'ORACLE_DEGRADED',
  'PRODUCTIVE_VALUE_NOT_READY',
  'HIN_LEGAL_SCOPE_MISSING',
  'HIN_HUMAN_CONTRIBUTION_FAILURE',
  'CUSTODY_NOT_READY',
  'SUPPLY_MISMATCH',
  'OPERATING_CORRIDOR_MISSING',
  'PROVIDER_INELIGIBLE',
  'FAILOVER_NOT_INDEPENDENT',
  'PRODUCTIVE_LICENSE_MISSING',
  'CRITICAL_INCIDENT',
] as const;
export type DomainFailureKind = (typeof FAILURE_KINDS)[number];

export type ChainSafetyObservation = {
  readonly validatorQuorumStable: boolean;
  readonly finalityStable: boolean;
  readonly stateRootAgreement: boolean;
  readonly rpcHealthy: boolean;
  readonly persistenceRecoveryHealthy: boolean;
  readonly securityMonitoringHealthy: boolean;
  readonly operatorAccepted: boolean;
};

export type PublicSurfaceObservation = {
  readonly rpcReadOnlyReady: boolean;
  readonly explorerReadOnlyReady: boolean;
  readonly sdkReadOnlyReady: boolean;
  readonly issuanceActivated: false;
  readonly exchangeActivated: false;
  readonly custodyActivated: false;
  readonly paymentsActivated: false;
};

export type NativeAssetObservation = {
  readonly sunreyExistsInProtocol: boolean;
  readonly moonreyExistsInProtocol: boolean;
  readonly sunreyIssuanceEnabled: boolean;
  readonly moonreyIssuanceEnabled: boolean;
};

export type IssuanceObservation = {
  readonly sunreyEconomicAuthorization: boolean;
  readonly moonreyEconomicAuthorization: boolean;
  readonly moonreyOracleReady: boolean;
  readonly moonreyProductiveValueReady: boolean;
  readonly hinHumanContributionReady: boolean;
  readonly supplyReconciled: boolean;
};

export type CustodyObservation = {
  readonly dualAssetIsolation: boolean;
  readonly hsmKeyReady: boolean;
  readonly withdrawalApprovalReady: boolean;
  readonly travelRuleArchitectureReady: boolean;
  readonly reconciliationClean: boolean;
  readonly providerEvidenceReady: boolean;
  readonly sunreyMoonreyIdentitiesIsolated: boolean;
};

export type ExchangeObservation = {
  readonly custodyReady: boolean;
  readonly marketSurveillanceReady: boolean;
  readonly listingGovernanceReady: boolean;
  readonly dvpReconciliationClean: boolean;
  readonly operatingScopeEligible: boolean;
  readonly providerDependenciesReady: boolean;
  readonly fiatBankingActivated: false;
};

export type PaymentsObservation = {
  readonly bankingProviderEligible: boolean;
  readonly paymentRailEligible: boolean;
  readonly fxEligibleIfRequired: boolean;
  readonly kycAmlHealthy: boolean;
  readonly operatingCorridorEligible: boolean;
  readonly kernelReady: boolean;
  readonly ledgerReady: boolean;
  readonly reconciliationClean: boolean;
  readonly failOpenRoute: false;
};

export type HinObservation = {
  readonly privacyLegalScopeReady: boolean;
  readonly consentReady: boolean;
  readonly purposeControlsReady: boolean;
  readonly chainAnchorReady: boolean;
  readonly providerEvidenceReady: boolean;
  readonly humanAuthorization: boolean;
  readonly chainAnchorIsLegalAuthority: false;
};

export type ProductiveObservation = {
  readonly providerCertified: boolean;
  readonly dataLicenseRightsReady: boolean;
  readonly oracleHealthy: boolean;
  readonly sourceDiversitySufficient: boolean;
  readonly unitsReady: boolean;
  readonly eventAttributionReady: boolean;
  readonly productiveValuePolicyReady: boolean;
  readonly rawFeedMintsMoonrey: false;
};

export type ProviderDependencyObservation = {
  readonly providerId: string;
  readonly domain: StagedActivationDomain;
  readonly bindingCandidateCurrent: boolean;
  readonly credentialsValid: boolean;
  readonly externalEvidenceValid: boolean;
  readonly operatingScopeEligible: boolean;
  readonly failoverIndependentlyEligible: boolean;
  readonly health: HealthComponentState;
};

export type OperatingScopeObservation = {
  readonly domain: StagedActivationDomain;
  readonly eligible: boolean;
};

export type EvidenceObservation = {
  readonly domain: StagedActivationDomain;
  readonly current: boolean;
};

export type OperatorAcceptanceObservation = {
  readonly domain: StagedActivationDomain;
  readonly accepted: boolean;
  readonly actorKind: StagedActivationActorKind;
};

export type IncidentObservation = {
  readonly incidentId: string;
  readonly domain: StagedActivationDomain | 'SUNREY_CHAIN';
  readonly critical: boolean;
  readonly open: boolean;
  readonly kind: DomainFailureKind;
};

export type ControlRoomObservation = {
  readonly healthAcceptable: boolean;
  readonly canActivateDomain: false;
  readonly canAdvanceStage: false;
  readonly canMint: false;
};

export type SupplyBookSnapshot = {
  readonly assetId: 'SUNREY_COIN' | 'MOONREY_COIN';
  readonly genesisAllocated: bigint;
  readonly issuedPostGenesis: bigint;
  readonly burned: bigint;
  readonly circulating: bigint;
  readonly locked: bigint;
  readonly escrowed: bigint;
  readonly feeReserved: bigint;
};

export type StagedActivationObservation = {
  readonly chain: ChainSafetyObservation;
  readonly publicSurfaces: PublicSurfaceObservation;
  readonly nativeAssets: NativeAssetObservation;
  readonly issuance: IssuanceObservation;
  readonly custody: CustodyObservation;
  readonly exchange: ExchangeObservation;
  readonly payments: PaymentsObservation;
  readonly hin: HinObservation;
  readonly productive: ProductiveObservation;
  readonly providers: readonly ProviderDependencyObservation[];
  readonly operatingScope: readonly OperatingScopeObservation[];
  readonly evidence: readonly EvidenceObservation[];
  readonly operators: readonly OperatorAcceptanceObservation[];
  readonly incidents: readonly IncidentObservation[];
  readonly controlRoom: ControlRoomObservation;
  readonly supplyBooks: readonly SupplyBookSnapshot[];
  readonly productionLimits: readonly ProductionLimitRecord[];
};

export type CapabilityCanaryPlan = {
  readonly domain: StagedActivationDomain;
  readonly candidateFreezeHash: string;
  readonly policyHash: string;
  readonly operatingScopeHash: string;
  readonly providerBindingHash: string;
  readonly allowedFixturePopulation: {
    readonly class: CanaryFixtureClass;
    readonly fixtureId: string;
    readonly count: number;
  };
  readonly allowedFixtureOperations: readonly {
    readonly class: CanaryFixtureClass;
    readonly operationId: string;
  }[];
  readonly durationPolicy: {
    readonly class: CanaryFixtureClass;
    readonly fixtureWindowId: string;
  };
  readonly checkpointPolicy: {
    readonly class: CanaryFixtureClass;
    readonly fixtureCheckpointId: string;
  };
  readonly healthGates: readonly string[];
  readonly reconciliationGates: readonly string[];
  readonly abortConditions: readonly string[];
  readonly rehearsalOnly: true;
  readonly realCustomers: false;
  readonly realMoneyLimits: false;
  readonly fixtureClass: CanaryFixtureClass;
};

export type DomainStageStatus = {
  readonly domain: StagedActivationDomain;
  readonly stage: StagedActivationStage;
  readonly state: StagedDomainState;
  readonly paused: boolean;
  readonly pauseReason: string | null;
  readonly reasons: readonly string[];
  readonly financialActivation: false;
  readonly liveEnabled: false;
};

export type StageStatus = {
  readonly stage: StagedActivationStage;
  readonly state: StagedDomainState;
  readonly previousStagePassed: boolean;
  readonly domains: readonly DomainStageStatus[];
  readonly reasons: readonly string[];
};

export type StagedActivationPlan = {
  readonly schemaVersion: typeof STAGED_ACTIVATION_SCHEMA_VERSION;
  readonly toolVersion: typeof STAGED_ACTIVATION_TOOL_VERSION;
  readonly stages: readonly StagedActivationStage[];
  readonly domainsByStage: Readonly<Record<StagedActivationStage, readonly StagedActivationDomain[]>>;
  readonly allAtOnceActivation: false;
  readonly conceptualRehearsalOnly: true;
  readonly everyDomainMustActivate: false;
};

export type GateFinding = {
  readonly gateId: string;
  readonly domain: StagedActivationDomain | 'STAGE';
  readonly passed: boolean;
  readonly reason: string;
};

export type AdvanceAttempt = {
  readonly fromStage: StagedActivationStage;
  readonly toStage: StagedActivationStage;
  readonly actorKind: StagedActivationActorKind;
  readonly actorId: string;
};

export type AdvanceResult = {
  readonly ok: boolean;
  readonly fromStage: StagedActivationStage;
  readonly toStage: StagedActivationStage;
  readonly actorKind: StagedActivationActorKind;
  readonly reasons: readonly string[];
  readonly minted: false;
  readonly liveEnabled: false;
  readonly productionActive: false;
};

export type PauseResult = {
  readonly domain: StagedActivationDomain;
  readonly paused: true;
  readonly reason: string;
  readonly minted: false;
  readonly historyRewritten: false;
  readonly parametersChanged: false;
  readonly humanApprovalCreated: false;
  readonly liveEnabled: false;
};

export type SupplyReconciliationResult = {
  readonly assetId: 'SUNREY_COIN' | 'MOONREY_COIN';
  readonly conserved: boolean;
  readonly findings: readonly string[];
  readonly bookOverwritten: false;
  readonly issuanceBlocked: boolean;
};

export type ScopedFailureResult = {
  readonly kind: DomainFailureKind;
  readonly restrictedDomains: readonly StagedActivationDomain[];
  readonly chainShutdownRequired: boolean;
  readonly reasons: readonly string[];
};

export type StagedActivationReport = {
  readonly schemaVersion: typeof STAGED_ACTIVATION_SCHEMA_VERSION;
  readonly toolVersion: typeof STAGED_ACTIVATION_TOOL_VERSION;
  readonly plan: StagedActivationPlan;
  readonly stages: readonly StageStatus[];
  readonly domains: readonly DomainStageStatus[];
  readonly canaries: readonly CapabilityCanaryPlan[];
  readonly supply: readonly SupplyReconciliationResult[];
  readonly productionLimits: readonly ProductionLimitRecord[];
  readonly allAtOnceActivation: false;
  readonly readOnlyEqualsFinancialActivation: false;
  readonly sunreyIssuanceIndependent: true;
  readonly moonreyIssuanceIndependent: true;
  readonly domainFailureMinimallyScoped: true;
  readonly canaryRealCustomers: false;
  readonly aiCanAdvanceStage: false;
  readonly controlRoomCanActivateDomain: false;
  readonly humanActivationRemainsSeparate: true;
  readonly liveFlagsEnabled: false;
  readonly mainnetEnabled: false;
  readonly productionActive: false;
};
