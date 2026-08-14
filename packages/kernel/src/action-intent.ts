import type {
  AccountId,
  ActionIntentId,
  Actor,
  BeneficiaryDraft,
  BeneficiaryId,
  CreateProspectInput,
  CustomerId,
  CustomerStatus,
  IdempotencyKey,
  Money,
  PaymentId,
  UtcInstant,
} from '@solstice/domain';

export const ACTION_KINDS = [
  'CREATE_CUSTOMER',
  'TRANSITION_CUSTOMER_STATUS',
  'OPEN_ACCOUNT',
  'SEED_CREDIT',
  'ADD_BENEFICIARY',
  'UPDATE_BENEFICIARY',
  'POST_JOURNAL',
  'FX_CONVERT',
  'SEND_PAYMENT',
  'COMPENSATE_PAYMENT',
  'RECORD_COST_AVOIDED',
  'OPEN_PYR_WALLET',
  'SEED_PYR',
  'SETTLE_PYR_COMPENSATION',
  'TRANSFER_PYR',
  'GRANT_CONSENT',
  'REVOKE_CONSENT',
  'PUBLISH_DATA_REQUEST',
  'RUN_CLEAN_ROOM',
  'ISSUE_PROOF_OF_CONTRIBUTION',
] as const;

export type ActionKind = (typeof ACTION_KINDS)[number];

export type OpenAccountPayload = {
  readonly accountId: AccountId;
  readonly ownerCustomerId: CustomerId | 'HOUSE';
  readonly currency: string;
  readonly accountClass: string;
};

export type SeedCreditPayload = {
  readonly accountId: AccountId;
  readonly amount: Money;
  readonly memo: string;
};

export type UpdateBeneficiaryPayload = {
  readonly beneficiaryId: BeneficiaryId;
  readonly verificationState?: string;
  readonly institutionName?: string;
};

export type PostJournalPayload = {
  readonly memo: string;
};

export type FxConvertPayload = {
  readonly sourceAccountId: AccountId;
  readonly destinationAccountId: AccountId;
  readonly sourceAmount: Money;
};

export type SendPaymentPayload = {
  readonly sourceCustomerId: CustomerId;
  readonly beneficiaryId: BeneficiaryId;
  readonly instructedAmount: Money;
  readonly instructedSide: 'SOURCE' | 'DESTINATION';
  readonly purpose: string;
  readonly screening: {
    readonly senderName: string;
    readonly receiverName: string;
    readonly beneficialOwnerName: string;
    readonly destinationCountry: string;
  };
};

export type CompensatePaymentPayload = {
  readonly paymentId: PaymentId;
  readonly reason: string;
};

export type RecordCostAvoidedPayload = {
  readonly customerId: CustomerId;
  readonly baselineCost: Money;
  readonly actualCost: Money;
  readonly paymentId: PaymentId;
};

export type OpenPyrWalletPayload = {
  readonly accountId: AccountId;
  readonly ownerId: CustomerId | 'SOLSTICE_CORPORATE';
  readonly holderClass: 'CUSTOMER' | 'CORPORATE';
};

export type SeedPyrPayload = {
  readonly accountId: AccountId;
  readonly amountMinorUnits: bigint;
};

export type SettlePyrCompensationPayload = {
  readonly customerId: CustomerId;
  readonly amountMinorUnits: bigint;
  readonly settlementRef: string;
};

export type TransferPyrPayload = {
  readonly fromWalletId: AccountId;
  readonly toWalletId: AccountId;
  readonly amountMinorUnits: bigint;
};

export type ConsentPayload = {
  readonly consentId: string;
  readonly decision?: 'GRANT' | 'DECLINE';
};

export type PublishDataRequestPayload = {
  readonly requestId: string;
  readonly sponsorId: string;
};

export type RunCleanRoomPayload = {
  readonly requestId: string;
};

export type IssueProofPayload = {
  readonly contributionId: string;
};

export type TransitionCustomerPayload = {
  readonly customerId: CustomerId;
  readonly to: CustomerStatus;
};

export type ActionPayloadByKind = {
  readonly CREATE_CUSTOMER: CreateProspectInput;
  readonly TRANSITION_CUSTOMER_STATUS: TransitionCustomerPayload;
  readonly OPEN_ACCOUNT: OpenAccountPayload;
  readonly SEED_CREDIT: SeedCreditPayload;
  readonly ADD_BENEFICIARY: BeneficiaryDraft;
  readonly UPDATE_BENEFICIARY: UpdateBeneficiaryPayload;
  readonly POST_JOURNAL: PostJournalPayload;
  readonly FX_CONVERT: FxConvertPayload;
  readonly SEND_PAYMENT: SendPaymentPayload;
  readonly COMPENSATE_PAYMENT: CompensatePaymentPayload;
  readonly RECORD_COST_AVOIDED: RecordCostAvoidedPayload;
  readonly OPEN_PYR_WALLET: OpenPyrWalletPayload;
  readonly SEED_PYR: SeedPyrPayload;
  readonly SETTLE_PYR_COMPENSATION: SettlePyrCompensationPayload;
  readonly TRANSFER_PYR: TransferPyrPayload;
  readonly GRANT_CONSENT: ConsentPayload;
  readonly REVOKE_CONSENT: ConsentPayload;
  readonly PUBLISH_DATA_REQUEST: PublishDataRequestPayload;
  readonly RUN_CLEAN_ROOM: RunCleanRoomPayload;
  readonly ISSUE_PROOF_OF_CONTRIBUTION: IssueProofPayload;
};

export type ActionIntent<K extends ActionKind = ActionKind> = {
  readonly id: ActionIntentId;
  readonly kind: K;
  readonly actor: Actor;
  readonly payload: ActionPayloadByKind[K];
  readonly idempotencyKey: IdempotencyKey;
  readonly occurredAt: UtcInstant;
  readonly sourceJurisdiction: string;
  readonly destinationJurisdiction?: string;
};

export function freezeIntent<K extends ActionKind>(intent: ActionIntent<K>): ActionIntent<K> {
  return Object.freeze({
    ...intent,
    actor: Object.freeze({ ...intent.actor }),
    payload: Object.freeze(intent.payload) as ActionPayloadByKind[K],
  });
}

export const STATE_CHANGING_KINDS: readonly ActionKind[] = ACTION_KINDS;
