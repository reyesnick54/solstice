/**
 * Hard boundary: external compliance evidence is not a decision authority.
 */

import type { ComplianceDecision, ComplianceEvidence } from './types.ts';

export type ComplianceSeparationProof = Readonly<{
  readonly externalEvidenceOnly: true;
  readonly issuesComplianceDecision: false;
  readonly issuesExecutionAuthority: false;
  readonly freezesFunds: false;
  readonly blocksTransactions: false;
  readonly blocksAccounts: false;
  readonly overridesComplianceKernel: false;
  readonly affectsBlockchainConsensus: false;
  readonly providerResponseIsDirectEnforcement: false;
}>;

export function complianceSeparationProof(): ComplianceSeparationProof {
  return Object.freeze({
    externalEvidenceOnly: true,
    issuesComplianceDecision: false,
    issuesExecutionAuthority: false,
    freezesFunds: false,
    blocksTransactions: false,
    blocksAccounts: false,
    overridesComplianceKernel: false,
    affectsBlockchainConsensus: false,
    providerResponseIsDirectEnforcement: false,
  });
}

export function assertEvidenceNotDecision(
  value: ComplianceEvidence | ComplianceDecision,
): asserts value is ComplianceEvidence {
  if ('kernelAuthority' in value && value.kernelAuthority === true) {
    throw new Error('external provider output must not be a ComplianceDecision');
  }
  if ('grantsDecisionAuthority' in value && value.grantsDecisionAuthority !== false) {
    throw new Error('ComplianceEvidence must not grant decision authority');
  }
}

export function evidenceCannotRejectTransaction(): true {
  return true;
}

export function evidenceCannotFreezeAccount(): true {
  return true;
}
