/**
 * Monetary-policy changes use existing SunRey protocol governance.
 * AI may model, analyze, and recommend. AI cannot vote, approve,
 * activate, or authorize production issuance.
 */

import type { GenesisGovernancePolicy } from '../mainnet/types.ts';
import { GOVERNANCE_REFERENCE } from './constitution.ts';
import type { MonetaryPolicyHistoryRecord, MonetaryPolicyRegistry, MonetaryPolicyState } from './types.ts';

export const MONETARY_GOVERNANCE_CHANGE_CLASSES = [
  'ISSUANCE_MODE',
  'SUPPLY_CONSTRAINT',
  'BURN_RULE',
  'FEE_ELIGIBILITY',
  'GENESIS_POLICY',
  'DISTRIBUTION_CATEGORY',
] as const;

export type MonetaryGovernanceProposal = {
  readonly proposalId: string;
  readonly changeClass: (typeof MONETARY_GOVERNANCE_CHANGE_CLASSES)[number];
  readonly targetVersionId: string;
  readonly activationHeight: bigint;
  readonly aiRecommended: boolean;
  readonly aiVoted: false;
  readonly aiApproved: false;
  readonly aiActivated: false;
  readonly humanGovernanceRequired: true;
  readonly usesExistingProtocolGovernance: true;
  readonly governanceReference: typeof GOVERNANCE_REFERENCE;
};

export function proposeMonetaryChange(input: {
  readonly proposalId: string;
  readonly changeClass: MonetaryGovernanceProposal['changeClass'];
  readonly targetVersionId: string;
  readonly activationHeight: bigint;
  readonly aiRecommended?: boolean;
}): MonetaryGovernanceProposal {
  return Object.freeze({
    proposalId: input.proposalId,
    changeClass: input.changeClass,
    targetVersionId: input.targetVersionId,
    activationHeight: input.activationHeight,
    aiRecommended: input.aiRecommended === true,
    aiVoted: false,
    aiApproved: false,
    aiActivated: false,
    humanGovernanceRequired: true,
    usesExistingProtocolGovernance: true,
    governanceReference: GOVERNANCE_REFERENCE,
  });
}

export function rejectAiActivation(actorKind: 'HUMAN' | 'AI' | 'AGENT' | 'AUTOMATION'): void {
  if (actorKind !== 'HUMAN') {
    throw new TypeError('AI cannot vote, approve, activate, or authorize production issuance');
  }
}

export function recordActivatedVersion(
  registry: MonetaryPolicyRegistry,
  proposal: MonetaryGovernanceProposal,
  nextState: MonetaryPolicyState,
  governance: GenesisGovernancePolicy,
): MonetaryPolicyHistoryRecord {
  if (governance.aiMayGovern) {
    throw new TypeError('AI cannot govern monetary policy');
  }
  rejectAiActivation('HUMAN');
  return Object.freeze({
    versionId: proposal.targetVersionId,
    state: nextState,
    recordedAtHeight: proposal.activationHeight,
    governanceReference: proposal.governanceReference,
    changeClass: proposal.changeClass,
    note: `activated at height ${proposal.activationHeight.toString()} via existing protocol governance`,
  });
}

export function historicalPolicyAt(
  registry: MonetaryPolicyRegistry,
  height: bigint,
): string {
  const applicable = [...registry.history]
    .filter((row) => row.recordedAtHeight <= height)
    .sort((a, b) => (a.recordedAtHeight < b.recordedAtHeight ? 1 : -1))[0];
  return applicable?.versionId ?? registry.activeVersionId;
}
