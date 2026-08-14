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
  'GRANT_CONSENT',
  'MODIFY_CONSENT',
  'REVOKE_CONSENT',
  'STORE_PERSONAL_DATA',
  'RUN_CLEAN_ROOM',
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

export type ConsentIntentPayload = {
  readonly consentId: string;
  readonly purpose: string;
  readonly categories: readonly string[];
  readonly subjectRef?: string;
};

export type StorePersonalDataPayload = {
  readonly category: string;
  readonly provenance: 'SYNTHETIC';
  readonly recordHash: string;
  readonly purpose: string;
};

export type RunCleanRoomPayload = {
  readonly purpose: string;
  readonly categories: readonly string[];
  readonly requesterId: string;
  readonly queryId: string;
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
  readonly GRANT_CONSENT: ConsentIntentPayload;
  readonly MODIFY_CONSENT: ConsentIntentPayload;
  readonly REVOKE_CONSENT: ConsentIntentPayload;
  readonly STORE_PERSONAL_DATA: StorePersonalDataPayload;
  readonly RUN_CLEAN_ROOM: RunCleanRoomPayload;
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
