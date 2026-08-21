import { SYNTHETIC_CARD_DISPLAY } from './pci-boundary.ts';
import { asProcessorCardReference, type ProcessorCardReference } from './ids.ts';
import type {
  CardProcessor,
  ProcessorAuthorizationDecision,
  ProcessorCreateCardInput,
  SafeCardMetadata,
  SensitiveDetailsRefusal,
  SimulatedIssueOutcome,
  WalletProvisionProviderResult,
} from './processor.ts';
import type { CardFormFactor, CardStatus } from './card.ts';
import type { CardAuthorizationRequest } from './authorization.ts';
import type { CardClearingRecord } from './clearing.ts';
import type { CardRefundRecord } from './refund.ts';
import type { CardControls } from './controls.ts';
import type { WalletProvider } from './wallet/token.ts';

/**
 * Deterministic in-process processor. No live issuer SDK. No network.
 * Never returns or stores PAN/CVV. Tokens are invalid outside tests.
 *
 * Issue scenarios (encoded in cardId for sandbox determinism):
 * - contains `_pending_` → PENDING
 * - contains `_fail_` → FAILURE
 * - otherwise SUCCESS
 */
export class SimulatedCardProcessor implements CardProcessor {
  private readonly cards = new Map<string, SafeCardMetadata>();
  private readonly cardholders = new Map<string, string>();
  private readonly transactions = new Map<string, { readonly processorReference: string; readonly status: string }>();

  createCardholder(input: { readonly customerId: string; readonly jurisdiction: string }): {
    readonly cardholderRef: string;
  } {
    const ref = `sim_holder_${input.customerId}_${input.jurisdiction}`;
    this.cardholders.set(input.customerId, ref);
    return Object.freeze({ cardholderRef: ref });
  }

  issueVirtualCard(input: ProcessorCreateCardInput): SafeCardMetadata {
    return this.createCard({ ...input, formFactor: 'VIRTUAL' });
  }

  issuePhysicalCard(input: ProcessorCreateCardInput): SafeCardMetadata {
    return this.createCard({ ...input, formFactor: 'PHYSICAL' });
  }

  createCard(input: ProcessorCreateCardInput): SafeCardMetadata {
    const outcome = issueOutcomeFor(input.cardId);
    const ref = asProcessorCardReference(`sim_tok_${input.cardId}`);
    const status: CardStatus = outcome === 'FAILURE' ? 'CLOSED' : outcome === 'PENDING' ? 'REQUESTED' : 'PENDING';
    const metadata: SafeCardMetadata = Object.freeze({
      processorCardRef: ref,
      formFactor: input.formFactor,
      status,
      displayHint: SYNTHETIC_CARD_DISPLAY,
      last4: outcome === 'FAILURE' ? null : '0000',
      expiryMonth: outcome === 'FAILURE' ? null : 12,
      expiryYear: outcome === 'FAILURE' ? null : 2099,
      issueOutcome: outcome,
    });
    this.cards.set(ref, metadata);
    return metadata;
  }

  activateCard(ref: ProcessorCardReference): SafeCardMetadata {
    return this.setStatus(ref, 'ACTIVE');
  }

  freezeCard(ref: ProcessorCardReference): SafeCardMetadata {
    return this.setStatus(ref, 'FROZEN');
  }

  unfreezeCard(ref: ProcessorCardReference): SafeCardMetadata {
    return this.setStatus(ref, 'ACTIVE');
  }

  replaceCard(ref: ProcessorCardReference, input: ProcessorCreateCardInput): SafeCardMetadata {
    this.setStatus(ref, 'REPLACED');
    return this.createCard(input);
  }

  closeCard(ref: ProcessorCardReference): SafeCardMetadata {
    return this.setStatus(ref, 'CLOSED');
  }

  setControls(ref: ProcessorCardReference, _controls: CardControls): SafeCardMetadata {
    void _controls;
    const existing = this.cards.get(ref);
    if (!existing) {
      return this.createPlaceholder(ref, 'PENDING');
    }
    return existing;
  }

