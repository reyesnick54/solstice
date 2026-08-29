import type { UtcInstant } from '../../../domain/src/time.ts';
import type {
  ChainBlockReference,
  ChainOperationId,
  ChainReceiptId,
  ChainTransactionId,
  ChainWriteIntentId,
} from '../ids.ts';
import type { ChainOperationState, ChainRecordType } from '../taxonomy.ts';
import type {
  AccessCommitmentKey,
  AccessCommitmentRecordId,
  AccessDeliveryId,
  AccessReservationId,
  AccessRightId,
  AccessSettlementEvidenceId,
  AccessUsageId,
} from './ids.ts';
import type {
  AccessChainFailureCode,
  AccessCommitmentKind,
  AccessFinalityState,
  AccessReservationState,
  AccessRightClass,
  AccessRightState,
} from './taxonomy.ts';

export type AccessChainFailure = {
  readonly code: AccessChainFailureCode;
  readonly message: string;
};

/**
 * How a holder is bound on chain. The raw subject identifier is committed to a
 * scoped pseudonymous reference by the chain service and never written out.
 */
export type AccessSubjectScope = {
  readonly rawSubjectId: string;
  readonly recipientContext: string;
  readonly purpose: string;
  readonly jurisdictionCell: string;
  readonly keyVersion: number;
};

/**
 * The productive object and capacity an access right points at. Capacity is an
 * integer quantity in the object's own unit schema; there are no floats here.
 */
export type AccessTargetReference = {
  readonly productiveObjectId: string;
  readonly capacityUnit: string;
  readonly capacityQuantity: bigint;
  readonly geographyRef: string;
};

/** References that carry policy meaning without carrying content. */
export type AccessReferenceSet = {
  readonly policyRef: string;
  readonly consentRef: string;
  readonly provenanceRef: string;
  readonly agreementRef: string;
};

export type AccessRightCommitmentRequest = {
  readonly rightId: AccessRightId | string;
  readonly rightClass: AccessRightClass;
  readonly issuerActorRef: string;
  readonly holder: AccessSubjectScope;
  readonly target: AccessTargetReference;
  readonly scopeLabel: string;
  readonly purpose: string;
  readonly permittedOperations: readonly string[];
  readonly restrictionLabels: readonly string[];
  readonly references: AccessReferenceSet;
  readonly jurisdictionCell: string;
  readonly validFromUnixSeconds: bigint;
  readonly expiresAtUnixSeconds: bigint;
  readonly transferable: boolean;
  readonly blockTimeUnixSeconds: bigint;
  readonly blockHeight: number;
};

export type AccessRightRevocationRequest = {
  readonly rightId: AccessRightId | string;
  readonly revokingActorRef: string;
  readonly reasonCode: string;
  readonly policyRef: string;
  readonly blockTimeUnixSeconds: bigint;
  readonly blockHeight: number;
};

export type ReservationCommitmentRequest = {
  readonly reservationId: AccessReservationId | string;
  readonly rightId: AccessRightId | string;
  readonly requestingActorRef: string;
  readonly quantity: bigint;
  readonly startsAtUnixSeconds: bigint;
  readonly endsAtUnixSeconds: bigint;
  readonly holdExpiresAtUnixSeconds: bigint;
  readonly purpose: string;
  readonly policyRef: string;
  readonly blockTimeUnixSeconds: bigint;
  readonly blockHeight: number;
};

export type ReservationTransitionRequest = {
  readonly reservationId: AccessReservationId | string;
  readonly actorRef: string;
  readonly reasonCode: string;
  readonly blockTimeUnixSeconds: bigint;
  readonly blockHeight: number;
};

export type UsageCommitmentRequest = {
  readonly usageId: AccessUsageId | string;
  readonly rightId: AccessRightId | string;
  readonly reservationId?: AccessReservationId | string | undefined;
  readonly actorRef: string;
  readonly quantity: bigint;
  readonly measurementRef: string;
  readonly purpose: string;
  readonly blockTimeUnixSeconds: bigint;
  readonly blockHeight: number;
};

export type DeliveryCommitmentRequest = {
  readonly deliveryId: AccessDeliveryId | string;
  readonly usageId: AccessUsageId | string;
  readonly attestingActorRef: string;
  readonly outcomeCode: string;
  readonly evidenceRef: string;
  readonly blockTimeUnixSeconds: bigint;
  readonly blockHeight: number;
};

