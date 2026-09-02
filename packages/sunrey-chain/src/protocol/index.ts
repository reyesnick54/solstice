export {
  PROTOCOL_CHAIN_ID,
  PROTOCOL_CODEC_ID,
  PROTOCOL_NETWORK_ID,
  PROTOCOL_SCHEMA_VERSION,
  HASH_DOMAINS,
  MAX_ENVELOPE_BYTES,
  MAX_QUANTITY_DIGITS,
  MAX_SCALED_UNITS,
} from './constants.ts';
export type { HashDomain } from './constants.ts';

export { PROTOCOL_REJECTION_CODES, protocolRejection } from './rejection.ts';
export type { ProtocolRejection, ProtocolRejectionCode, ProtocolValidationStage } from './rejection.ts';

export { ACTOR_TYPES, ACTOR_TYPE_IDS, actorRequiresCapability, actorIsUnrestrictedWallet } from './actor.ts';
export type { ActorDescriptor, ActorType, RevocationState } from './actor.ts';

export { RIGHT_TYPES, RIGHT_TYPE_IDS, ownershipImpliesUnlimitedUse } from './rights.ts';
export type { RightObject, RightType } from './rights.ts';

export {
  ECONOMIC_OBJECT_TYPES,
  ECONOMIC_OBJECT_TYPE_IDS,
  objectRequiresCommitment,
} from './economic-object.ts';
export type { EconomicObject, EconomicObjectType } from './economic-object.ts';

export {
  NATIVE_ASSET_IDS,
  NATIVE_ASSET_PROTOCOL_KEYS,
  NATIVE_ASSET_TICKER_STATUS,
  NATIVE_ASSET_OPERATION,
  moonreyIssuanceActivated,
} from './assets.ts';
export type { NativeAssetId, NativeAssetOperation } from './assets.ts';

export { parseScaledUnits, toAssetQuantity, protocolQuantityFromAsset } from './quantity.ts';
export type { ProtocolQuantity } from './quantity.ts';

export {
  TRANSACTION_FAMILIES,
  TRANSACTION_FAMILY_IDS,
  TRANSACTION_FAMILY_ACTIVATION,
  familyIsActivated,
} from './transaction-family.ts';
export type { TransactionFamily } from './transaction-family.ts';

export type {
  Authentication,
  BlockCommitmentRootsV1,
  BlockHeader,
  BlockHeaderV1,
  BlockHeaderV2,
  BodyHeader,
  EnvelopeV1,
  TransactionBodyV1,
} from './envelope.ts';
export { isBlockHeaderV2 } from './envelope.ts';

export {
  CodecError,
  decodeEnvelope,
  encodeEnvelope,
  encodeUnsignedEnvelope,
  encodeBlockHeader,
  encodeBlockHeaderV2,
  decodeBlockHeader,
  encodeEconomicObject,
  decodeEconomicObject,
  injectUnknownField,
} from './codec.ts';

export {
  domainSeparatedHash,
  transactionIdOf,
  transactionIdFromCanonicalBytes,
  hashForDomain,
  rejectJsonConsensusHash,
} from './hash.ts';

export { toDebugJson, debugJsonMustNotBeHashed } from './json-projection.ts';
export {
  signEnvelope,
  verifyEnvelopeSignature,
  ed25519PrivateKeyFromSeed,
  protocolKeyPairFromSeed,
  WIRE_ALGORITHM_TO_SUITE,
} from './authentication.ts';

export { ProtocolState } from './state.ts';
export type { ProtocolEvent, ProtocolExecutionContext, StateTransitionResult } from './state.ts';

export {
  decode,
  validateEnvelope,
  validateStateless,
  validateAuthentication,
  validateReplay,
  validateStateful,
  applyStateTransition,
  processTransaction,
} from './validation.ts';
