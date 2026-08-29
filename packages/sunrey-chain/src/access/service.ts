import type { Clock } from '../../../config/src/clock.ts';
import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { SunReyChainService } from '../service.ts';
import type { ChainOperationState } from '../taxonomy.ts';
import type { ChainRecordSchema, ReconciliationRecord } from '../types.ts';
import {
  accessCommitmentKey,
  accessRightCreatedCommitment,
  accessRightRevokedCommitment,
  deliveryCommittedCommitment,
  reservationCommittedCommitment,
  reservationTransitionCommitment,
  restrictionsCommitment,
  scopeCommitment,
  settlementEvidenceCommitment,
  usageCommittedCommitment,
} from './commitments.ts';
import {
  accessCommitmentRecordIdFrom,
  asAccessDeliveryId,
  asAccessReservationId,
  asAccessRightId,
  asAccessSettlementEvidenceId,
  asAccessUsageId,
  type AccessCommitmentRecordId,
} from './ids.ts';
import type { AccessChainPorts } from './ports.ts';
import { assertPrivacySafeAccessFields, assertPrivacySafeAccessLabels } from './privacy.ts';
import {
  buildAccessRightCreatedSchema,
  buildAccessRightRevokedSchema,
  buildDeliveryCommittedSchema,
  buildReservationCommittedSchema,
  buildReservationTransitionSchema,
  buildSettlementEvidenceSchema,
  buildUsageCommittedSchema,
} from './schemas.ts';
import {
  accessStateCommitment,
  applyAccessEvent,
  emptyAccessChainState,
  replayAccessEvents,
} from './state.ts';
import {
  ACCESS_RIGHT_CLASS_TO_PROTOCOL_RIGHT_TYPE,
  chainRecordTypeForAccessKind,
  type AccessCommitmentKind,
  type AccessFinalityState,
} from './taxonomy.ts';
import type {
  AccessChainFailure,
  AccessChainState,
  AccessCommitmentRecord,
  AccessCommittedEvent,
  AccessDeliveryProjection,
  AccessEventPayload,
  AccessFinalityProjection,
  AccessReservationProjection,
  AccessRightCommitmentRequest,
  AccessRightProjection,
  AccessRightRevocationRequest,
  AccessSettlementProjection,
  AccessSynchronizationReport,
  AccessUsageProjection,
  DeliveryCommitmentRequest,
  ReservationCommitmentRequest,
  ReservationTransitionRequest,
  SettlementEvidenceRequest,
  UsageCommitmentRequest,
} from './types.ts';
import {
  validateAccessRightClass,
  validateActorCapability,
  validateProductiveTarget,
  validateReferences,
  validateRightsAuthority,
} from './validation.ts';

export const ACCESS_CHAIN_POLICY_VERSION = 'sunrey.access.commitments.v1';
export const ACCESS_CHAIN_SOURCE_SUBSYSTEM = 'access-fabric' as const;

const FINALITY_BY_CHAIN_STATE: Readonly<Record<ChainOperationState, AccessFinalityState>> =
  Object.freeze({
    CREATED: 'PENDING',
    QUEUED: 'PENDING',
    SUBMITTED: 'PENDING',
    ACCEPTED: 'PENDING',
    PENDING_FINALITY: 'PENDING',
    FINALIZED: 'FINAL',
    REJECTED: 'REJECTED',
    FAILED: 'REJECTED',
    UNKNOWN: 'UNKNOWN',
    REORG_OBSERVED: 'REVIEW_REQUIRED',
  });

export function accessFinalityFor(state: ChainOperationState): AccessFinalityState {
  return FINALITY_BY_CHAIN_STATE[state];
}

type CommitPlan = {
  readonly kind: AccessCommitmentKind;
  readonly subjectRef: string;
  readonly payloadCommitment: string;
  readonly schema: ChainRecordSchema;
  readonly payload: AccessEventPayload;
  readonly blockTimeUnixSeconds: bigint;
  readonly blockHeight: number;
  readonly jurisdictionCell: string;
  readonly policyRef: string;
  readonly purpose: string;
  readonly subject?: {
    readonly rawSubjectId: string;
    readonly recipientContext: string;
    readonly purpose: string;
    readonly jurisdictionCell: string;
    readonly keyVersion: number;
  };
};

/**
 * ACCESS-08 Access Fabric commitments on the existing SunRey Chain.
 *
 * The service turns access-domain lifecycle events into privacy-safe chain
 * commitments and keeps a deterministic access state that any node can rebuild
 * from the committed event log. It writes no journal, mints nothing, and never
 * moves ownership.
 */
