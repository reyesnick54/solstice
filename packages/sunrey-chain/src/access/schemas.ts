import type { ChainRecordSchema } from '../types.ts';
import { quantityLabel, unixSecondsLabel } from './commitments.ts';
import { chainRecordTypeForAccessKind } from './taxonomy.ts';

/**
 * Chain payloads for the Access Fabric. Every field is a commitment, an
 * identifier, a policy or evidence reference, a timestamp, or a state label.
 */

export function buildAccessRightCreatedSchema(fields: {
  readonly rightId: string;
  readonly rightClass: string;
  readonly protocolRightType: string;
  readonly rightCommitment: string;
  readonly productiveObjectId: string;
  readonly capacityUnit: string;
  readonly capacityQuantity: bigint;
  readonly holderReference: string;
  readonly issuerActorRef: string;
  readonly scopeCommitment: string;
  readonly restrictionsCommitment: string;
  readonly policyRef: string;
  readonly consentRef: string;
  readonly provenanceRef: string;
  readonly agreementRef: string;
  readonly validFromUnixSeconds: bigint;
  readonly expiresAtUnixSeconds: bigint;
  readonly transferable: boolean;
  readonly blockHeight: number;
}): ChainRecordSchema {
  return {
    recordType: chainRecordTypeForAccessKind('ACCESS_RIGHT_CREATED'),
    dataClass: 'ON_CHAIN_SAFE',
    fields: {
      evidenceKind: 'ACCESS_RIGHT_CREATED',
      rightId: fields.rightId,
      rightClass: fields.rightClass,
      protocolRightType: fields.protocolRightType,
      rightCommitment: fields.rightCommitment,
      productiveObjectId: fields.productiveObjectId,
      capacityUnit: fields.capacityUnit,
      capacityQuantity: quantityLabel(fields.capacityQuantity),
      holderReference: fields.holderReference,
      issuerActorRef: fields.issuerActorRef,
      scopeCommitment: fields.scopeCommitment,
      restrictionsCommitment: fields.restrictionsCommitment,
      policyRef: fields.policyRef,
      consentRef: fields.consentRef,
      provenanceRef: fields.provenanceRef,
      agreementRef: fields.agreementRef,
      validFrom: unixSecondsLabel(fields.validFromUnixSeconds),
      expiresAt: unixSecondsLabel(fields.expiresAtUnixSeconds),
      state: 'ACTIVE',
      transferable: fields.transferable,
      conveysOwnership: false,
      mintsAsset: false,
      blockHeight: fields.blockHeight,
    },
  };
}

export function buildAccessRightRevokedSchema(fields: {
  readonly rightId: string;
  readonly revocationCommitment: string;
  readonly priorCommitment: string;
  readonly revokingActorRef: string;
  readonly reasonCode: string;
  readonly policyRef: string;
  readonly revokedAtUnixSeconds: bigint;
  readonly blockHeight: number;
}): ChainRecordSchema {
  return {
    recordType: chainRecordTypeForAccessKind('ACCESS_RIGHT_REVOKED'),
    dataClass: 'ON_CHAIN_SAFE',
    fields: {
      evidenceKind: 'ACCESS_RIGHT_REVOKED',
      rightId: fields.rightId,
      revocationCommitment: fields.revocationCommitment,
      priorCommitment: fields.priorCommitment,
      revokingActorRef: fields.revokingActorRef,
      reasonCode: fields.reasonCode,
      policyRef: fields.policyRef,
      revokedAt: unixSecondsLabel(fields.revokedAtUnixSeconds),
      state: 'REVOKED',
      historicalCommitmentImmutable: true,
      conveysOwnership: false,
      blockHeight: fields.blockHeight,
    },
  };
}

export function buildReservationCommittedSchema(fields: {
  readonly reservationId: string;
  readonly rightId: string;
  readonly reservationCommitment: string;
  readonly rightCommitment: string;
  readonly productiveObjectId: string;
  readonly quantity: bigint;
  readonly startsAtUnixSeconds: bigint;
  readonly endsAtUnixSeconds: bigint;
  readonly holdExpiresAtUnixSeconds: bigint;
  readonly requestingActorRef: string;
  readonly policyRef: string;
  readonly blockHeight: number;
}): ChainRecordSchema {
  return {
    recordType: chainRecordTypeForAccessKind('RESERVATION_COMMITTED'),
    dataClass: 'ON_CHAIN_SAFE',
    fields: {
      evidenceKind: 'RESERVATION_COMMITTED',
      reservationId: fields.reservationId,
      rightId: fields.rightId,
      reservationCommitment: fields.reservationCommitment,
      rightCommitment: fields.rightCommitment,
      productiveObjectId: fields.productiveObjectId,
      quantity: quantityLabel(fields.quantity),
      startsAt: unixSecondsLabel(fields.startsAtUnixSeconds),
      endsAt: unixSecondsLabel(fields.endsAtUnixSeconds),
      holdExpiresAt: unixSecondsLabel(fields.holdExpiresAtUnixSeconds),
      requestingActorRef: fields.requestingActorRef,
      policyRef: fields.policyRef,
      state: 'COMMITTED',
      conveysOwnership: false,
      blockHeight: fields.blockHeight,
    },
  };
}

