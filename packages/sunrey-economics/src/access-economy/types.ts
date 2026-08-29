/**
 * ACCESS-13 Access Economy simulation types.
 *
 * Capacity is expressed in integer productive units. There is no
 * access-denominated money, no percentage-return field, and no score
 * that ranks people.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { ProductiveSimCategory } from '../ids.ts';
import type {
  ACCESS_ECONOMY_LABEL,
  ACCESS_ECONOMY_SCHEMA_VERSION,
  ACCESS_ECONOMY_TOOL_VERSION,
  ACCESS_FABRIC_QUALIFICATION_STATE,
  AccessDecisionOutcome,
  AccessEconomyEvidenceKind,
  AccessEconomyInvariantId,
  AccessScarcityDimension,
  AccessScarcityMode,
  AccessShockKind,
  AccessSimScenarioId,
} from './ids.ts';

/**
 * A reference to an Execution Authority that the Compliance Kernel issued
 * outside this simulation. The simulation can only observe and refuse; it
 * never mints one. `issuedBySimulation` is structurally pinned to false.
 */
export type SimulatedAuthorityReference = {
  readonly authorityRef: string;
  readonly scope: 'ACCESS_RESERVATION' | 'ACCESS_CONFIRMATION';
  readonly verifiedByCanonicalKernel: boolean;
  readonly issuedBySimulation: false;
  readonly expiresAt: UtcInstant;
};

/** Who put the request forward. An agent proposal is never an approval. */
export type AccessRequestOrigin = 'HUMAN' | 'AGENT_PROPOSAL';

/** Result of the canonical policy plane. UNDETERMINED never means allowed. */
export type AccessLegalEligibility = 'ELIGIBLE' | 'INELIGIBLE' | 'UNDETERMINED';

export type AccessCapacityPoolId = string;

/**
 * Productive capacity offered for human access in one
 * category / location / date bucket.
 */
export type AccessCapacityPool = {
  readonly poolId: AccessCapacityPoolId;
  readonly category: ProductiveSimCategory;
  readonly experienceClass: string;
  readonly locationId: string;
  readonly dateKey: string;
  readonly unit: string;
  readonly providerId: string;
  /** Total realized productive units usable for access in this bucket. */
  readonly publishedUnits: bigint;
  /** Units already committed before the scenario opened. */
  readonly preCommittedUnits: bigint;
  readonly providerAvailable: boolean;
  readonly evidenceFreshAsOf: UtcInstant;
  readonly evidenceStale: boolean;
};

export type AccessCapacityLedgerRow = {
  readonly poolId: AccessCapacityPoolId;
  readonly publishedUnits: bigint;
  readonly reservedUnits: bigint;
  readonly confirmedUnits: bigint;
  readonly committedUnits: bigint;
  readonly remainingUnits: bigint;
  readonly oversoldUnits: bigint;
};

export type AccessRequest = {
  readonly requestId: string;
  readonly subjectId: string;
  readonly entitlementId: string;
  readonly poolId: AccessCapacityPoolId;
  readonly quantity: bigint;
  /** Capacity the subject's entitlement carries, checked by access-fabric. */
  readonly entitlementCapacityUnits: bigint;
  readonly purpose: string;
  readonly jurisdiction: string;
  readonly origin: AccessRequestOrigin;
  readonly submittedAt: UtcInstant;
  /** Priority band from policy, never from a human-worth score. */
  readonly policyPriorityBand: number;
  readonly authority: SimulatedAuthorityReference | null;
  readonly legalEligibility: AccessLegalEligibility;
  readonly agentSelfApprovalAttempted: boolean;
};

export type AccessDecision = {
  readonly requestId: string;
  readonly subjectId: string;
  readonly poolId: AccessCapacityPoolId;
  readonly requestedUnits: bigint;
  readonly grantedUnits: bigint;
  readonly outcome: AccessDecisionOutcome;
  readonly reasonCode: string;
  readonly decidedAt: UtcInstant;
  readonly authorityRef: string | null;
  readonly origin: AccessRequestOrigin;
  readonly evidenceSeq: string;
  readonly settlementOwner: string | null;
  readonly humanWorthScore: false;
};

export type AccessPolicyChange = {
  readonly policyRef: string;
  readonly appliedAt: UtcInstant;
  readonly affectedPoolIds: readonly AccessCapacityPoolId[];
  readonly confirmedRightsHonoured: boolean;
  readonly pendingReservationsHeld: number;
  readonly note: string;
};

/**
 * Describes one experience class and the capacity buckets it publishes.
 * Published units are derived from the dual-economy productive output, so
 * abundance and scarcity come from the macro simulation rather than from
 * hand-picked numbers.
 */
export type AccessPoolTemplate = {
  readonly experienceClass: string;
  readonly category: ProductiveSimCategory;
  readonly locations: readonly string[];
  readonly dateKeys: readonly string[];
  readonly unit: string;
  readonly providerIds: readonly string[];
  /** Share of the macro category output offered to this experience class. */
  readonly categoryShareBps: bigint;
  /** Portion of published units already committed before the scenario opens. */
  readonly preCommittedBps: bigint;
};