export class AccessRightsChainService {
  private readonly chain: SunReyChainService;
  private readonly clock: Clock;
  private readonly ports: AccessChainPorts;
  private readonly recordsById = new Map<AccessCommitmentRecordId, AccessCommitmentRecord>();
  private readonly recordsByDomainKey = new Map<string, AccessCommitmentRecordId>();
  private readonly eventLog: AccessCommittedEvent[] = [];
  private accessState: AccessChainState = emptyAccessChainState();

  constructor(options: {
    readonly chain: SunReyChainService;
    readonly clock: Clock;
    readonly ports: AccessChainPorts;
  }) {
    this.chain = options.chain;
    this.clock = options.clock;
    this.ports = options.ports;
  }

  commitAccessRight(
    request: AccessRightCommitmentRequest,
  ): Result<AccessCommitmentRecord, AccessChainFailure> {
    const labelCheck = assertPrivacySafeAccessLabels({
      scopeLabel: request.scopeLabel,
      purpose: request.purpose,
      restrictionLabels: request.restrictionLabels,
      permittedOperations: request.permittedOperations,
      policyRef: request.references.policyRef,
      consentRef: request.references.consentRef,
      provenanceRef: request.references.provenanceRef,
      agreementRef: request.references.agreementRef,
    });
    if (labelCheck) {
      return err(labelCheck);
    }
    const classCheck = validateAccessRightClass(request.rightClass, request.permittedOperations);
    if (classCheck) {
      return err(classCheck);
    }
    const referenceCheck = validateReferences(request.references, request.jurisdictionCell);
    if (referenceCheck) {
      return err(referenceCheck);
    }
    const capabilityCheck = validateActorCapability(
      this.ports.actors,
      request.issuerActorRef,
      'ACCESS_RIGHT_CREATED',
    );
    if (capabilityCheck) {
      return err(capabilityCheck);
    }
    const authorityCheck = validateRightsAuthority(
      this.ports.actors,
      request.issuerActorRef,
      request.target.productiveObjectId,
    );
    if (authorityCheck) {
      return err(authorityCheck);
    }
    const targetCheck = validateProductiveTarget(
      this.ports.productiveObjects,
      request.target,
      request.blockHeight,
      request.blockTimeUnixSeconds,
    );
    if (targetCheck) {
      return err(targetCheck);
    }

    const holder = this.chain.createSubjectReference({
      kind: 'PSEUDONYMOUS_SUBJECT_REFERENCE',
      rawSubjectId: request.holder.rawSubjectId,
      recipientContext: request.holder.recipientContext,
      purpose: request.holder.purpose,
      jurisdictionCell: request.holder.jurisdictionCell,
      keyVersion: request.holder.keyVersion,
    });
    const protocolRightType = ACCESS_RIGHT_CLASS_TO_PROTOCOL_RIGHT_TYPE[request.rightClass];
    const scope = scopeCommitment({
      scopeLabel: request.scopeLabel,
      purpose: request.purpose,
      permittedOperations: request.permittedOperations,
      geographyRef: request.target.geographyRef,
      jurisdictionCell: request.jurisdictionCell,
    });
    const restrictions = restrictionsCommitment(request.restrictionLabels);
    const rightId = asAccessRightId(String(request.rightId));
    const commitment = accessRightCreatedCommitment({
      rightId,
      rightClass: request.rightClass,
      protocolRightType,
      productiveObjectId: request.target.productiveObjectId,
      capacityUnit: request.target.capacityUnit,
      capacityQuantity: request.target.capacityQuantity,
      holderCommitment: holder.commitment,
      issuerActorRef: request.issuerActorRef,
      scopeCommitment: scope,
      restrictionsCommitment: restrictions,
      policyRef: request.references.policyRef,
      consentRef: request.references.consentRef,
      provenanceRef: request.references.provenanceRef,
      agreementRef: request.references.agreementRef,
      validFromUnixSeconds: request.validFromUnixSeconds,
      expiresAtUnixSeconds: request.expiresAtUnixSeconds,
      transferable: request.transferable,
    });

    return this.commit({
      kind: 'ACCESS_RIGHT_CREATED',
      subjectRef: rightId,
      payloadCommitment: commitment,
      schema: buildAccessRightCreatedSchema({
        rightId,
        rightClass: request.rightClass,
        protocolRightType,
        rightCommitment: commitment,
        productiveObjectId: request.target.productiveObjectId,
        capacityUnit: request.target.capacityUnit,
        capacityQuantity: request.target.capacityQuantity,
        holderReference: holder.referenceId,
        issuerActorRef: request.issuerActorRef,
        scopeCommitment: scope,
        restrictionsCommitment: restrictions,
        policyRef: request.references.policyRef,
        consentRef: request.references.consentRef,
        provenanceRef: request.references.provenanceRef,
        agreementRef: request.references.agreementRef,
        validFromUnixSeconds: request.validFromUnixSeconds,
        expiresAtUnixSeconds: request.expiresAtUnixSeconds,
        transferable: request.transferable,
        blockHeight: request.blockHeight,
      }),
      payload: {
        kind: 'ACCESS_RIGHT_CREATED',
        rightId,
        rightClass: request.rightClass,
        protocolRightType,
        productiveObjectId: request.target.productiveObjectId,
        capacityUnit: request.target.capacityUnit,
        capacityQuantity: request.target.capacityQuantity,
        holderCommitment: holder.commitment,
        issuerActorRef: request.issuerActorRef,
        scopeCommitment: scope,
        restrictionsCommitment: restrictions,
        validFromUnixSeconds: request.validFromUnixSeconds,
        expiresAtUnixSeconds: request.expiresAtUnixSeconds,
        transferable: request.transferable,
      },
      blockTimeUnixSeconds: request.blockTimeUnixSeconds,
      blockHeight: request.blockHeight,
      jurisdictionCell: request.jurisdictionCell,
      policyRef: request.references.policyRef,
      purpose: request.purpose,
      subject: {
        rawSubjectId: request.holder.rawSubjectId,
        recipientContext: request.holder.recipientContext,
        purpose: request.holder.purpose,
        jurisdictionCell: request.holder.jurisdictionCell,
        keyVersion: request.holder.keyVersion,
      },
    });
  }

