import { commitCanonical } from '../hash.ts';
import type { AccessCommitmentKey } from './ids.ts';
import { ACCESS_COMMITMENT_DOMAINS, type AccessCommitmentKind } from './taxonomy.ts';

type CommitField = string | number | boolean | null;

function sortedEntries(
  fields: Readonly<Record<string, CommitField>>,
): Readonly<Record<string, CommitField>> {
  return Object.fromEntries(Object.entries(fields).sort(([left], [right]) => left.localeCompare(right)));
}

/**
 * Domain-separated commitment over canonically sorted fields. Two different
 * kinds can never collide even when their fields happen to be identical.
 */
export function commitAccessDomain(
  domain: string,
  fields: Readonly<Record<string, CommitField>>,
): string {
  return commitCanonical({ domain, fields: sortedEntries(fields) });
}

/** Integer minor-unit style rendering. Never a float, never a locale string. */
export function quantityLabel(value: bigint): string {
  return value.toString(10);
}

export function unixSecondsLabel(value: bigint): string {
  return value.toString(10);
}

export function scopeCommitment(fields: {
  readonly scopeLabel: string;
  readonly purpose: string;
  readonly permittedOperations: readonly string[];
  readonly geographyRef: string;
  readonly jurisdictionCell: string;
}): string {
  return commitAccessDomain(ACCESS_COMMITMENT_DOMAINS.SCOPE, {
    scopeLabel: fields.scopeLabel,
    purpose: fields.purpose,
    permittedOperations: [...fields.permittedOperations].sort().join(','),
    geographyRef: fields.geographyRef,
    jurisdictionCell: fields.jurisdictionCell,
  });
}

export function restrictionsCommitment(labels: readonly string[]): string {
  return commitAccessDomain(ACCESS_COMMITMENT_DOMAINS.RESTRICTIONS, {
    labels: [...labels].sort().join(','),
    count: labels.length,
  });
}

export function accessRightCreatedCommitment(fields: {
  readonly rightId: string;
  readonly rightClass: string;
  readonly protocolRightType: string;
  readonly productiveObjectId: string;
  readonly capacityUnit: string;
  readonly capacityQuantity: bigint;
  readonly holderCommitment: string;
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
}): string {
  return commitAccessDomain(ACCESS_COMMITMENT_DOMAINS.ACCESS_RIGHT_CREATED, {
    rightId: fields.rightId,
    rightClass: fields.rightClass,
    protocolRightType: fields.protocolRightType,
    productiveObjectId: fields.productiveObjectId,
    capacityUnit: fields.capacityUnit,
    capacityQuantity: quantityLabel(fields.capacityQuantity),
    holderCommitment: fields.holderCommitment,
    issuerActorRef: fields.issuerActorRef,
    scopeCommitment: fields.scopeCommitment,
    restrictionsCommitment: fields.restrictionsCommitment,
    policyRef: fields.policyRef,
    consentRef: fields.consentRef,
    provenanceRef: fields.provenanceRef,
    agreementRef: fields.agreementRef,
    validFrom: unixSecondsLabel(fields.validFromUnixSeconds),
    expiresAt: unixSecondsLabel(fields.expiresAtUnixSeconds),
    transferable: fields.transferable,
    conveysOwnership: false,
  });
}

export function accessRightRevokedCommitment(fields: {
  readonly rightId: string;
  readonly priorCommitment: string;
  readonly revokingActorRef: string;
  readonly reasonCode: string;
  readonly policyRef: string;
  readonly revokedAtUnixSeconds: bigint;
}): string {
  return commitAccessDomain(ACCESS_COMMITMENT_DOMAINS.ACCESS_RIGHT_REVOKED, {
    rightId: fields.rightId,
    priorCommitment: fields.priorCommitment,
    revokingActorRef: fields.revokingActorRef,
    reasonCode: fields.reasonCode,
    policyRef: fields.policyRef,
    revokedAt: unixSecondsLabel(fields.revokedAtUnixSeconds),
  });
}

export function reservationCommittedCommitment(fields: {
  readonly reservationId: string;
  readonly rightId: string;
  readonly rightCommitment: string;
  readonly productiveObjectId: string;
  readonly quantity: bigint;
  readonly startsAtUnixSeconds: bigint;
  readonly endsAtUnixSeconds: bigint;
  readonly holdExpiresAtUnixSeconds: bigint;
  readonly requestingActorRef: string;
  readonly purpose: string;
  readonly policyRef: string;
}): string {
  return commitAccessDomain(ACCESS_COMMITMENT_DOMAINS.RESERVATION_COMMITTED, {
    reservationId: fields.reservationId,
    rightId: fields.rightId,
    rightCommitment: fields.rightCommitment,
    productiveObjectId: fields.productiveObjectId,
    quantity: quantityLabel(fields.quantity),
    startsAt: unixSecondsLabel(fields.startsAtUnixSeconds),
    endsAt: unixSecondsLabel(fields.endsAtUnixSeconds),
    holdExpiresAt: unixSecondsLabel(fields.holdExpiresAtUnixSeconds),
    requestingActorRef: fields.requestingActorRef,
    purpose: fields.purpose,
    policyRef: fields.policyRef,
  });
}