/**
 * A reference to a settlement that the canonical internal ledger already
 * recorded. The Access Fabric never creates one and never moves value.
 */
export type CanonicalSettlementReference = {
  readonly journalId: string;
  readonly transferId: string;
  readonly assetCommitment: string;
};

export type SettlementEvidenceRequest = {
  readonly settlementEvidenceId: AccessSettlementEvidenceId | string;
  readonly deliveryId: AccessDeliveryId | string;
  readonly actorRef: string;
  readonly settlement: CanonicalSettlementReference;
  readonly blockTimeUnixSeconds: bigint;
  readonly blockHeight: number;
};

export type AccessRightCreatedPayload = {
  readonly kind: 'ACCESS_RIGHT_CREATED';
  readonly rightId: AccessRightId;
  readonly rightClass: AccessRightClass;
  readonly protocolRightType: string;
  readonly productiveObjectId: string;
  readonly capacityUnit: string;
  readonly capacityQuantity: bigint;
  readonly holderCommitment: string;
  readonly issuerActorRef: string;
  readonly scopeCommitment: string;
  readonly restrictionsCommitment: string;
  readonly validFromUnixSeconds: bigint;
  readonly expiresAtUnixSeconds: bigint;
  readonly transferable: boolean;
};

export type AccessRightRevokedPayload = {
  readonly kind: 'ACCESS_RIGHT_REVOKED';
  readonly rightId: AccessRightId;
  readonly reasonCode: string;
  readonly revokedAtUnixSeconds: bigint;
};

export type ReservationCommittedPayload = {
  readonly kind: 'RESERVATION_COMMITTED';
  readonly reservationId: AccessReservationId;
  readonly rightId: AccessRightId;
  readonly quantity: bigint;
  readonly startsAtUnixSeconds: bigint;
  readonly endsAtUnixSeconds: bigint;
  readonly holdExpiresAtUnixSeconds: bigint;
};

export type ReservationTransitionPayload = {
  readonly kind: 'RESERVATION_CONFIRMED' | 'RESERVATION_EXPIRED' | 'RESERVATION_CANCELLED';
  readonly reservationId: AccessReservationId;
  readonly reasonCode: string;
  readonly effectiveAtUnixSeconds: bigint;
};

export type UsageCommittedPayload = {
  readonly kind: 'USAGE_COMMITTED';
  readonly usageId: AccessUsageId;
  readonly rightId: AccessRightId;
  readonly reservationId: AccessReservationId | null;
  readonly quantity: bigint;
  readonly committedAtUnixSeconds: bigint;
};

export type DeliveryCommittedPayload = {
  readonly kind: 'DELIVERY_COMMITTED';
  readonly deliveryId: AccessDeliveryId;
  readonly usageId: AccessUsageId;
  readonly outcomeCode: string;
  readonly committedAtUnixSeconds: bigint;
};

export type SettlementEvidencePayload = {
  readonly kind: 'SETTLEMENT_EVIDENCE_REFERENCE';
  readonly settlementEvidenceId: AccessSettlementEvidenceId;
  readonly deliveryId: AccessDeliveryId;
  readonly journalId: string;
  readonly transferId: string;
};

export type AccessEventPayload =
  | AccessRightCreatedPayload
  | AccessRightRevokedPayload
  | ReservationCommittedPayload
  | ReservationTransitionPayload
  | UsageCommittedPayload
  | DeliveryCommittedPayload
  | SettlementEvidencePayload;

/**
 * One committed access-domain event. The event is the replay unit: given the
 * ordered list of events, every node derives the same access state.
 */
export type AccessCommittedEvent = {
  readonly schemaVersion: 1;
  readonly sequence: number;
  readonly kind: AccessCommitmentKind;
  readonly commitmentKey: AccessCommitmentKey;
  readonly payloadCommitment: string;
  readonly payload: AccessEventPayload;
  readonly blockTimeUnixSeconds: bigint;
  readonly blockHeight: number;
  readonly conveysOwnership: false;
  readonly mintsAsset: false;
};

