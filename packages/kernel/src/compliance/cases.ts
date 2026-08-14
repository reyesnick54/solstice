import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../../domain/src/time.ts';
import type {
  CaseFinality,
  CaseState,
  CaseType,
  ComplianceActorKind,
  HumanDecisionKind,
} from './types.ts';

export type ComplianceCase = {
  readonly caseId: string;
  readonly caseType: CaseType;
  readonly status: CaseState;
  readonly finality: CaseFinality;
  readonly reasonCodes: readonly string[];
  readonly originRefs: readonly string[];
  readonly subjectRef: string;
  readonly counterpartyRef: string | null;
  readonly jurisdiction: string;
  readonly policyVersionId: string | null;
  readonly createdAt: UtcInstant;
  readonly ownerRef: string | null;
};

export type HumanDecision = {
  readonly decisionId: string;
  readonly caseId: string;
  readonly decision: HumanDecisionKind;
  readonly operatorRef: string;
  readonly actorKind: ComplianceActorKind;
  readonly reason: string;
  readonly evidenceRefs: readonly string[];
  readonly decidedAt: UtcInstant;
};

export type CaseDecisionResult =
  | { readonly ok: true; readonly case: ComplianceCase; readonly decision: HumanDecision }
  | {
      readonly ok: false;
      readonly reasonCode:
        | 'CASE_NOT_FOUND'
        | 'AI_CANNOT_FINALIZE_CASE'
        | 'HARD_BLOCK_NOT_OVERRIDABLE'
        | 'CASE_ALREADY_FINAL';
    };

export function openComplianceCase(input: {
  readonly caseType: CaseType;
  readonly reasonCodes: readonly string[];
  readonly originRefs: readonly string[];
  readonly subjectRef: string;
  readonly counterpartyRef?: string;
  readonly jurisdiction: string;
  readonly policyVersionId?: string;
  readonly createdAt: UtcInstant;
  readonly hardBlock?: boolean;
}): ComplianceCase {
  return Object.freeze({
    caseId: randomUUID(),
    caseType: input.caseType,
    status: 'OPEN',
    finality: input.hardBlock ? 'FINAL_HARD_BLOCK' : 'NON_FINAL',
    reasonCodes: Object.freeze([...input.reasonCodes]),
    originRefs: Object.freeze([...input.originRefs]),
    subjectRef: input.subjectRef,
    counterpartyRef: input.counterpartyRef ?? null,
    jurisdiction: input.jurisdiction,
    policyVersionId: input.policyVersionId ?? null,
    createdAt: input.createdAt,
    ownerRef: null,
  });
}

export function assignCase(current: ComplianceCase, ownerRef: string): ComplianceCase {
  if (current.status !== 'OPEN') {
    return current;
  }
  return Object.freeze({ ...current, status: 'ASSIGNED', ownerRef });
}

export function decideCase(
  current: ComplianceCase,
  input: {
    readonly decision: HumanDecisionKind;
    readonly operatorRef: string;
    readonly actorKind: ComplianceActorKind;
    readonly reason: string;
    readonly evidenceRefs: readonly string[];
    readonly decidedAt: UtcInstant;
  },
): CaseDecisionResult {
  if (current.finality === 'FINAL_HARD_BLOCK' || current.finality === 'FINAL_CLEARED') {
    return { ok: false, reasonCode: 'CASE_ALREADY_FINAL' };
  }
  if (input.actorKind !== 'HUMAN_OPERATOR') {
    return { ok: false, reasonCode: 'AI_CANNOT_FINALIZE_CASE' };
  }
  if (
    current.caseType === 'SANCTIONS_REVIEW' &&
    current.reasonCodes.includes('SIMULATED_SANCTIONS_MATCH') &&
    input.decision === 'CLEAR'
  ) {
    return { ok: false, reasonCode: 'HARD_BLOCK_NOT_OVERRIDABLE' };
  }

  const decision: HumanDecision = Object.freeze({
    decisionId: randomUUID(),
    caseId: current.caseId,
    decision: input.decision,
    operatorRef: input.operatorRef,
    actorKind: input.actorKind,
    reason: input.reason,
    evidenceRefs: Object.freeze([...input.evidenceRefs]),
    decidedAt: input.decidedAt,
  });

  let status: CaseState = current.status;
  let finality: CaseFinality = 'NON_FINAL';
  if (input.decision === 'CLEAR') {
    status = 'CLEARED';
    finality = 'FINAL_CLEARED';
  } else if (input.decision === 'BLOCK') {
    status = 'BLOCKED';
    finality = current.caseType === 'SANCTIONS_REVIEW' ? 'FINAL_HARD_BLOCK' : 'NON_FINAL';
  } else if (input.decision === 'RESTRICT') {
    status = 'ESCALATED';
  } else {
    status = 'IN_REVIEW';
  }

  return {
    ok: true,
    case: Object.freeze({
      ...current,
      status,
      finality,
      ownerRef: input.operatorRef,
    }),
    decision,
  };
}