export function reservationTransitionCommitment(
  kind: Extract<
    AccessCommitmentKind,
    'RESERVATION_CONFIRMED' | 'RESERVATION_EXPIRED' | 'RESERVATION_CANCELLED'
  >,
  fields: {
    readonly reservationId: string;
    readonly rightId: string;
    readonly priorCommitment: string;
    readonly priorState: string;
    readonly nextState: string;
    readonly actorRef: string;
    readonly reasonCode: string;
    readonly effectiveAtUnixSeconds: bigint;
  },
): string {
  return commitAccessDomain(ACCESS_COMMITMENT_DOMAINS[kind], {
    reservationId: fields.reservationId,
    rightId: fields.rightId,
    priorCommitment: fields.priorCommitment,
    priorState: fields.priorState,
    nextState: fields.nextState,
    actorRef: fields.actorRef,
    reasonCode: fields.reasonCode,
    effectiveAt: unixSecondsLabel(fields.effectiveAtUnixSeconds),
  });
}

export function usageCommittedCommitment(fields: {
  readonly usageId: string;
  readonly rightId: string;
  readonly reservationId: string | null;
  readonly productiveObjectId: string;
  readonly quantity: bigint;
  readonly measurementRef: string;
  readonly actorRef: string;
  readonly purpose: string;
  readonly committedAtUnixSeconds: bigint;
}): string {
  return commitAccessDomain(ACCESS_COMMITMENT_DOMAINS.USAGE_COMMITTED, {
    usageId: fields.usageId,
    rightId: fields.rightId,
    reservationId: fields.reservationId,
    productiveObjectId: fields.productiveObjectId,
    quantity: quantityLabel(fields.quantity),
    measurementRef: fields.measurementRef,
    actorRef: fields.actorRef,
    purpose: fields.purpose,
    committedAt: unixSecondsLabel(fields.committedAtUnixSeconds),
  });
}

export function deliveryCommittedCommitment(fields: {
  readonly deliveryId: string;
  readonly usageId: string;
  readonly usageCommitment: string;
  readonly attestingActorRef: string;
  readonly outcomeCode: string;
  readonly evidenceRef: string;
  readonly committedAtUnixSeconds: bigint;
}): string {
  return commitAccessDomain(ACCESS_COMMITMENT_DOMAINS.DELIVERY_COMMITTED, {
    deliveryId: fields.deliveryId,
    usageId: fields.usageId,
    usageCommitment: fields.usageCommitment,
    attestingActorRef: fields.attestingActorRef,
    outcomeCode: fields.outcomeCode,
    evidenceRef: fields.evidenceRef,
    committedAt: unixSecondsLabel(fields.committedAtUnixSeconds),
  });
}

export function settlementEvidenceCommitment(fields: {
  readonly settlementEvidenceId: string;
  readonly deliveryId: string;
  readonly deliveryCommitment: string;
  readonly journalId: string;
  readonly transferId: string;
  readonly assetCommitment: string;
  readonly referencedAtUnixSeconds: bigint;
}): string {
  return commitAccessDomain(ACCESS_COMMITMENT_DOMAINS.SETTLEMENT_EVIDENCE_REFERENCE, {
    settlementEvidenceId: fields.settlementEvidenceId,
    deliveryId: fields.deliveryId,
    deliveryCommitment: fields.deliveryCommitment,
    journalId: fields.journalId,
    transferId: fields.transferId,
    assetCommitment: fields.assetCommitment,
    referencedAt: unixSecondsLabel(fields.referencedAtUnixSeconds),
    authoritativeLedger: 'canonical-internal-ledger',
    chainBalanceAuthoritative: false,
  });
}

/**
 * Idempotency key for a commitment. Two submissions that mean exactly the same
 * thing produce the same key; a submission that changes any committed field
 * produces a different key and is treated as a conflict, not a duplicate.
 */
export function accessCommitmentKey(input: {
  readonly kind: AccessCommitmentKind;
  readonly subjectRef: string;
  readonly payloadCommitment: string;
}): AccessCommitmentKey {
  return commitAccessDomain(ACCESS_COMMITMENT_DOMAINS.IDEMPOTENCY, {
    kind: input.kind,
    subjectRef: input.subjectRef,
    payloadCommitment: input.payloadCommitment,
  }) as AccessCommitmentKey;
}
