import type { Card } from './card.ts';
import type { CardAuthorizationRecord } from './authorization.ts';
import type { CardClearingRecord } from './clearing.ts';
import type { CardDispute } from './dispute.ts';
import type { CardFeeAssessment } from './fees.ts';
import type { CardProgram } from './program.ts';
import type { CardRefundRecord } from './refund.ts';
import type { CardNetworkToken } from './token.ts';
import type { CardReconciliationResult } from './reconciliation.ts';
import { simulationPrograms } from './program.ts';

export type CardStoreSnapshot = {
  readonly cards: readonly Card[];
  readonly cardsByKey: readonly (readonly [string, Card])[];
  readonly authorizations: readonly CardAuthorizationRecord[];
  readonly authorizationsByCallback: readonly (readonly [string, CardAuthorizationRecord])[];
  readonly clearings: readonly CardClearingRecord[];
  readonly clearingsByCallback: readonly (readonly [string, CardClearingRecord])[];
  readonly refunds: readonly CardRefundRecord[];
  readonly refundsByCallback: readonly (readonly [string, CardRefundRecord])[];
  readonly disputes: readonly CardDispute[];
  readonly tokens: readonly CardNetworkToken[];
  readonly fees: readonly CardFeeAssessment[];
  readonly reconciliations: readonly CardReconciliationResult[];
};

export class CardStore {
  private readonly cards = new Map<string, Card>();
  private readonly cardsByKey = new Map<string, Card>();
  private readonly authorizations = new Map<string, CardAuthorizationRecord>();
  private readonly authorizationsByCallback = new Map<string, CardAuthorizationRecord>();
  private readonly clearings = new Map<string, CardClearingRecord>();
  private readonly clearingsByCallback = new Map<string, CardClearingRecord>();
  private readonly refunds = new Map<string, CardRefundRecord>();
  private readonly refundsByCallback = new Map<string, CardRefundRecord>();
  private readonly disputes = new Map<string, CardDispute>();
  private readonly tokens = new Map<string, CardNetworkToken>();
  private readonly fees = new Map<string, CardFeeAssessment>();
  private readonly programs = new Map<string, CardProgram>();
  private readonly reconciliations = new Map<string, CardReconciliationResult>();

  constructor() {
    for (const program of simulationPrograms()) {
      this.programs.set(program.programId, program);
    }
  }

  saveCard(card: Card): void {
    this.cards.set(card.cardId, card);
  }

  getCard(cardId: string): Card | undefined {
    return this.cards.get(cardId);
  }

  getCardByProcessorRef(ref: string): Card | undefined {
    return [...this.cards.values()].find((card) => card.processorCardRef === ref);
  }

  listCardsByCustomer(customerId: string): readonly Card[] {
    return [...this.cards.values()].filter((card) => card.customerId === customerId);
  }

  cardByIdempotency(key: string): Card | undefined {
    return this.cardsByKey.get(key);
  }

  markCardIdempotency(key: string, card: Card): void {
    this.cardsByKey.set(key, card);
  }

  saveAuthorization(record: CardAuthorizationRecord): void {
    this.authorizations.set(record.authorizationId, record);
  }

  getAuthorization(id: string): CardAuthorizationRecord | undefined {
    return this.authorizations.get(id);
  }

  authorizationByCallback(key: string): CardAuthorizationRecord | undefined {
    return this.authorizationsByCallback.get(key);
  }

  markAuthorizationCallback(key: string, record: CardAuthorizationRecord): void {
    this.authorizationsByCallback.set(key, record);
  }

  listAuthorizationsByCard(cardId: string): readonly CardAuthorizationRecord[] {
    return [...this.authorizations.values()].filter((row) => row.cardId === cardId);
  }

  listClearingsByCard(cardId: string): readonly CardClearingRecord[] {
    return [...this.clearings.values()].filter((row) => row.cardId === cardId);
  }

  listRefundsByCard(cardId: string): readonly CardRefundRecord[] {
    return [...this.refunds.values()].filter((row) => row.cardId === cardId);
  }

  listDisputesByCard(cardId: string): readonly CardDispute[] {
    return [...this.disputes.values()].filter((row) => row.cardId === cardId);
  }

