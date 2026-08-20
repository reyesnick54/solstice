import type { NativeOperationalAssetId } from '../snapshot-envelope.ts';
import type { DurablePaymentStatus } from '../../payments/durable-store.ts';
import type { DurableProviderAcceptance } from '../../provider/durable-store.ts';
import type { DurableWithdrawalState } from '../../custody/durable-store.ts';
import type { DurableOrderState } from '../../exchange/durable-store.ts';

export type OperationalPayment = {
  readonly paymentId: string;
  readonly customerId: string;
  readonly status: DurablePaymentStatus;
  readonly idempotencyKey: string;
  readonly railSubmissionId: string | null;
  readonly providerIdempotencyKey: string | null;
  readonly quoteExecutionRef: string | null;
  readonly revision: number;
};

export type OperationalRailSubmission = {
  readonly railSubmissionId: string;
  readonly paymentId: string;
  readonly provider: string;
  readonly idempotencyKey: string;
  readonly status: string;
  readonly executionUnknown: boolean;
  readonly revision: number;
};

export type OperationalCustodyWallet = {
  readonly walletId: string;
  readonly vaultId: string;
  readonly assetId: NativeOperationalAssetId;
  readonly revision: number;
};

export type OperationalCustodyWithdrawal = {
  readonly withdrawalId: string;
  readonly customerId: string;
  readonly vaultId: string;
  readonly walletId: string | null;
  readonly assetId: NativeOperationalAssetId;
  readonly quantity: string;
  readonly state: DurableWithdrawalState;
  readonly submittedOnce: boolean;
  readonly submissionId: string | null;
  readonly providerIdempotencyKey: string | null;
  readonly journalId: string | null;
  readonly revision: number;
};

export type OperationalCustodyDeposit = {
  readonly depositId: string;
  readonly customerId: string;
  readonly assetId: NativeOperationalAssetId;
  readonly quantity: string;
  readonly state: string;
  readonly revision: number;
};

export type OperationalCustodyReservation = {
  readonly reservationId: string;
  readonly vaultId: string;
  readonly assetId: NativeOperationalAssetId;
  readonly quantity: string;
  readonly released: boolean;
  readonly debited: boolean;
  readonly revision: number;
};

export type OperationalCustodySubmission = {
  readonly submissionId: string;
  readonly withdrawalId: string | null;
  readonly depositId: string | null;
  readonly assetId: NativeOperationalAssetId;
  readonly state: 'NOT_SUBMITTED' | 'SUBMITTED' | 'SUBMISSION_UNKNOWN' | 'FINALIZED' | 'REJECTED';
  readonly providerIdempotencyKey: string;
  readonly revision: number;
};

export type OperationalExchangeOrder = {
  readonly orderId: string;
  readonly clientIdempotencyKey: string;
  readonly state: DurableOrderState;
  readonly holdId: string | null;
  readonly baseAsset: NativeOperationalAssetId;
  readonly quoteAsset: NativeOperationalAssetId;
  readonly revision: number;
};

export type OperationalExchangeReservation = {
  readonly reservationId: string;
  readonly orderId: string;
  readonly assetId: NativeOperationalAssetId;
  readonly quantity: string;
  readonly revision: number;
};

export type OperationalExchangeTrade = {
  readonly tradeId: string;
  readonly buyOrderId: string;
  readonly sellOrderId: string;
};

export type OperationalSettlementIntent = {
  readonly intentId: string;
  readonly tradeId: string;
  readonly baseAsset: NativeOperationalAssetId;
  readonly quoteAsset: NativeOperationalAssetId;
  readonly submission: 'PENDING' | 'KNOWN' | 'SUBMISSION_UNKNOWN';
  readonly journalId: string | null;
  readonly revision: number;
};

export type OperationalProviderProfile = {
  readonly providerId: string;
  readonly profileVersion: string;
  readonly profileHash: string;
  readonly acceptanceStatus: DurableProviderAcceptance;
  readonly credentialDescriptorId: string | null;
  readonly credentialVersion: number | null;
  readonly credentialReferenceHash: string | null;
  readonly endpointProfileRef: string | null;
  readonly certificationRef: string | null;
  readonly revalidationState: 'CURRENT' | 'PENDING' | 'EXPIRED';
  readonly suspensionState: 'NONE' | 'SUSPENDED' | 'REVOKED';
  readonly rawCredentialPresent: false;
  readonly revision: number;
};

export type OperationalCredentialDescriptorRef = {
  readonly descriptorId: string;
  readonly providerId: string;
  readonly credentialKind: string;
  readonly version: number;
  readonly referenceHash: string;
  readonly endpointProfileRef: string | null;
  readonly status: string;
  readonly rawCredentialPresent: false;
  readonly privateKeyPresent: false;
};

export type OperationalOutboxRecord = {
  readonly eventId: string;
  readonly aggregateId: string;
  readonly kind: string;
  readonly state: 'PENDING' | 'IN_FLIGHT' | 'DELIVERED' | 'DEAD_LETTER';
  readonly leaseExpiresAt: string | null;
  readonly notAJournal: true;
};

export type OperationalInboxRecord = {
  readonly consumerId: string;
  readonly eventId: string;
  readonly state: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  readonly interrupted: boolean;
};

export type OperationalMutationCrash = 'NONE' | 'BEFORE_COMMIT' | 'AFTER_COMMIT' | 'AFTER_OUTBOX';

export type OperationalSnapshot = {
  readonly payments: readonly OperationalPayment[];
  readonly railSubmissions: readonly OperationalRailSubmission[];
  readonly wallets: readonly OperationalCustodyWallet[];
  readonly withdrawals: readonly OperationalCustodyWithdrawal[];
  readonly deposits: readonly OperationalCustodyDeposit[];
  readonly custodyReservations: readonly OperationalCustodyReservation[];
  readonly custodySubmissions: readonly OperationalCustodySubmission[];
  readonly orders: readonly OperationalExchangeOrder[];
  readonly exchangeReservations: readonly OperationalExchangeReservation[];
  readonly trades: readonly OperationalExchangeTrade[];
  readonly settlements: readonly OperationalSettlementIntent[];
  readonly providers: readonly OperationalProviderProfile[];
  readonly credentialRefs: readonly OperationalCredentialDescriptorRef[];
  readonly outbox: readonly OperationalOutboxRecord[];
  readonly inbox: readonly OperationalInboxRecord[];
  readonly postgresIsLedger: false;
  readonly postgresIsNativeSupplyAuthority: false;
};

export const EMPTY_OPERATIONAL_SNAPSHOT: OperationalSnapshot = Object.freeze({
  payments: [],
  railSubmissions: [],
  wallets: [],
  withdrawals: [],
  deposits: [],
  custodyReservations: [],
  custodySubmissions: [],
  orders: [],
  exchangeReservations: [],
  trades: [],
  settlements: [],
  providers: [],
  credentialRefs: [],
  outbox: [],
  inbox: [],
  postgresIsLedger: false,
  postgresIsNativeSupplyAuthority: false,
});
