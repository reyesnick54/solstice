/**
 * Wave 7 — Compliance audit receipts.
 *
 * Auditable records for policy, jurisdiction, identity, rights, consent,
 * provider license, feature gate, and decision outcomes.
 */

import { createHash, randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../../domain/src/time.ts';
import { LEGAL_REVIEW_STATUS, type ComplianceReceiptKind, type RegulatoryControlOutcome } from './taxonomy.ts';
import type { ComplianceAuditReceipt } from './types.ts';

export type CreateReceiptInput = {
  readonly kind: ComplianceReceiptKind;
  readonly decisionRef: string;
  readonly outcome: RegulatoryControlOutcome;
  readonly jurisdictionContextId?: string | null;
  readonly profileId?: string | null;
  readonly providerId?: string | null;
  readonly feature?: ComplianceAuditReceipt['feature'];
  readonly reasonCode: string;
  readonly reason: string;
  readonly evidenceRefs?: readonly string[];
  readonly recordedAt: UtcInstant;
};

export function createComplianceAuditReceipt(input: CreateReceiptInput): ComplianceAuditReceipt {
  const payload = JSON.stringify({
    kind: input.kind,
    decisionRef: input.decisionRef,
    outcome: input.outcome,
    reasonCode: input.reasonCode,
    recordedAt: input.recordedAt,
  });
  const digest = createHash('sha256').update(payload).digest('hex').slice(0, 16);

  return Object.freeze({
    receiptId: `rcpt_${digest}_${randomUUID().slice(0, 8)}`,
    kind: input.kind,
    decisionRef: input.decisionRef,
    outcome: input.outcome,
    jurisdictionContextId: input.jurisdictionContextId ?? null,
    profileId: input.profileId ?? null,
    providerId: input.providerId ?? null,
    feature: input.feature ?? null,
    reasonCode: input.reasonCode,
    reason: input.reason,
    evidenceRefs: Object.freeze([...(input.evidenceRefs ?? [])]),
    recordedAt: input.recordedAt,
    legalStatus: LEGAL_REVIEW_STATUS,
  });
}

export class ComplianceAuditReceiptStore {
  private readonly receipts: ComplianceAuditReceipt[] = [];

  record(receipt: ComplianceAuditReceipt): void {
    this.receipts.push(receipt);
  }

  list(): readonly ComplianceAuditReceipt[] {
    return Object.freeze([...this.receipts]);
  }

  byKind(kind: ComplianceReceiptKind): readonly ComplianceAuditReceipt[] {
    return Object.freeze(this.receipts.filter((receipt) => receipt.kind === kind));
  }

  byDecisionRef(decisionRef: string): readonly ComplianceAuditReceipt[] {
    return Object.freeze(this.receipts.filter((receipt) => receipt.decisionRef === decisionRef));
  }

  count(): number {
    return this.receipts.length;
  }
}