  snapshot(): CardStoreSnapshot {
    return Object.freeze({
      cards: [...this.cards.values()],
      cardsByKey: [...this.cardsByKey.entries()],
      authorizations: [...this.authorizations.values()],
      authorizationsByCallback: [...this.authorizationsByCallback.entries()],
      clearings: [...this.clearings.values()],
      clearingsByCallback: [...this.clearingsByCallback.entries()],
      refunds: [...this.refunds.values()],
      refundsByCallback: [...this.refundsByCallback.entries()],
      disputes: [...this.disputes.values()],
      tokens: [...this.tokens.values()],
      fees: [...this.fees.values()],
      reconciliations: [...this.reconciliations.values()],
    });
  }

  restore(snapshot: CardStoreSnapshot): void {
    this.cards.clear();
    this.cardsByKey.clear();
    this.authorizations.clear();
    this.authorizationsByCallback.clear();
    this.clearings.clear();
    this.clearingsByCallback.clear();
    this.refunds.clear();
    this.refundsByCallback.clear();
    this.disputes.clear();
    this.tokens.clear();
    this.fees.clear();
    this.reconciliations.clear();
    for (const card of snapshot.cards) {
      this.cards.set(card.cardId, card);
    }
    for (const [key, card] of snapshot.cardsByKey) {
      this.cardsByKey.set(key, card);
    }
    for (const row of snapshot.authorizations) {
      this.authorizations.set(row.authorizationId, row);
    }
    for (const [key, row] of snapshot.authorizationsByCallback) {
      this.authorizationsByCallback.set(key, row);
    }
    for (const row of snapshot.clearings) {
      this.clearings.set(row.clearingId, row);
    }
    for (const [key, row] of snapshot.clearingsByCallback) {
      this.clearingsByCallback.set(key, row);
    }
    for (const row of snapshot.refunds) {
      this.refunds.set(row.refundId, row);
    }
    for (const [key, row] of snapshot.refundsByCallback) {
      this.refundsByCallback.set(key, row);
    }
    for (const row of snapshot.disputes) {
      this.disputes.set(row.disputeId, row);
    }
    for (const row of snapshot.tokens) {
      this.tokens.set(row.tokenRef, row);
    }
    for (const row of snapshot.fees) {
      this.fees.set(row.feeId, row);
    }
    for (const row of snapshot.reconciliations) {
      this.reconciliations.set(row.subjectId, row);
    }
  }

  saveClearing(record: CardClearingRecord): void {
    this.clearings.set(record.clearingId, record);
  }

  getClearing(id: string): CardClearingRecord | undefined {
    return this.clearings.get(id);
  }

  clearingByCallback(key: string): CardClearingRecord | undefined {
    return this.clearingsByCallback.get(key);
  }

  markClearingCallback(key: string, record: CardClearingRecord): void {
    this.clearingsByCallback.set(key, record);
  }

  saveRefund(record: CardRefundRecord): void {
    this.refunds.set(record.refundId, record);
  }

  getRefund(id: string): CardRefundRecord | undefined {
    return this.refunds.get(id);
  }

  refundByCallback(key: string): CardRefundRecord | undefined {
    return this.refundsByCallback.get(key);
  }

  markRefundCallback(key: string, record: CardRefundRecord): void {
    this.refundsByCallback.set(key, record);
  }

  saveDispute(dispute: CardDispute): void {
    this.disputes.set(dispute.disputeId, dispute);
  }

  getDispute(id: string): CardDispute | undefined {
    return this.disputes.get(id);
  }

  saveToken(token: CardNetworkToken): void {
    this.tokens.set(token.tokenRef, token);
  }

  getToken(ref: string): CardNetworkToken | undefined {
    return this.tokens.get(ref);
  }

  listTokensByCard(cardId: string): readonly CardNetworkToken[] {
    return [...this.tokens.values()].filter((token) => token.cardId === cardId);
  }

  saveFee(fee: CardFeeAssessment): void {
    this.fees.set(fee.feeId, fee);
  }

  getProgram(id: string): CardProgram | undefined {
    return this.programs.get(id);
  }

  saveReconciliation(result: CardReconciliationResult): void {
    this.reconciliations.set(result.subjectId, result);
  }

  getReconciliation(subjectId: string): CardReconciliationResult | undefined {
    return this.reconciliations.get(subjectId);
  }

  dailyApprovedMinor(cardId: string, dayPrefix: string): bigint {
    let total = 0n;
    for (const row of this.authorizations.values()) {
      if (row.cardId !== cardId || row.decision !== 'APPROVE') {
        continue;
      }
      if (!row.createdAt.startsWith(dayPrefix)) {
        continue;
      }
      if (row.state === 'REVERSED' || row.state === 'EXPIRED') {
        continue;
      }
      total += row.request.amount.minorUnits;
    }
    return total;
  }
}