  revokeAccessRight(
    request: AccessRightRevocationRequest,
  ): Result<AccessCommitmentRecord, AccessChainFailure> {
    const rightId = asAccessRightId(String(request.rightId));
    const right = this.accessState.rights.get(rightId);
    if (!right) {
      return err({ code: 'ACCESS_RIGHT_UNKNOWN', message: `right ${rightId} does not exist` });
    }
    const labelCheck = assertPrivacySafeAccessLabels({
      reasonCode: request.reasonCode,
      policyRef: request.policyRef,
    });
    if (labelCheck) {
      return err(labelCheck);
    }
    const capabilityCheck = validateActorCapability(
      this.ports.actors,
      request.revokingActorRef,
      'ACCESS_RIGHT_REVOKED',
    );
    if (capabilityCheck) {
      return err(capabilityCheck);
    }
    const authorityCheck = validateRightsAuthority(
      this.ports.actors,
      request.revokingActorRef,
      right.productiveObjectId,
    );
    if (authorityCheck) {
      return err(authorityCheck);
    }
    const priorCommitment = this.priorCommitmentFor('ACCESS_RIGHT_CREATED', rightId);
    const commitment = accessRightRevokedCommitment({
      rightId,
      priorCommitment,
      revokingActorRef: request.revokingActorRef,
      reasonCode: request.reasonCode,
      policyRef: request.policyRef,
      revokedAtUnixSeconds: request.blockTimeUnixSeconds,
    });
    return this.commit({
      kind: 'ACCESS_RIGHT_REVOKED',
      subjectRef: rightId,
      payloadCommitment: commitment,
      schema: buildAccessRightRevokedSchema({
        rightId,
        revocationCommitment: commitment,
        priorCommitment,
        revokingActorRef: request.revokingActorRef,
        reasonCode: request.reasonCode,
        policyRef: request.policyRef,
        revokedAtUnixSeconds: request.blockTimeUnixSeconds,
        blockHeight: request.blockHeight,
      }),
      payload: {
        kind: 'ACCESS_RIGHT_REVOKED',
        rightId,
        reasonCode: request.reasonCode,
        revokedAtUnixSeconds: request.blockTimeUnixSeconds,
      },
      blockTimeUnixSeconds: request.blockTimeUnixSeconds,
      blockHeight: request.blockHeight,
      jurisdictionCell: this.jurisdictionFor(rightId),
      policyRef: request.policyRef,
      purpose: 'sunrey.access.right.revoke',
    });
  }

