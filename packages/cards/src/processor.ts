import type { CardControls } from './controls.ts';
import type { CardFormFactor, CardStatus, CardType } from './card.ts';
import type { CardAuthorizationRequest } from './authorization.ts';
import type { CardClearingRecord } from './clearing.ts';
import type { CardRefundRecord } from './refund.ts';
import type { CardId, ProcessorCardReference } from './ids.ts';
import type { WalletProvider } from './wallet/token.ts';

export type SafeCardMetadata = {
  readonly processorCardRef: ProcessorCardReference;
  readonly formFactor: CardFormFactor;
  readonly status: CardStatus;
  readonly displayHint: 'SIM-CARD';
  readonly last4: string | null;
  readonly expiryMonth: number | null;
  readonly expiryYear: number | null;
  readonly issueOutcome: SimulatedIssueOutcome;
};

export type SimulatedIssueOutcome = 'SUCCESS' | 'PENDING' | 'FAILURE';

export type ProcessorCreateCardInput = {
  readonly cardId: CardId;
  readonly formFactor: CardFormFactor;
  readonly programId: string;
  readonly cardType?: CardType;
};

export type ProcessorAuthorizationDecision = {
  readonly approved: boolean;
  readonly externalReason: string;
};

export type SensitiveDetailsRefusal = {
  readonly outcome: 'REFUSED';
  readonly code: 'PCI_BOUNDARY' | 'NOT_PERMITTED';
  readonly message: string;
};

export type WalletProvisionProviderResult = {
  readonly outcome: 'ACCEPTED' | 'NOT_ELIGIBLE' | 'FAILED';
  readonly providerReference: string;
  readonly status: 'PROVISIONING' | 'FAILED' | 'NOT_ELIGIBLE';
};

export type ProviderTransactionStatus = {
  readonly processorReference: string;
  readonly status: string;
};

/**
 * Canonical provider-neutral card issuer/processor port.
 * Future Phase D adapters implement this. Adapters must not post journals,
 * create holds, or issue Execution Authority. They must not return PAN/CVV
 * into the application plane.
 */
export type CardProcessor = {
  createCardholder(input: { readonly customerId: string; readonly jurisdiction: string }): {
    readonly cardholderRef: string;
  };
  issueVirtualCard(input: ProcessorCreateCardInput): SafeCardMetadata;
  issuePhysicalCard(input: ProcessorCreateCardInput): SafeCardMetadata;
  createCard(input: ProcessorCreateCardInput): SafeCardMetadata;
  activateCard(ref: ProcessorCardReference): SafeCardMetadata;
  freezeCard(ref: ProcessorCardReference): SafeCardMetadata;
  unfreezeCard(ref: ProcessorCardReference): SafeCardMetadata;
  replaceCard(ref: ProcessorCardReference, input: ProcessorCreateCardInput): SafeCardMetadata;
  closeCard(ref: ProcessorCardReference): SafeCardMetadata;
  setControls(ref: ProcessorCardReference, controls: CardControls): SafeCardMetadata;
  retrieveSensitiveDetails(_ref: ProcessorCardReference): SensitiveDetailsRefusal;
  provisionWallet(input: {
    readonly processorCardRef: ProcessorCardReference;
    readonly walletProvider: WalletProvider;
    readonly deviceRef: string;
  }): WalletProvisionProviderResult;
  getTransactionStatus(processorReference: string): ProviderTransactionStatus | undefined;
  retrieveSafeMetadata(ref: ProcessorCardReference): SafeCardMetadata | undefined;
  manageNetworkTokenStatus(ref: ProcessorCardReference, status: string): void;
  processAuthorizationCallback(request: CardAuthorizationRequest): CardAuthorizationRequest;
  processClearingCallback(
    record: Pick<CardClearingRecord, 'clearingId' | 'amount' | 'processorReference' | 'authorizationId' | 'cardId'>,
  ): typeof record;
  processRefundCallback(
    record: Pick<CardRefundRecord, 'refundId' | 'amount' | 'processorReference' | 'cardId' | 'originalClearingId'>,
  ): typeof record;
  respondAuthorization(decision: ProcessorAuthorizationDecision): ProcessorAuthorizationDecision;
};