export function buildReservationTransitionSchema(
  kind: 'RESERVATION_CONFIRMED' | 'RESERVATION_EXPIRED' | 'RESERVATION_CANCELLED',
  fields: {
    readonly reservationId: string;
    readonly rightId: string;
    readonly transitionCommitment: string;
    readonly priorCommitment: string;
    readonly priorState: string;
    readonly nextState: string;
    readonly actorRef: string;
    readonly reasonCode: string;
    readonly effectiveAtUnixSeconds: bigint;
    readonly blockHeight: number;
  },
): ChainRecordSchema {
  return {
    recordType: chainRecordTypeForAccessKind(kind),
    dataClass: 'ON_CHAIN_SAFE',
    fields: {
      evidenceKind: kind,
      reservationId: fields.reservationId,
      rightId: fields.rightId,
      transitionCommitment: fields.transitionCommitment,
      priorCommitment: fields.priorCommitment,
      priorState: fields.priorState,
      state: fields.nextState,
      actorRef: fields.actorRef,
      reasonCode: fields.reasonCode,
      effectiveAt: unixSecondsLabel(fields.effectiveAtUnixSeconds),
      conveysOwnership: false,
      blockHeight: fields.blockHeight,
    },
  };
}

export function buildUsageCommittedSchema(fields: {
  readonly usageId: string;
  readonly rightId: string;
  readonly reservationId: string | null;
  readonly usageCommitment: string;
  readonly productiveObjectId: string;
  readonly quantity: bigint;
  readonly measurementRef: string;
  readonly actorRef: string;
  readonly committedAtUnixSeconds: bigint;
  readonly blockHeight: number;
}): ChainRecordSchema {
  return {
    recordType: chainRecordTypeForAccessKind('USAGE_COMMITTED'),
    dataClass: 'ON_CHAIN_SAFE',
    fields: {
      evidenceKind: 'USAGE_COMMITTED',
      usageId: fields.usageId,
      rightId: fields.rightId,
      reservationId: fields.reservationId,
      usageCommitment: fields.usageCommitment,
      productiveObjectId: fields.productiveObjectId,
      quantity: quantityLabel(fields.quantity),
      measurementRef: fields.measurementRef,
      actorRef: fields.actorRef,
      committedAt: unixSecondsLabel(fields.committedAtUnixSeconds),
      state: 'USED',
      conveysOwnership: false,
      mintsAsset: false,
      blockHeight: fields.blockHeight,
    },
  };
}

export function buildDeliveryCommittedSchema(fields: {
  readonly deliveryId: string;
  readonly usageId: string;
  readonly deliveryCommitment: string;
  readonly usageCommitment: string;
  readonly attestingActorRef: string;
  readonly outcomeCode: string;
  readonly evidenceRef: string;
  readonly committedAtUnixSeconds: bigint;
  readonly blockHeight: number;
}): ChainRecordSchema {
  return {
    recordType: chainRecordTypeForAccessKind('DELIVERY_COMMITTED'),
    dataClass: 'ON_CHAIN_SAFE',
    fields: {
      attestationHash: fields.deliveryCommitment,
      claimSchema: 'access.delivery.v1',
      issuer: fields.attestingActorRef,
      evidenceKind: 'DELIVERY_COMMITTED',
      deliveryId: fields.deliveryId,
      usageId: fields.usageId,
      usageCommitment: fields.usageCommitment,
      outcomeCode: fields.outcomeCode,
      evidenceRef: fields.evidenceRef,
      issuedAt: unixSecondsLabel(fields.committedAtUnixSeconds),
      revocationState: 'ACTIVE',
      state: 'DELIVERED',
      conveysOwnership: false,
      blockHeight: fields.blockHeight,
    },
  };
}

export function buildSettlementEvidenceSchema(fields: {
  readonly settlementEvidenceId: string;
  readonly deliveryId: string;
  readonly settlementCommitment: string;
  readonly journalId: string;
  readonly transferId: string;
  readonly assetCommitment: string;
  readonly referencedAtUnixSeconds: bigint;
  readonly blockHeight: number;
}): ChainRecordSchema {
  return {
    recordType: chainRecordTypeForAccessKind('SETTLEMENT_EVIDENCE_REFERENCE'),
    dataClass: 'ON_CHAIN_SAFE',
    fields: {
      journalId: fields.journalId,
      transferId: fields.transferId,
      assetCommitment: fields.assetCommitment,
      authoritativeLedger: 'canonical-internal-ledger',
      chainBalanceAuthoritative: false,
      evidenceKind: 'SETTLEMENT_EVIDENCE_REFERENCE',
      settlementEvidenceId: fields.settlementEvidenceId,
      deliveryId: fields.deliveryId,
      settlementCommitment: fields.settlementCommitment,
      referencedAt: unixSecondsLabel(fields.referencedAtUnixSeconds),
      state: 'SETTLED',
      mintsAsset: false,
      blockHeight: fields.blockHeight,
    },
  };
}