  commitReservation(
    request: ReservationCommitmentRequest,
  ): Result<AccessCommitmentRecord, AccessChainFailure> {
    const rightId = asAccessRightId(String(request.rightId));
    const reservationId = asAccessReservationId(String(request.reservationId));
    const right = this.accessState.rights.get(rightId);
    if (!right) {
      return err({ code: 'ACCESS_RIGHT_UNKNOWN', message: `right ${rightId} does not exist` });
    }
    const labelCheck = assertPrivacySafeAccessLabels({
      purpose: request.purpose,
      policyRef: request.policyRef,
    });
    if (labelCheck) {
      return err(labelCheck);
    }
    const capabilityCheck = validateActorCapability(
      this.ports.actors,
      request.requestingActorRef,
      'RESERVATION_COMMITTED',
    );
    if (capabilityCheck) {
      return err(capabilityCheck);
    }
    const targetCheck = validateProductiveTarget(
      this.ports.productiveObjects,
      {
        productiveObjectId: right.productiveObjectId,
        capacityUnit: right.capacityUnit,
        capacityQuantity: request.quantity,
        geographyRef: '',
      },
      request.blockHeight,
      request.blockTimeUnixSeconds,
    );
    if (targetCheck) {
      return err(targetCheck);
    }
    const rightCommitment = this.priorCommitmentFor('ACCESS_RIGHT_CREATED', rightId);
    const commitment = reservationCommittedCommitment({
      reservationId,
      rightId,
      rightCommitment,
      productiveObjectId: right.productiveObjectId,
      quantity: request.quantity,
      startsAtUnixSeconds: request.startsAtUnixSeconds,
      endsAtUnixSeconds: request.endsAtUnixSeconds,
      holdExpiresAtUnixSeconds: request.holdExpiresAtUnixSeconds,
      requestingActorRef: request.requestingActorRef,
      purpose: request.purpose,
      policyRef: request.policyRef,
    });
    return this.commit({
      kind: 'RESERVATION_COMMITTED',
      subjectRef: reservationId,
      payloadCommitment: commitment,
      schema: buildReservationCommittedSchema({
        reservationId,
        rightId,
        reservationCommitment: commitment,
        rightCommitment,
        productiveObjectId: right.productiveObjectId,
        quantity: request.quantity,
        startsAtUnixSeconds: request.startsAtUnixSeconds,
        endsAtUnixSeconds: request.endsAtUnixSeconds,
        holdExpiresAtUnixSeconds: request.holdExpiresAtUnixSeconds,
        requestingActorRef: request.requestingActorRef,
        policyRef: request.policyRef,
        blockHeight: request.blockHeight,
      }),
      payload: {
        kind: 'RESERVATION_COMMITTED',
        reservationId,
        rightId,
        quantity: request.quantity,
        startsAtUnixSeconds: request.startsAtUnixSeconds,
        endsAtUnixSeconds: request.endsAtUnixSeconds,
        holdExpiresAtUnixSeconds: request.holdExpiresAtUnixSeconds,
      },
      blockTimeUnixSeconds: request.blockTimeUnixSeconds,
      blockHeight: request.blockHeight,
      jurisdictionCell: this.jurisdictionFor(rightId),
      policyRef: request.policyRef,
      purpose: request.purpose,
    });
  }

  confirmReservation(
    request: ReservationTransitionRequest,
  ): Result<AccessCommitmentRecord, AccessChainFailure> {
    return this.transitionReservation('RESERVATION_CONFIRMED', 'CONFIRMED', request);
  }

  expireReservation(
    request: ReservationTransitionRequest,
  ): Result<AccessCommitmentRecord, AccessChainFailure> {
    return this.transitionReservation('RESERVATION_EXPIRED', 'EXPIRED', request);
  }

  cancelReservation(
    request: ReservationTransitionRequest,
  ): Result<AccessCommitmentRecord, AccessChainFailure> {
    return this.transitionReservation('RESERVATION_CANCELLED', 'CANCELLED', request);
  }

