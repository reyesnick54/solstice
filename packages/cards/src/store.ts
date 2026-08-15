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