  retrieveSensitiveDetails(_ref: ProcessorCardReference): SensitiveDetailsRefusal {
    void _ref;
    return Object.freeze({
      outcome: 'REFUSED',
      code: 'PCI_BOUNDARY',
      message: 'application plane must not retrieve PAN, CVV, PIN, or track data',
    });
  }

  provisionWallet(input: {
    readonly processorCardRef: ProcessorCardReference;
    readonly walletProvider: WalletProvider;
    readonly deviceRef: string;
  }): WalletProvisionProviderResult {
    const card = this.cards.get(input.processorCardRef);
    if (!card || card.status !== 'ACTIVE') {
      return Object.freeze({
        outcome: 'NOT_ELIGIBLE',
        providerReference: `sim_wallet_${input.walletProvider}_ineligible`,
        status: 'NOT_ELIGIBLE',
      });
    }
    return Object.freeze({
      outcome: 'ACCEPTED',
      providerReference: `sim_wallet_${input.walletProvider}_${input.deviceRef}`,
      status: 'PROVISIONING',
    });
  }

  getTransactionStatus(processorReference: string): { readonly processorReference: string; readonly status: string } | undefined {
    return this.transactions.get(processorReference);
  }

  retrieveSafeMetadata(ref: ProcessorCardReference): SafeCardMetadata | undefined {
    return this.cards.get(ref);
  }

  manageNetworkTokenStatus(_ref: ProcessorCardReference, _status: string): void {
    void _ref;
    void _status;
  }

  processAuthorizationCallback(request: CardAuthorizationRequest): CardAuthorizationRequest {
    this.transactions.set(request.processorReference, {
      processorReference: request.processorReference,
      status: 'AUTHORIZATION',
    });
    return request;
  }

  processClearingCallback(
    record: Pick<CardClearingRecord, 'clearingId' | 'amount' | 'processorReference' | 'authorizationId' | 'cardId'>,
  ): typeof record {
    this.transactions.set(record.processorReference, {
      processorReference: record.processorReference,
      status: 'CAPTURED',
    });
    return record;
  }

  processRefundCallback(
    record: Pick<CardRefundRecord, 'refundId' | 'amount' | 'processorReference' | 'cardId' | 'originalClearingId'>,
  ): typeof record {
    this.transactions.set(record.processorReference, {
      processorReference: record.processorReference,
      status: 'REFUNDED',
    });
    return record;
  }

  respondAuthorization(decision: ProcessorAuthorizationDecision): ProcessorAuthorizationDecision {
    return Object.freeze({ ...decision });
  }

  recordAuthorizationDecision(processorReference: string, approved: boolean): void {
    this.transactions.set(processorReference, {
      processorReference,
      status: approved ? 'APPROVED' : 'DECLINED',
    });
  }

  private setStatus(ref: ProcessorCardReference, status: CardStatus): SafeCardMetadata {
    const existing = this.cards.get(ref);
    const formFactor: CardFormFactor = existing?.formFactor ?? 'VIRTUAL';
    const next: SafeCardMetadata = Object.freeze({
      processorCardRef: ref,
      formFactor,
      status,
      displayHint: SYNTHETIC_CARD_DISPLAY,
      last4: existing?.last4 ?? '0000',
      expiryMonth: existing?.expiryMonth ?? 12,
      expiryYear: existing?.expiryYear ?? 2099,
      issueOutcome: existing?.issueOutcome ?? 'SUCCESS',
    });
    this.cards.set(ref, next);
    return next;
  }

  private createPlaceholder(ref: ProcessorCardReference, status: CardStatus): SafeCardMetadata {
    const metadata: SafeCardMetadata = Object.freeze({
      processorCardRef: ref,
      formFactor: 'VIRTUAL',
      status,
      displayHint: SYNTHETIC_CARD_DISPLAY,
      last4: '0000',
      expiryMonth: 12,
      expiryYear: 2099,
      issueOutcome: 'SUCCESS',
    });
    this.cards.set(ref, metadata);
    return metadata;
  }
}

export function issueOutcomeFor(cardId: string): SimulatedIssueOutcome {
  if (cardId.includes('_fail_')) {
    return 'FAILURE';
  }
  if (cardId.includes('_pending_')) {
    return 'PENDING';
  }
  return 'SUCCESS';
}