  commitUsage(request: UsageCommitmentRequest): Result<AccessCommitmentRecord, AccessChainFailure> {
    const rightId = asAccessRightId(String(request.rightId));
    const usageId = asAccessUsageId(String(request.usageId));
    const reservationId =
      request.reservationId === undefined || request.reservationId === null
        ? null
        : asAccessReservationId(String(request.reservationId));
    const right = this.accessState.rights.get(rightId);
    if (!right) {
      return err({ code: 'ACCESS_RIGHT_UNKNOWN', message: `right ${rightId} does not exist` });
    }
    const labelCheck = assertPrivacySafeAccessLabels({
      purpose: request.purpose,
      measurementRef: request.measurementRef,
    });
    if (labelCheck) {
      return err(labelCheck);
    }
    const capabilityCheck = validateActorCapability(
      this.ports.actors,
      request.actorRef,
      'USAGE_COMMITTED',
    );
    if (capabilityCheck) {
      return err(capabilityCheck);
    }
    const commitment = usageCommittedCommitment({
      usageId,
      rightId,
      reservationId,
      productiveObjectId: right.productiveObjectId,
      quantity: request.quantity,
      measurementRef: request.measurementRef,
      actorRef: request.actorRef,
      purpose: request.purpose,
      committedAtUnixSeconds: request.blockTimeUnixSeconds,
    });
    return this.commit({
      kind: 'USAGE_COMMITTED',
      subjectRef: usageId,
      payloadCommitment: commitment,
      schema: buildUsageCommittedSchema({
        usageId,
        rightId,
        reservationId,
        usageCommitment: commitment,
        productiveObjectId: right.productiveObjectId,
        quantity: request.quantity,
        measurementRef: request.measurementRef,
        actorRef: request.actorRef,
        committedAtUnixSeconds: request.blockTimeUnixSeconds,
        blockHeight: request.blockHeight,
      }),
      payload: {
        kind: 'USAGE_COMMITTED',
        usageId,
        rightId,
        reservationId,
        quantity: request.quantity,
        committedAtUnixSeconds: request.blockTimeUnixSeconds,
      },
      blockTimeUnixSeconds: request.blockTimeUnixSeconds,
      blockHeight: request.blockHeight,
      jurisdictionCell: this.jurisdictionFor(rightId),
      policyRef: ACCESS_CHAIN_POLICY_VERSION,
      purpose: request.purpose,
    });
  }

  commitDelivery(
    request: DeliveryCommitmentRequest,
  ): Result<AccessCommitmentRecord, AccessChainFailure> {
    const usageId = asAccessUsageId(String(request.usageId));
    const deliveryId = asAccessDeliveryId(String(request.deliveryId));
    const usage = this.accessState.usages.get(usageId);
    if (!usage) {
      return err({ code: 'ACCESS_USAGE_UNKNOWN', message: `usage ${usageId} does not exist` });
    }
    const labelCheck = assertPrivacySafeAccessLabels({
      outcomeCode: request.outcomeCode,
      evidenceRef: request.evidenceRef,
    });
    if (labelCheck) {
      return err(labelCheck);
    }
    const capabilityCheck = validateActorCapability(
      this.ports.actors,
      request.attestingActorRef,
      'DELIVERY_COMMITTED',
    );
    if (capabilityCheck) {
      return err(capabilityCheck);
    }
    const usageCommitment = this.priorCommitmentFor('USAGE_COMMITTED', usageId);
    const commitment = deliveryCommittedCommitment({
      deliveryId,
      usageId,
      usageCommitment,
      attestingActorRef: request.attestingActorRef,
      outcomeCode: request.outcomeCode,
      evidenceRef: request.evidenceRef,
      committedAtUnixSeconds: request.blockTimeUnixSeconds,
    });
    return this.commit({
      kind: 'DELIVERY_COMMITTED',
      subjectRef: deliveryId,
      payloadCommitment: commitment,
      schema: buildDeliveryCommittedSchema({
        deliveryId,
        usageId,
        deliveryCommitment: commitment,
        usageCommitment,
        attestingActorRef: request.attestingActorRef,
        outcomeCode: request.outcomeCode,
        evidenceRef: request.evidenceRef,
        committedAtUnixSeconds: request.blockTimeUnixSeconds,
        blockHeight: request.blockHeight,
      }),
      payload: {
        kind: 'DELIVERY_COMMITTED',
        deliveryId,
        usageId,
        outcomeCode: request.outcomeCode,
        committedAtUnixSeconds: request.blockTimeUnixSeconds,
      },
      blockTimeUnixSeconds: request.blockTimeUnixSeconds,
      blockHeight: request.blockHeight,
      jurisdictionCell: this.jurisdictionFor(usage.rightId),
      policyRef: ACCESS_CHAIN_POLICY_VERSION,
      purpose: 'sunrey.access.delivery.attest',
    });
  }

