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
  'PLACE_ORDER',
  'CANCEL_ORDER',
  'APPROVE_LISTING',
  'DIGITAL_ASSET_TRANSFER',
  'FIAT_CONVERT',
  'RECORD_SURVEILLANCE_ENFORCEMENT',
  'TOGGLE_KILL_SWITCH',
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

export type PlaceOrderPayload = {
  readonly orderId: string;
  readonly customerId: CustomerId;
  readonly pair: string;
  readonly side: 'BUY' | 'SELL';
  readonly type: 'LIMIT' | 'MARKET' | 'CANCEL';
  readonly quantity: bigint;
  readonly price?: bigint;
  readonly timeInForce: 'GTC' | 'IOC' | 'FOK';
  readonly customerName: string;
  readonly jurisdiction: string;
};

export type CancelOrderPayload = {
  readonly orderId: string;
  readonly customerId: CustomerId;
  readonly pair: string;
  readonly jurisdiction: string;
};

export type ApproveListingPayload = {
  readonly assetId: string;
  readonly pair: string;
  readonly jurisdiction: string;
  readonly approvalReason: string;
  readonly legalReviewState: 'DRAFT' | 'RESEARCH_REQUIRED';
  readonly capabilities: readonly string[];
};

export type DigitalAssetTransferPayload = {
  readonly assetId: string;
  readonly quantity: bigint;
  readonly originatorCustomerId: CustomerId;
  readonly beneficiaryCustomerId: CustomerId;
  readonly originatorJurisdiction: string;
  readonly beneficiaryJurisdiction: string;
  readonly originatorFields: Readonly<Record<string, string>>;
  readonly beneficiaryFields: Readonly<Record<string, string>>;
};

export type FiatConvertPayload = {
  readonly customerId: CustomerId;
  readonly jurisdiction: string;
  readonly fiatAmount: Money;
  readonly direction: 'FIAT_TO_PYR' | 'PYR_TO_FIAT';
};

export type RecordSurveillanceEnforcementPayload = {
  readonly alertId: string;
  readonly reasonCode: string;
  readonly action: string;
  readonly decidedBy: string;
};

export type ToggleKillSwitchPayload = {
  readonly switchId: string;
  readonly engaged: boolean;
  readonly reason: string;
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
  readonly PLACE_ORDER: PlaceOrderPayload;
  readonly CANCEL_ORDER: CancelOrderPayload;
  readonly APPROVE_LISTING: ApproveListingPayload;
  readonly DIGITAL_ASSET_TRANSFER: DigitalAssetTransferPayload;
  readonly FIAT_CONVERT: FiatConvertPayload;
  readonly RECORD_SURVEILLANCE_ENFORCEMENT: RecordSurveillanceEnforcementPayload;
  readonly TOGGLE_KILL_SWITCH: ToggleKillSwitchPayload;
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
