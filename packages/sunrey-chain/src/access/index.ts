/**
 * ACCESS-08 — SunRey Blockchain access rights, reservations, and commitments.
 *
 * Access Fabric economic rights recorded as privacy-safe commitments on the
 * existing SunRey Chain. This is not a new blockchain, a side ledger, a token
 * wrapper, or a mint. It records authoritative references and economic state:
 * commitments, rights identifiers, policy and consent references, provenance,
 * timestamps, state, and evidence references.
 *
 * Ownership and access are different rights. An access right points at a
 * productive object and permits bounded use of its capacity. No sequence of
 * access commitments transfers title.
 */

export {
  accessCommitmentKey,
  accessRightCreatedCommitment,
  accessRightRevokedCommitment,
  commitAccessDomain,
  deliveryCommittedCommitment,
  quantityLabel,
  reservationCommittedCommitment,
  reservationTransitionCommitment,
  restrictionsCommitment,
  scopeCommitment,
  settlementEvidenceCommitment,
  unixSecondsLabel,
  usageCommittedCommitment,
} from './commitments.ts';
export {
  accessCommitmentRecordIdFrom,
  asAccessDeliveryId,
  asAccessReservationId,
  asAccessRightId,
  asAccessSettlementEvidenceId,
  asAccessUsageId,
  type AccessCommitmentKey,
  type AccessCommitmentRecordId,
  type AccessDeliveryId,
  type AccessReservationId,
  type AccessRightId,
  type AccessSettlementEvidenceId,
  type AccessUsageId,
} from './ids.ts';
export {
  ACCESS_CHAIN_INVARIANTS,
  ACCESS_CHAIN_OWNER,
  ACCESS_COMMITMENT_ALTERS_LEDGER,
  ACCESS_COMMITMENT_ISSUES_EXECUTION_AUTHORITY,
  ACCESS_COMMITMENT_MINTS_ASSET,
  ACCESS_FABRIC_HAS_NATIVE_UNIT,
  ACCESS_RIGHT_CONVEYS_OWNERSHIP,
  ACCESS_STATE_IS_DETERMINISTIC_REPLAY,
  CHAIN_FINALITY_IS_NOT_RIGHTS_AUTHORITY,
  accessRightTransfersOwnership,
} from './invariants.ts';
export {
  createInMemoryActorRegistryPort,
  createInMemoryProductiveObjectPort,
  createInMemorySettlementEvidencePort,
  type AccessActorRegistryPort,
  type AccessChainPorts,
  type AccessProductiveObjectPort,
  type AccessSettlementEvidencePort,
} from './ports.ts';
export { assertPrivacySafeAccessFields, assertPrivacySafeAccessLabels } from './privacy.ts';
export {
  buildAccessRightCreatedSchema,
  buildAccessRightRevokedSchema,
  buildDeliveryCommittedSchema,
  buildReservationCommittedSchema,
  buildReservationTransitionSchema,
  buildSettlementEvidenceSchema,
  buildUsageCommittedSchema,
} from './schemas.ts';
export {
  ACCESS_CHAIN_POLICY_VERSION,
  ACCESS_CHAIN_SOURCE_SUBSYSTEM,
  AccessRightsChainService,
  accessFinalityFor,
} from './service.ts';
export {
  accessStateCommitment,
  accessStateSnapshot,
  applyAccessEvent,
  availableCapacity,
  effectiveRightState,
  emptyAccessChainState,
  replayAccessEvents,
} from './state.ts';
export {
  ACCESS_CAPABILITY_FOR_KIND,
  ACCESS_CAPABILITY_REFS,
  ACCESS_CHAIN_FAILURE_CODES,
  ACCESS_COMMITMENT_DOMAINS,
  ACCESS_COMMITMENT_KIND_TO_CHAIN_RECORD,
  ACCESS_COMMITMENT_KINDS,
  ACCESS_FINALITY_STATES,
  ACCESS_FORBIDDEN_PAYLOAD_KEYS,
  ACCESS_RESERVATION_STATES,
  ACCESS_RIGHT_CLASS_TO_PROTOCOL_RIGHT_TYPE,
  ACCESS_RIGHT_CLASSES,
  ACCESS_RIGHT_STATES,
  OWNERSHIP_CONVEYING_OPERATIONS,
  OWNERSHIP_RIGHT_CLASSES,
  chainRecordTypeForAccessKind,
  type AccessChainFailureCode,
  type AccessCommitmentKind,
  type AccessFinalityState,
  type AccessReservationState,
  type AccessRightClass,
  type AccessRightState,
} from './taxonomy.ts';
export type {
  AccessChainFailure,
  AccessChainState,
  AccessCommitmentRecord,
  AccessCommittedEvent,
  AccessDeliveryProjection,
  AccessEventPayload,
  AccessFinalityProjection,
  AccessReferenceSet,
  AccessReservationProjection,
  AccessRightCommitmentRequest,
  AccessRightProjection,
  AccessRightRevocationRequest,
  AccessSettlementProjection,
  AccessSubjectScope,
  AccessSynchronizationReport,
  AccessTargetReference,
  AccessUsageProjection,
  CanonicalSettlementReference,
  DeliveryCommitmentRequest,
  ReservationCommitmentRequest,
  ReservationTransitionRequest,
  SettlementEvidenceRequest,
  UsageCommitmentRequest,
} from './types.ts';
export {
  validateAccessRightClass,
  validateActorCapability,
  validateProductiveTarget,
  validateReferences,
  validateRightsAuthority,
} from './validation.ts';