  /**
   * References a settlement the canonical ledger already recorded. The Access
   * Fabric never creates a settlement and never posts a journal.
   */
  referenceSettlementEvidence(
    request: SettlementEvidenceRequest,
  ): Result<AccessCommitmentRecord, AccessChainFailure> {
    const deliveryId = asAccessDeliveryId(String(request.deliveryId));
    const settlementEvidenceId = asAccessSettlementEvidenceId(String(request.settlementEvidenceId));
    const delivery = this.accessState.deliveries.get(deliveryId);
    if (!delivery) {
      return err({ code: 'ACCESS_DELIVERY_UNKNOWN', message: `delivery ${deliveryId} does not exist` });
    }
    const capabilityCheck = validateActorCapability(
      this.ports.actors,
      request.actorRef,
      'SETTLEMENT_EVIDENCE_REFERENCE',
    );
    if (capabilityCheck) {
      return err(capabilityCheck);
    }
    const canonical = this.ports.settlement.lookupSettlement(
      request.settlement.journalId,
      request.settlement.transferId,
    );
    if (!canonical || canonical.assetCommitment !== request.settlement.assetCommitment) {
      return err({
        code: 'ACCESS_SETTLEMENT_NOT_CANONICAL',
        message: 'settlement reference is not recorded in the canonical internal ledger',
      });
    }
    const usage = this.accessState.usages.get(delivery.usageId);
    const deliveryCommitment = this.priorCommitmentFor('DELIVERY_COMMITTED', deliveryId);
    const commitment = settlementEvidenceCommitment({
      settlementEvidenceId,
      deliveryId,
      deliveryCommitment,
      journalId: canonical.journalId,
      transferId: canonical.transferId,
      assetCommitment: canonical.assetCommitment,
      referencedAtUnixSeconds: request.blockTimeUnixSeconds,
    });
    return this.commit({
      kind: 'SETTLEMENT_EVIDENCE_REFERENCE',
      subjectRef: settlementEvidenceId,
      payloadCommitment: commitment,
      schema: buildSettlementEvidenceSchema({
        settlementEvidenceId,
        deliveryId,
        settlementCommitment: commitment,
        journalId: canonical.journalId,
        transferId: canonical.transferId,
        assetCommitment: canonical.assetCommitment,
        referencedAtUnixSeconds: request.blockTimeUnixSeconds,
        blockHeight: request.blockHeight,
      }),
      payload: {
        kind: 'SETTLEMENT_EVIDENCE_REFERENCE',
        settlementEvidenceId,
        deliveryId,
        journalId: canonical.journalId,
        transferId: canonical.transferId,
      },
      blockTimeUnixSeconds: request.blockTimeUnixSeconds,
      blockHeight: request.blockHeight,
      jurisdictionCell: usage ? this.jurisdictionFor(usage.rightId) : ACCESS_CHAIN_POLICY_VERSION,
      policyRef: ACCESS_CHAIN_POLICY_VERSION,
      purpose: 'sunrey.access.settlement.reference',
    });
  }

  state(): AccessChainState {
    return this.accessState;
  }

  events(): readonly AccessCommittedEvent[] {
    return [...this.eventLog];
  }

  records(): readonly AccessCommitmentRecord[] {
    return [...this.recordsById.values()].sort((left, right) => left.sequence - right.sequence);
  }

  record(recordId: AccessCommitmentRecordId | string): AccessCommitmentRecord | undefined {
    return this.recordsById.get(recordId as AccessCommitmentRecordId);
  }

  stateCommitment(): string {
    return accessStateCommitment(this.accessState);
  }

  /** Rebuilds state from the committed log. Must equal the live state. */
  replay(): Result<AccessChainState, AccessChainFailure> {
    return replayAccessEvents(this.eventLog);
  }

  rightProjection(rightId: string): AccessRightProjection | undefined {
    return this.accessState.rights.get(rightId);
  }

  reservationProjection(reservationId: string): AccessReservationProjection | undefined {
    return this.accessState.reservations.get(reservationId);
  }

  usageProjection(usageId: string): AccessUsageProjection | undefined {
    return this.accessState.usages.get(usageId);
  }

  deliveryProjection(deliveryId: string): AccessDeliveryProjection | undefined {
    return this.accessState.deliveries.get(deliveryId);
  }

  settlementProjection(settlementEvidenceId: string): AccessSettlementProjection | undefined {
    return this.accessState.settlements.get(settlementEvidenceId);
  }

