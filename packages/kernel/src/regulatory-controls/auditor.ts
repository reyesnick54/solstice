/**
 * Wave 7 — Read-only auditor access.
 *
 * Auditors inspect decision history, proof commitments, governance references,
 * control status, and incident history without monetary mutation authority.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type {
  AuditorAccessRequest,
  AuditorAccessResult,
  AuditorInspectionScope,
  ComplianceAuditReceipt,
} from './types.ts';

export const AUDITOR_READ_ONLY_SCOPE: AuditorInspectionScope = Object.freeze({
  decisionHistory: true,
  proofCommitments: true,
  governanceReferences: true,
  controlStatus: true,
  incidentHistory: true,
});

export type AuditorInspectionCatalog = {
  readonly decisionHistoryRefs: readonly string[];
  readonly proofCommitmentRefs: readonly string[];
  readonly governanceRefs: readonly string[];
  readonly controlStatusRefs: readonly string[];
  readonly incidentHistoryRefs: readonly string[];
};

export function evaluateAuditorAccess(
  request: AuditorAccessRequest,
  catalog: AuditorInspectionCatalog,
): AuditorAccessResult {
  if (request.role !== 'AUDITOR') {
    return Object.freeze({
      permitted: false,
      readOnly: true,
      reason: 'only AUDITOR role may access compliance inspection surfaces',
      inspectionRefs: Object.freeze([]),
    });
  }

  const refs: string[] = [];
  if (request.scope.decisionHistory) {
    refs.push(...catalog.decisionHistoryRefs);
  }
  if (request.scope.proofCommitments) {
    refs.push(...catalog.proofCommitmentRefs);
  }
  if (request.scope.governanceReferences) {
    refs.push(...catalog.governanceRefs);
  }
  if (request.scope.controlStatus) {
    refs.push(...catalog.controlStatusRefs);
  }
  if (request.scope.incidentHistory) {
    refs.push(...catalog.incidentHistoryRefs);
  }

  return Object.freeze({
    permitted: true,
    readOnly: true,
    reason: `auditor ${request.operatorId} granted read-only inspection access`,
    inspectionRefs: Object.freeze(refs),
  });
}

export function assertAuditorCannotMutate(action: string): void {
  const forbidden = [
    'POST_JOURNAL',
    'ISSUE_EXECUTION_AUTHORITY',
    'OPEN_ACCOUNT',
    'TRANSFER',
    'WITHDRAW',
    'DEPOSIT',
    'CUSTODY_KEY_ACCESS',
  ];
  if (forbidden.some((pattern) => action.includes(pattern))) {
    throw new Error(`auditor cannot perform monetary mutation: ${action}`);
  }
}

export function receiptsToDecisionHistoryRefs(receipts: readonly ComplianceAuditReceipt[]): readonly string[] {
  return Object.freeze(receipts.map((receipt) => `decision:${receipt.decisionRef}:receipt:${receipt.receiptId}`));
}

export function auditorCatalogFromReceipts(
  receipts: readonly ComplianceAuditReceipt[],
  at: UtcInstant,
): AuditorInspectionCatalog {
  return Object.freeze({
    decisionHistoryRefs: receiptsToDecisionHistoryRefs(receipts),
    proofCommitmentRefs: Object.freeze(
      receipts
        .filter((receipt) => receipt.kind === 'IDENTITY_ASSURANCE' || receipt.kind === 'POLICY')
        .map((receipt) => `proof:${receipt.receiptId}`),
    ),
    governanceRefs: Object.freeze(
      receipts
        .filter((receipt) => receipt.evidenceRefs.length > 0)
        .flatMap((receipt) => receipt.evidenceRefs.map((ref) => `governance:${ref}`)),
    ),
    controlStatusRefs: Object.freeze([`control-status:snapshot:${at}`]),
    incidentHistoryRefs: Object.freeze([]),
  });
}
