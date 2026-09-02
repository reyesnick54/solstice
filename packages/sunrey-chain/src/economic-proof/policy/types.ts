/**
 * Wave 3 — versioned economic policy and methodology commitment types.
 */

import type {
  PolicyActivationActorKind,
  PolicyActivationStatus,
  PolicyDefinitionStatus,
  PolicyEconomy,
  PolicyRejectionCode,
  PolicyType,
} from './taxonomy.ts';

export type MethodologyDefinitionRef = {
  readonly methodologyId: string;
  readonly version: string;
  readonly economy: PolicyEconomy;
  readonly documentRef: string;
  readonly contentHash: string;
  readonly schemaVersion: number;
};

export type GovernanceDecisionRef = {
  readonly decisionId: string;
  readonly governancePolicyVersion: number;
  readonly contentHash: string;
  readonly evidenceReferences: readonly string[];
  readonly authorizedAtHeight: number;
  readonly actorKind: 'PROTOCOL_GOVERNANCE' | 'HUMAN_GOVERNANCE';
};

export type PolicyDefinition = {
  readonly schemaVersion: number;
  readonly policyId: string;
  readonly policyType: PolicyType;
  readonly version: number;
  readonly economy: PolicyEconomy;
  readonly effectiveFrom: string;
  readonly effectiveUntil: string | null;
  readonly status: PolicyDefinitionStatus;
  readonly contentHash: string;
  readonly documentRef: string;
  readonly supersedes: { readonly policyId: string; readonly version: number } | null;
  readonly governanceAuthorizationRef: GovernanceDecisionRef | null;
  readonly methodologyRefs: readonly MethodologyDefinitionRef[];
  readonly parameterClass: 'ENGINEERING_SIMULATION_PARAMETERS' | 'PRODUCTION_CANDIDATE' | 'UNCONFIGURED';
  readonly simulationOnly: boolean;
  readonly productionActivated: false;
};

export type PolicyActivation = {
  readonly policyId: string;
  readonly policyType: PolicyType;
  readonly version: number;
  readonly contentHash: string;
  readonly economy: PolicyEconomy;
  readonly activationHeight: number;
  readonly effectiveFrom: string;
  readonly effectiveUntil: string | null;
  readonly status: PolicyActivationStatus;
  readonly authorizedForMonetaryUse: boolean;
  readonly actorKind: PolicyActivationActorKind;
  readonly actorId: string;
  readonly governanceAuthorizationRef: GovernanceDecisionRef;
  readonly activatedAt: string;
};

export type PolicyCommitment = {
  readonly domain: string;
  readonly policyId: string;
  readonly policyType: PolicyType;
  readonly version: number;
  readonly contentHash: string;
  readonly economy: PolicyEconomy;
  readonly effectiveFrom: string;
  readonly effectiveUntil: string | null;
  readonly governanceAuthorizationRef: GovernanceDecisionRef;
  readonly methodologyRefs: readonly MethodologyDefinitionRef[];
  readonly commitmentHash: string;
};

export type PolicyRootInput = {
  readonly height: bigint;
  readonly activeCommitments: readonly PolicyCommitment[];
};

export type PolicyRoot = {
  readonly height: bigint;
  readonly rootHash: string;
  readonly commitmentCount: number;
};

export type ValuationPolicyBinding = {
  readonly claimId: string;
  readonly policyCommitment: PolicyCommitment;
  readonly methodologyRef: MethodologyDefinitionRef;
  readonly producedAt: string;
  readonly replayMode: 'HISTORICAL' | 'LIVE';
};

export type PolicyActivationResult =
  | { readonly ok: true; readonly activation: PolicyActivation }
  | { readonly ok: false; readonly code: PolicyRejectionCode; readonly detail: string };

export type PolicyResolutionResult =
  | { readonly ok: true; readonly definition: PolicyDefinition; readonly activation: PolicyActivation }
  | { readonly ok: false; readonly code: PolicyRejectionCode; readonly detail: string };