  /**
   * Re-reads chain operation state for every commitment. Access state itself is
   * derived from the committed log, so chain finality changes the confidence in
   * a record, never the access state a replay would produce.
   */
  synchronizeFinality(): AccessSynchronizationReport {
    const now = this.clock.now();
    const projections: AccessFinalityProjection[] = [];
    let final = 0;
    let pending = 0;
    let reviewRequired = 0;
    let rejected = 0;
    let unknown = 0;
    for (const record of this.records()) {
      const status = record.operationId ? this.chain.operationStatus(record.operationId) : undefined;
      const operation = record.operationId ? this.chain.getOperation(record.operationId) : undefined;
      const chainState = status?.state ?? record.chainState;
      const finality = accessFinalityFor(chainState);
      const updated: AccessCommitmentRecord = {
        ...record,
        chainState,
        finality,
        confirmations: status?.confirmations ?? record.confirmations,
        transactionId: operation?.transactionId ?? record.transactionId,
        receiptId: operation?.receiptId ?? record.receiptId,
        blockReference: operation?.blockReference ?? record.blockReference,
        updatedAt: now,
      };
      this.recordsById.set(record.recordId, updated);
      projections.push({
        recordId: updated.recordId,
        kind: updated.kind,
        sequence: updated.sequence,
        chainState,
        finality,
        confirmations: updated.confirmations,
        transactionId: updated.transactionId,
        blockReference: updated.blockReference,
        applicationStateRewrittenByChain: false,
      });
      if (finality === 'FINAL') {
        final += 1;
      } else if (finality === 'PENDING') {
        pending += 1;
      } else if (finality === 'REVIEW_REQUIRED') {
        reviewRequired += 1;
      } else if (finality === 'REJECTED') {
        rejected += 1;
      } else {
        unknown += 1;
      }
    }
    return {
      synchronizedAt: now,
      stateCommitment: this.stateCommitment(),
      sequence: this.accessState.sequence,
      total: projections.length,
      final,
      pending,
      reviewRequired,
      rejected,
      unknown,
      projections,
    };
  }

  reconcile(
    recordId: AccessCommitmentRecordId | string,
  ): Result<ReconciliationRecord, AccessChainFailure> {
    const record = this.recordsById.get(recordId as AccessCommitmentRecordId);
    if (!record || !record.operationId) {
      return err({
        code: 'ACCESS_CHAIN_WRITE_DENIED',
        message: `record ${String(recordId)} has no chain operation to reconcile`,
      });
    }
    const reconciled = this.chain.reconcile(record.operationId);
    if (!reconciled.ok) {
      return err({ code: 'ACCESS_CHAIN_UNAVAILABLE', message: reconciled.error.message });
    }
    return ok(reconciled.value);
  }

  private transitionReservation(
    kind: 'RESERVATION_CONFIRMED' | 'RESERVATION_EXPIRED' | 'RESERVATION_CANCELLED',
    nextState: 'CONFIRMED' | 'EXPIRED' | 'CANCELLED',
    request: ReservationTransitionRequest,
  ): Result<AccessCommitmentRecord, AccessChainFailure> {
    const reservationId = asAccessReservationId(String(request.reservationId));
    const reservation = this.accessState.reservations.get(reservationId);
    if (!reservation) {
      return err({
        code: 'ACCESS_RESERVATION_UNKNOWN',
        message: `reservation ${reservationId} does not exist`,
      });
    }
    const labelCheck = assertPrivacySafeAccessLabels({ reasonCode: request.reasonCode });
    if (labelCheck) {
      return err(labelCheck);
    }
    const capabilityCheck = validateActorCapability(this.ports.actors, request.actorRef, kind);
    if (capabilityCheck) {
      return err(capabilityCheck);
    }
    const priorCommitment = this.priorCommitmentFor('RESERVATION_COMMITTED', reservationId);
    const commitment = reservationTransitionCommitment(kind, {
      reservationId,
      rightId: reservation.rightId,
      priorCommitment,
      priorState: reservation.state,
      nextState,
      actorRef: request.actorRef,
      reasonCode: request.reasonCode,
      effectiveAtUnixSeconds: request.blockTimeUnixSeconds,
    });
    return this.commit({
      kind,
      subjectRef: reservationId,
      payloadCommitment: commitment,
      schema: buildReservationTransitionSchema(kind, {
        reservationId,
        rightId: reservation.rightId,
        transitionCommitment: commitment,
        priorCommitment,
        priorState: reservation.state,
        nextState,
        actorRef: request.actorRef,
        reasonCode: request.reasonCode,
        effectiveAtUnixSeconds: request.blockTimeUnixSeconds,
        blockHeight: request.blockHeight,
      }),
      payload: {
        kind,
        reservationId,
        reasonCode: request.reasonCode,
        effectiveAtUnixSeconds: request.blockTimeUnixSeconds,
      },
      blockTimeUnixSeconds: request.blockTimeUnixSeconds,
      blockHeight: request.blockHeight,
      jurisdictionCell: this.jurisdictionFor(reservation.rightId),
      policyRef: ACCESS_CHAIN_POLICY_VERSION,
      purpose: `sunrey.access.reservation.${nextState.toLowerCase()}`,
    });
  }