export type AccessCommitmentRecord = {
  readonly recordId: AccessCommitmentRecordId;
  readonly kind: AccessCommitmentKind;
  readonly chainRecordType: ChainRecordType;
  readonly commitmentKey: AccessCommitmentKey;
  readonly payloadCommitment: string;
  readonly holderCommitment: string | null;
  readonly sequence: number;
  readonly intentId: ChainWriteIntentId | null;
  readonly operationId: ChainOperationId | null;
  readonly transactionId: ChainTransactionId | null;
  readonly receiptId: ChainReceiptId | null;
  readonly blockReference: ChainBlockReference | null;
  readonly chainState: ChainOperationState;
  readonly finality: AccessFinalityState;
  readonly confirmations: number;
  readonly policyRef: string;
  readonly jurisdictionCell: string;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly duplicateOf: AccessCommitmentRecordId | null;
  readonly rawPersonalDataOnChain: false;
  readonly conveysOwnership: false;
  readonly mintsAsset: false;
  readonly altersLedger: false;
};

export type AccessRightProjection = {
  readonly rightId: AccessRightId;
  readonly rightClass: AccessRightClass;
  readonly state: AccessRightState;
  readonly productiveObjectId: string;
  readonly capacityUnit: string;
  readonly capacityQuantity: bigint;
  readonly reservedQuantity: bigint;
  readonly consumedQuantity: bigint;
  readonly holderCommitment: string;
  readonly issuerActorRef: string;
  readonly scopeCommitment: string;
  readonly validFromUnixSeconds: bigint;
  readonly expiresAtUnixSeconds: bigint;
  readonly revokedAtUnixSeconds: bigint | null;
  readonly transferable: boolean;
  readonly conveysOwnership: false;
};

export type AccessReservationProjection = {
  readonly reservationId: AccessReservationId;
  readonly rightId: AccessRightId;
  readonly state: AccessReservationState;
  readonly quantity: bigint;
  readonly startsAtUnixSeconds: bigint;
  readonly endsAtUnixSeconds: bigint;
  readonly holdExpiresAtUnixSeconds: bigint;
  readonly usageId: AccessUsageId | null;
  readonly deliveryId: AccessDeliveryId | null;
  readonly settlementEvidenceId: AccessSettlementEvidenceId | null;
};

export type AccessUsageProjection = {
  readonly usageId: AccessUsageId;
  readonly rightId: AccessRightId;
  readonly reservationId: AccessReservationId | null;
  readonly quantity: bigint;
  readonly committedAtUnixSeconds: bigint;
  readonly deliveryId: AccessDeliveryId | null;
};

export type AccessDeliveryProjection = {
  readonly deliveryId: AccessDeliveryId;
  readonly usageId: AccessUsageId;
  readonly outcomeCode: string;
  readonly committedAtUnixSeconds: bigint;
  readonly settlementEvidenceId: AccessSettlementEvidenceId | null;
};

export type AccessSettlementProjection = {
  readonly settlementEvidenceId: AccessSettlementEvidenceId;
  readonly deliveryId: AccessDeliveryId;
  readonly journalId: string;
  readonly transferId: string;
  readonly authoritativeLedger: 'canonical-internal-ledger';
  readonly chainBalanceAuthoritative: false;
};

/** Deterministic fold of the committed event log. */
export type AccessChainState = {
  readonly schemaVersion: 1;
  readonly sequence: number;
  readonly rights: ReadonlyMap<string, AccessRightProjection>;
  readonly reservations: ReadonlyMap<string, AccessReservationProjection>;
  readonly usages: ReadonlyMap<string, AccessUsageProjection>;
  readonly deliveries: ReadonlyMap<string, AccessDeliveryProjection>;
  readonly settlements: ReadonlyMap<string, AccessSettlementProjection>;
  readonly commitmentKeys: ReadonlySet<string>;
};

export type AccessFinalityProjection = {
  readonly recordId: AccessCommitmentRecordId;
  readonly kind: AccessCommitmentKind;
  readonly sequence: number;
  readonly chainState: ChainOperationState;
  readonly finality: AccessFinalityState;
  readonly confirmations: number;
  readonly transactionId: ChainTransactionId | null;
  readonly blockReference: ChainBlockReference | null;
  readonly applicationStateRewrittenByChain: false;
};

export type AccessSynchronizationReport = {
  readonly synchronizedAt: UtcInstant;
  readonly stateCommitment: string;
  readonly sequence: number;
  readonly total: number;
  readonly final: number;
  readonly pending: number;
  readonly reviewRequired: number;
  readonly rejected: number;
  readonly unknown: number;
  readonly projections: readonly AccessFinalityProjection[];
};
