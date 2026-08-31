/**
 * Reconciliation mapping: AccessTransaction ↔ Settlement ↔ VirtualCard ↔ Auth ↔ Capture.
 */

import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../../domain/src/time.ts';
import type {
  AccessCardAuthorizationRecord,
  AccessCardCaptureRecord,
  AccessSettlementReconciliation,
  AccessVirtualCardRecord,
} from './types.ts';

export class AccessSettlementReconciliationStore {
  private readonly cards = new Map<string, AccessVirtualCardRecord>();
  private readonly cardsBySettlement = new Map<string, string>();
  private readonly authorizations = new Map<string, AccessCardAuthorizationRecord>();
  private readonly authorizationsByCard = new Map<string, string[]>();
  private readonly authorizationsBySettlement = new Map<string, string[]>();
  private readonly captures = new Map<string, AccessCardCaptureRecord>();
  private readonly capturesBySettlement = new Map<string, string[]>();
  private readonly reconciliations = new Map<string, AccessSettlementReconciliation>();

  saveCard(card: AccessVirtualCardRecord): void {
    this.cards.set(card.cardId, card);
    this.cardsBySettlement.set(card.settlementId, card.cardId);
  }

  updateCard(card: AccessVirtualCardRecord): void {
    this.cards.set(card.cardId, card);
  }

  getCard(cardId: string): AccessVirtualCardRecord | undefined {
    return this.cards.get(cardId);
  }

  getCardBySettlement(settlementId: string): AccessVirtualCardRecord | undefined {
    const cardId = this.cardsBySettlement.get(settlementId);
    return cardId ? this.cards.get(cardId) : undefined;
  }

  saveAuthorization(auth: AccessCardAuthorizationRecord): void {
    this.authorizations.set(auth.authorizationId, auth);
    const cardRows = this.authorizationsByCard.get(auth.cardId) ?? [];
    cardRows.push(auth.authorizationId);
    this.authorizationsByCard.set(auth.cardId, cardRows);
    const settlementRows = this.authorizationsBySettlement.get(auth.settlementId) ?? [];
    settlementRows.push(auth.authorizationId);
    this.authorizationsBySettlement.set(auth.settlementId, settlementRows);
  }

  saveCapture(capture: AccessCardCaptureRecord): void {
    this.captures.set(capture.captureId, capture);
    const rows = this.capturesBySettlement.get(capture.settlementId) ?? [];
    rows.push(capture.captureId);
    this.capturesBySettlement.set(capture.settlementId, rows);
  }

  listAuthorizationsForCard(cardId: string): readonly AccessCardAuthorizationRecord[] {
    const ids = this.authorizationsByCard.get(cardId) ?? [];
    return ids.map((id) => this.authorizations.get(id)!).filter(Boolean);
  }

  getAuthorization(authorizationId: string): AccessCardAuthorizationRecord | undefined {
    return this.authorizations.get(authorizationId);
  }

  getCapture(captureId: string): AccessCardCaptureRecord | undefined {
    return this.captures.get(captureId);
  }

  reconcile(input: {
    readonly accessTransactionId: string;
    readonly settlementId: string;
    readonly providerAmountMinorUnits: bigint;
    readonly currency: string;
    readonly now: UtcInstant;
  }): AccessSettlementReconciliation | undefined {
    const card = this.getCardBySettlement(input.settlementId);
    if (!card) {
      return undefined;
    }
    const authIds = this.authorizationsBySettlement.get(input.settlementId) ?? [];
    const captureIds = this.capturesBySettlement.get(input.settlementId) ?? [];
    const authorized = authIds
      .map((id) => this.authorizations.get(id))
      .filter((a): a is AccessCardAuthorizationRecord => a?.status === 'APPROVED')
      .reduce((sum, a) => sum + a.amountMinorUnits, 0n);
    const captured = captureIds
      .map((id) => this.captures.get(id))
      .filter((c): c is AccessCardCaptureRecord => c !== undefined)
      .reduce((sum, c) => sum + c.amountMinorUnits, 0n);

    const record: AccessSettlementReconciliation = Object.freeze({
      reconciliationId: `recon_${randomUUID()}`,
      accessTransactionId: input.accessTransactionId,
      settlementId: input.settlementId,
      cardId: card.cardId,
      authorizationIds: Object.freeze([...authIds]),
      captureIds: Object.freeze([...captureIds]),
      fundingReservationId: card.fundingReservationId,
      providerAmountMinorUnits: input.providerAmountMinorUnits,
      authorizedAmountMinorUnits: authorized,
      capturedAmountMinorUnits: captured,
      currency: input.currency,
      reconciledAt: input.now,
    });
    this.reconciliations.set(input.settlementId, record);
    return record;
  }

  getReconciliation(settlementId: string): AccessSettlementReconciliation | undefined {
    return this.reconciliations.get(settlementId);
  }
}
