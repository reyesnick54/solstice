import { SYNTHETIC_CARD_DISPLAY } from './pci-boundary.ts';
import { asProcessorCardReference, type ProcessorCardReference } from './ids.ts';
import type {
  CardProcessor,
  ProcessorAuthorizationDecision,
  ProcessorCreateCardInput,
  SafeCardMetadata,
} from './processor.ts';
import type { CardFormFactor, CardStatus } from './card.ts';
import type { CardAuthorizationRequest } from './authorization.ts';
import type { CardClearingRecord } from './clearing.ts';
import type { CardRefundRecord } from './refund.ts';

/**
 * Deterministic in-process processor. No live issuer SDK. No network.
 * Never returns or stores PAN/CVV.
 */
export class SimulatedCardProcessor implements CardProcessor {
  private readonly cards = new Map<string, SafeCardMetadata>();

  createCard(input: ProcessorCreateCardInput): SafeCardMetadata {
    const ref = asProcessorCardReference(`sim_tok_${input.cardId}`);
    const metadata: SafeCardMetadata = Object.freeze({
      processorCardRef: ref,
      formFactor: input.formFactor,
      status: 'PENDING',
      displayHint: SYNTHETIC_CARD_DISPLAY,
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

  closeCard(ref: ProcessorCardReference): SafeCardMetadata {
    return this.setStatus(ref, 'CLOSED');
  }

  retrieveSafeMetadata(ref: ProcessorCardReference): SafeCardMetadata | undefined {
    return this.cards.get(ref);
  }

  manageNetworkTokenStatus(_ref: ProcessorCardReference, _status: string): void {
    void _ref;
    void _status;
  }

  processAuthorizationCallback(request: CardAuthorizationRequest): CardAuthorizationRequest {
    return request;
  }

  processClearingCallback(
    record: Pick<CardClearingRecord, 'clearingId' | 'amount' | 'processorReference' | 'authorizationId' | 'cardId'>,
  ): typeof record {
    return record;
  }

  processRefundCallback(
    record: Pick<CardRefundRecord, 'refundId' | 'amount' | 'processorReference' | 'cardId' | 'originalClearingId'>,
  ): typeof record {
    return record;
  }

  respondAuthorization(decision: ProcessorAuthorizationDecision): ProcessorAuthorizationDecision {
    return Object.freeze({ ...decision });
  }

  private setStatus(ref: ProcessorCardReference, status: CardStatus): SafeCardMetadata {
    const existing = this.cards.get(ref);
    const formFactor: CardFormFactor = existing?.formFactor ?? 'VIRTUAL';
    const next: SafeCardMetadata = Object.freeze({
      processorCardRef: ref,
      formFactor,
      status,
      displayHint: SYNTHETIC_CARD_DISPLAY,
    });
    this.cards.set(ref, next);
    return next;
  }
}
