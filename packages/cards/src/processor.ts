import type { CardFormFactor, CardStatus } from './card.ts';
import type { CardAuthorizationRequest } from './authorization.ts';
import type { CardClearingRecord } from './clearing.ts';
import type { CardRefundRecord } from './refund.ts';
import type { CardId, ProcessorCardReference } from './ids.ts';

export type SafeCardMetadata = {
  readonly processorCardRef: ProcessorCardReference;
  readonly formFactor: CardFormFactor;
  readonly status: CardStatus;
  readonly displayHint: 'SIM-CARD';
};

export type ProcessorCreateCardInput = {
  readonly cardId: CardId;
  readonly formFactor: CardFormFactor;
  readonly programId: string;
};

export type ProcessorAuthorizationDecision = {
  readonly approved: boolean;
  readonly externalReason: string;
};

/**
 * Provider-neutral card processor port.
 * Adapters must not post journals, create holds, or issue Execution Authority.
 */
export type CardProcessor = {
  createCard(input: ProcessorCreateCardInput): SafeCardMetadata;
  activateCard(ref: ProcessorCardReference): SafeCardMetadata;
  freezeCard(ref: ProcessorCardReference): SafeCardMetadata;
  unfreezeCard(ref: ProcessorCardReference): SafeCardMetadata;
  closeCard(ref: ProcessorCardReference): SafeCardMetadata;
  retrieveSafeMetadata(ref: ProcessorCardReference): SafeCardMetadata | undefined;
  manageNetworkTokenStatus(ref: ProcessorCardReference, status: string): void;
  processAuthorizationCallback(request: CardAuthorizationRequest): CardAuthorizationRequest;
  processClearingCallback(record: Pick<CardClearingRecord, 'clearingId' | 'amount' | 'processorReference' | 'authorizationId' | 'cardId'>): typeof record;
  processRefundCallback(record: Pick<CardRefundRecord, 'refundId' | 'amount' | 'processorReference' | 'cardId' | 'originalClearingId'>): typeof record;
  respondAuthorization(decision: ProcessorAuthorizationDecision): ProcessorAuthorizationDecision;
};
