import type { UtcInstant } from '../../../../domain/src/time.ts';
import type {
  ActionDecisionReconstruction,
  PolicyVersionRecord,
  RegulatoryChangeRequest,
} from './types.ts';
import type { PolicyVersionRef } from './ids.ts';
import type { InMemoryRegulatoryTransparencyStore } from './store.ts';

export type DecisionEvidenceInput = {
  readonly actionRef: string;
  readonly outcome: 'ALLOW' | 'REFUSE' | 'REVIEW_REQUIRED' | 'UNKNOWN';
  readonly policyVersionRef: PolicyVersionRef;
  readonly capabilityContext: Readonly<Record<string, unknown>>;
  readonly controlEvidenceRefs: readonly string[];
  readonly financialEvidenceRefs: readonly string[];
  readonly reportingHistoryRefs: readonly string[];
  readonly modelStrategyVersions: readonly string[];
  readonly evaluatedAt: UtcInstant;
};

/**
 * Read-only supervisory query. Reconstructs structured evidence for an action
 * without exposing private chain-of-thought or granting mutation capability.
 */
export function reconstructActionDecision(
  store: InMemoryRegulatoryTransparencyStore,
  input: DecisionEvidenceInput,
  now: UtcInstant,
): ActionDecisionReconstruction {
  const changeRefs: string[] = [];
  for (const request of store.snapshot().changeRequests) {
    if (
      request.activatedAt &&
      request.activatedAt <= input.evaluatedAt &&
      request.proposedPolicyVersion?.versionRef === input.policyVersionRef
    ) {
      changeRefs.push(request.changeRequestId);
    }
  }

  return Object.freeze({
    actionRef: input.actionRef,
    outcome: input.outcome,
    policyVersionRef: input.policyVersionRef,
    capabilityContext: Object.freeze({ ...input.capabilityContext }),
    controlEvidenceRefs: Object.freeze([...input.controlEvidenceRefs]),
    financialEvidenceRefs: Object.freeze([...input.financialEvidenceRefs]),
    reportingHistoryRefs: Object.freeze([...input.reportingHistoryRefs]),
    modelStrategyVersions: Object.freeze([...input.modelStrategyVersions]),
    changeGovernanceRefs: Object.freeze(changeRefs),
    reconstructedAt: now,
  });
}

export function queryPolicyAtDecision(
  store: InMemoryRegulatoryTransparencyStore,
  policyVersionRef: PolicyVersionRef,
): PolicyVersionRecord | null {
  return store.getPolicyVersion(policyVersionRef);
}

export function queryChangeHistoryAfterDecision(
  store: InMemoryRegulatoryTransparencyStore,
  after: UtcInstant,
): readonly RegulatoryChangeRequest[] {
  return Object.freeze(
    store
      .snapshot()
      .changeRequests.filter((r) => r.updatedAt > after && r.state === 'ACTIVATED'),
  );
}

export function explainAllowOrRefusal(
  reconstruction: ActionDecisionReconstruction,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    actionRef: reconstruction.actionRef,
    outcome: reconstruction.outcome,
    policyVersion: reconstruction.policyVersionRef,
    evidenceUsed: reconstruction.controlEvidenceRefs,
    financialEvents: reconstruction.financialEvidenceRefs,
    reportingStatus: reconstruction.reportingHistoryRefs,
    modelVersions: reconstruction.modelStrategyVersions,
    subsequentPolicyChanges: reconstruction.changeGovernanceRefs,
    structuredOnly: true,
    chainOfThoughtExcluded: true,
  });
}