export type AccessDemandProfile = {
  readonly subjectCount: number;
  readonly requestsPerSubject: number;
  readonly meanQuantity: bigint;
  readonly quantityJitter: bigint;
  /** bps of requests arriving without a verified Execution Authority. */
  readonly missingAuthorityBps: bigint;
  /** bps of requests whose legal eligibility the policy plane cannot determine. */
  readonly undeterminedEligibilityBps: bigint;
  /** bps of requests originating from an agent proposal rather than a human. */
  readonly agentProposalBps: bigint;
  /** bps of agent proposals that attempt to approve themselves. */
  readonly agentSelfApprovalBps: bigint;
  /** bps of requests whose entitlement is narrower than the request itself. */
  readonly narrowEntitlementBps: bigint;
  /** bps of demand concentrated on the first location/date bucket. */
  readonly hotspotConcentrationBps: bigint;
};

export type AccessEconomyScenario = {
  readonly schemaVersion: typeof ACCESS_ECONOMY_SCHEMA_VERSION;
  readonly scenarioId: AccessSimScenarioId;
  readonly title: string;
  readonly simulationLabel: typeof ACCESS_ECONOMY_LABEL;
  readonly seed: number;
  /** Dual-economy macro scenario that supplies productive capacity context. */
  readonly macroScenarioId: string;
  readonly macroEpochs: number;
  readonly shocks: readonly AccessShockKind[];
  readonly scarcityDimension: AccessScarcityDimension;
  readonly expectedScarcityMode: AccessScarcityMode;
  readonly poolTemplates: readonly AccessPoolTemplate[];
  readonly demand: AccessDemandProfile;
  readonly expectedOutcomes: readonly AccessDecisionOutcome[];
  readonly notes: string;
};

export type AccessInvariantResult = {
  readonly invariant: AccessEconomyInvariantId;
  readonly statement: string;
  readonly held: boolean;
  readonly evidence: string;
};

export type AccessEvidenceSummary = {
  readonly kinds: readonly AccessEconomyEvidenceKind[];
  readonly recordCount: number;
  readonly chainVerified: boolean;
  readonly headRecordSha256: string;
  readonly consequentialTransitions: number;
  readonly sealedConsequentialTransitions: number;
  readonly forbiddenKeysPresent: false;
};

export type AccessEconomyScenarioResult = {
  readonly schemaVersion: typeof ACCESS_ECONOMY_SCHEMA_VERSION;
  readonly toolVersion: typeof ACCESS_ECONOMY_TOOL_VERSION;
  readonly simulationLabel: typeof ACCESS_ECONOMY_LABEL;
  readonly scenarioId: AccessSimScenarioId;
  readonly seed: number;
  readonly macroScenarioId: string;
  readonly inputFixtureSha256: string;
  readonly resultDigestSha256: string;
  readonly scarcityMode: AccessScarcityMode;
  /** Scarcity per bucket group along the exercised dimension. */
  readonly scarcityByGroup: Readonly<Record<string, AccessScarcityMode>>;
  readonly scarcityDimension: AccessScarcityDimension;
  /** True when every outcome the scenario is written to exercise occurred. */
  readonly expectedOutcomesObserved: boolean;
  readonly capacity: readonly AccessCapacityLedgerRow[];
  readonly decisions: readonly AccessDecision[];
  readonly outcomeCounts: Readonly<Partial<Record<AccessDecisionOutcome, number>>>;
  readonly policyChanges: readonly AccessPolicyChange[];
  readonly invariants: readonly AccessInvariantResult[];
  readonly invariantsHeld: boolean;
  readonly evidence: AccessEvidenceSummary;
  readonly totalPublishedUnits: bigint;
  readonly totalGrantedUnits: bigint;
  readonly oversoldUnits: bigint;
  readonly refusedRequests: number;
  readonly canonicalIntegrations: Readonly<Record<string, string>>;
  readonly nativeIssuance: {
    readonly sunreyIssuedBySimulation: 0n;
    readonly moonreyIssuedBySimulation: 0n;
    readonly fixedSunreyMoonreyPeg: null;
  };
  readonly productionActivation: {
    readonly environment: 'simulation';
    readonly liveFlagsChanged: false;
    readonly productionAuthorization: false;
  };
};

export type AccessEconomyQualificationReport = {
  readonly schemaVersion: typeof ACCESS_ECONOMY_SCHEMA_VERSION;
  readonly toolVersion: typeof ACCESS_ECONOMY_TOOL_VERSION;
  readonly simulationLabel: typeof ACCESS_ECONOMY_LABEL;
  readonly seed: number;
  readonly scenarioCount: number;
  readonly results: readonly AccessEconomyScenarioResult[];
  readonly invariants: readonly AccessEconomyInvariantId[];
  readonly invariantViolations: readonly AccessInvariantResult[];
  readonly allInvariantsHeld: boolean;
  readonly evidenceChainsVerified: boolean;
  readonly oversoldUnits: bigint;
  readonly refusalsAreFirstClass: true;
  /** Engineering-only state. Never implies any production posture. */
  readonly qualificationState: typeof ACCESS_FABRIC_QUALIFICATION_STATE | 'ACCESS_FABRIC_NOT_QUALIFIED';
  readonly productionPosture: {
    readonly PRODUCTION_READY: false;
    readonly LIVE_CONNECTIVITY_ENABLED: false;
    readonly PRODUCTION_ACTIVE: false;
    readonly changedByThisRun: false;
  };
  readonly remainingSimulatedDependencies: readonly string[];
  readonly remainingRealWorldProviderRequirements: readonly string[];
  readonly remainingLegalGates: readonly string[];
};
