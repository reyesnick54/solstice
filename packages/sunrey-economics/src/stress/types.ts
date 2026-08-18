/**
 * Chunk 76 versioned economic stress types.
 */

import type {
  CampaignId,
  ECONOMIC_STRESS_LABEL,
  ECONOMIC_STRESS_SCHEMA_VERSION,
  ECONOMIC_STRESS_TOOL_VERSION,
  EconomicInvariantId,
  FailureClass,
  FindingVerificationState,
  ShockKind,
  StressDomain,
  StressSeverity,
} from './ids.ts';

export type EconomicStressScenario = {
  readonly schemaVersion: typeof ECONOMIC_STRESS_SCHEMA_VERSION;
  readonly scenarioId: string;
  readonly domain: StressDomain;
  readonly title: string;
  readonly seed: number;
  readonly epochs: number;
  readonly shocks: readonly ShockKind[];
  readonly recoverable: boolean;
  readonly expectedFailureClass: FailureClass | null;
  readonly notes: string;
};

export type EconomicInvariantResult = {
  readonly invariant: EconomicInvariantId;
  readonly held: boolean;
  readonly evidence: string;
};

export type EconomicRecoveryResult = {
  readonly attempted: boolean;
  readonly recoveredAutomatically: boolean;
  readonly requiredOperatorAction: boolean;
  readonly sameCanonicalStateChain: boolean;
  readonly explorerRebuilds: boolean;
  readonly unresolvedFinding: boolean;
  readonly detail: string;
};

export type EconomicStressFinding = {
  readonly findingId: string;
  readonly scenario: string;
  readonly affectedSubsystem: string;
  readonly severity: StressSeverity;
  readonly invariant: EconomicInvariantId | null;
  readonly evidence: string;
  readonly reproductionSeed: number;
  readonly remediationReference: string;
  readonly verificationState: FindingVerificationState;
  readonly failureClass: FailureClass;
};

export type EconomicStressResult = {
  readonly scenarioId: string;
  readonly seed: number;
  readonly policyVersions: Readonly<Record<string, string | number>>;
  readonly inputFixtureHash: string;
  readonly invariants: readonly EconomicInvariantResult[];
  readonly preservedInvariants: boolean;
  readonly degradedAvailability: boolean;
  readonly failClosed: boolean;
  readonly recovery: EconomicRecoveryResult;
  readonly findings: readonly EconomicStressFinding[];
  readonly marketImpactBps: bigint;
  readonly concentrationWarnings: readonly string[];
  readonly elapsedMs: number;
  readonly pendingOperations: number;
};

export type EconomicStressCampaign = {
  readonly campaignId: CampaignId | string;
  readonly title: string;
  readonly scenarioIds: readonly string[];
  readonly epochs: number;
  readonly extendedWorkflow: boolean;
};

export type EconomicRecoveryScore = {
  readonly preservedInvariants: boolean;
  readonly degradedAvailability: boolean;
  readonly recoveredAutomatically: boolean;
  readonly requiredOperatorAction: boolean;
  readonly leftUnresolvedFinding: boolean;
};

export type EconomicStressReport = {
  readonly schemaVersion: typeof ECONOMIC_STRESS_SCHEMA_VERSION;
  readonly toolVersion: typeof ECONOMIC_STRESS_TOOL_VERSION;
  readonly classification: typeof ECONOMIC_STRESS_LABEL;
  readonly commit: string;
  readonly policyVersions: Readonly<Record<string, string | number>>;
  readonly campaignId: string;
  readonly scenarioCount: number;
  readonly seed: number;
  readonly invariants: readonly EconomicInvariantId[];
  readonly results: readonly EconomicStressResult[];
  readonly violations: number;
  readonly failClosedResults: number;
  readonly recovery: EconomicRecoveryScore;
  readonly concentrationWarnings: readonly string[];
  readonly performanceContext: {
    readonly labElapsedMs: number;
    readonly notLiveBlockchainPerformance: true;
    readonly protocolChecksWeakened: false;
  };
  readonly openFindings: readonly EconomicStressFinding[];
  readonly productionAuthorization: false;
};