  private commit(plan: CommitPlan): Result<AccessCommitmentRecord, AccessChainFailure> {
    const domainKey = `${plan.kind}:${plan.subjectRef}`;
    const commitmentKey = accessCommitmentKey({
      kind: plan.kind,
      subjectRef: plan.subjectRef,
      payloadCommitment: plan.payloadCommitment,
    });
    const existingId = this.recordsByDomainKey.get(domainKey);
    if (existingId) {
      const existing = this.recordsById.get(existingId);
      if (existing && existing.commitmentKey === commitmentKey) {
        return ok({ ...existing, duplicateOf: existing.recordId });
      }
      return err({
        code: 'ACCESS_COMMITMENT_CONFLICT',
        message: `${domainKey} was already committed with a different commitment`,
      });
    }

    const privacyCheck = assertPrivacySafeAccessFields(plan.schema.fields);
    if (privacyCheck) {
      return err(privacyCheck);
    }

    const event: AccessCommittedEvent = {
      schemaVersion: 1,
      sequence: this.accessState.sequence + 1,
      kind: plan.kind,
      commitmentKey,
      payloadCommitment: plan.payloadCommitment,
      payload: plan.payload,
      blockTimeUnixSeconds: plan.blockTimeUnixSeconds,
      blockHeight: plan.blockHeight,
      conveysOwnership: false,
      mintsAsset: false,
    };
    const candidate = applyAccessEvent(this.accessState, event);
    if (!candidate.ok) {
      return err(candidate.error);
    }

    const intent = this.chain.createIntent({
      recordType: chainRecordTypeForAccessKind(plan.kind),
      sourceSubsystem: ACCESS_CHAIN_SOURCE_SUBSYSTEM,
      sourceRecordReference: plan.subjectRef,
      purpose: plan.purpose,
      schema: plan.schema,
      policyVersion: ACCESS_CHAIN_POLICY_VERSION,
      jurisdictionCell: plan.jurisdictionCell,
      correlationId: `access:${plan.kind}:${plan.subjectRef}`,
      ...(plan.subject
        ? { subject: { kind: 'PSEUDONYMOUS_SUBJECT_REFERENCE' as const, ...plan.subject } }
        : {}),
    });
    if (!intent.ok) {
      return err({ code: 'ACCESS_CHAIN_WRITE_DENIED', message: intent.error.message });
    }
    const submitted = this.chain.submit(intent.value.intentId);
    if (!submitted.ok) {
      return err({ code: 'ACCESS_CHAIN_UNAVAILABLE', message: submitted.error.message });
    }

    const now = this.clock.now();
    const recordId = accessCommitmentRecordIdFrom(commitmentKey);
    const record: AccessCommitmentRecord = {
      recordId,
      kind: plan.kind,
      chainRecordType: intent.value.recordType,
      commitmentKey,
      payloadCommitment: plan.payloadCommitment,
      holderCommitment: intent.value.subjectReference?.commitment ?? null,
      sequence: event.sequence,
      intentId: intent.value.intentId,
      operationId: submitted.value.operationId,
      transactionId: submitted.value.transactionId,
      receiptId: submitted.value.receiptId,
      blockReference: submitted.value.blockReference,
      chainState: submitted.value.state,
      finality: accessFinalityFor(submitted.value.state),
      confirmations: submitted.value.confirmations,
      policyRef: plan.policyRef,
      jurisdictionCell: plan.jurisdictionCell,
      createdAt: now,
      updatedAt: now,
      duplicateOf: null,
      rawPersonalDataOnChain: false,
      conveysOwnership: false,
      mintsAsset: false,
      altersLedger: false,
    };
    this.accessState = candidate.value;
    this.eventLog.push(event);
    this.recordsById.set(recordId, record);
    this.recordsByDomainKey.set(domainKey, recordId);
    return ok(record);
  }

  private priorCommitmentFor(kind: AccessCommitmentKind, subjectRef: string): string {
    const recordId = this.recordsByDomainKey.get(`${kind}:${subjectRef}`);
    const record = recordId ? this.recordsById.get(recordId) : undefined;
    return record?.payloadCommitment ?? '';
  }

  private jurisdictionFor(rightId: string): string {
    const recordId = this.recordsByDomainKey.get(`ACCESS_RIGHT_CREATED:${rightId}`);
    const record = recordId ? this.recordsById.get(recordId) : undefined;
    return record?.jurisdictionCell ?? 'UNSPECIFIED';
  }
}
