export {
  AES_256_GCM,
  AES_GCM_IV_BYTES,
  AES_GCM_KEY_BYTES,
  ALGORITHM_NOTES,
  ENVELOPE_SCHEMA_VERSION,
  ENCRYPTION_ALGORITHMS,
  HASH_ALGORITHMS,
  HMAC_KEY_BYTES,
  HMAC_SHA256,
  SHA_256,
  SIGNING_ALGORITHMS,
  type EncryptionAlgorithm,
  type HashAlgorithm,
  type SigningAlgorithm,
} from './algorithms.ts';

export {
  FUTURE_PROVIDER_KINDS,
  PRODUCTION_ADAPTER_RULES,
  type FutureProviderAdapter,
  type FutureProviderKind,
} from './adapters.ts';

export {
  SECURITY_AUDIT_KINDS,
  auditFromMetadata,
  type SecurityAuditKind,
  type SecurityAuditPayload,
  type SecurityEventSink,
  type SecurityEvidenceSink,
} from './audit.ts';

export { systemSecurityClock, type SecurityClock } from './clock.ts';

export {
  aesGcmDecrypt,
  aesGcmEncrypt,
  generateDek,
  openEnvelope,
  sealEnvelope,
  unwrapDek,
  wrapDek,
  type DataKey,
  type EncryptedEnvelope,
} from './envelope.ts';

export {
  SECURITY_FAILURE_CODES,
  SecurityError,
  securityErr,
  securityOk,
  unwrapSecurity,
  type SecurityFailure,
  type SecurityFailureCode,
  type SecurityResult,
} from './errors.ts';

export { sha256Hex } from './hash.ts';

export { hmacSha256Hex, verifyHmacSha256Hex, type HmacSignature } from './hmac.ts';

export {
  SERVICE_CAPABILITIES,
  SERVICE_ROLES,
  ServiceIdentityRegistry,
  assertServiceCapability,
  isCredentialExpired,
  type ServiceCapability,
  type ServiceIdentity,
  type ServiceRole,
} from './identity.ts';

export {
  KEY_STATUSES,
  assertTransition,
  canSignOrEncrypt,
  canVerifyOrDecrypt,
  canTransition,
  isKeyStatus,
  isTerminalStatus,
  type KeyStatus,
} from './lifecycle.ts';

export { freezeKeyMetadata, type KeyMetadata, type KeyVersionRef } from './metadata.ts';

export type {
  DataKeyHandle,
  KeyProvider,
  PublicKeyMaterial,
  Signature,
} from './provider.ts';

export {
  KEY_PURPOSES,
  PURPOSE_ALGORITHMS,
  assertKeyPurpose,
  isKeyPurpose,
  type KeyPurpose,
} from './purposes.ts';

export {
  newCorrelationId,
  newSecurityToken,
  safeEqual,
  safeEqualHex,
  secureRandomBytes,
  secureRandomHex,
  type IdentifierKind,
} from './random.ts';

export {
  AccessToken,
  PrivateKeyMaterial,
  SENSITIVE_TYPE_NAMES,
  SecretValue,
  SessionSecret,
  WrappedCredential,
} from './redaction.ts';

export {
  CompositeSecretProvider,
  InMemorySecretProvider,
  SECRET_REFERENCE_SCHEME,
  parseSecretReference,
  secretRef,
  type SecretProvider,
  type SecretReference,
} from './secrets.ts';

export {
  SIMULATION_ENVIRONMENT_LABEL,
  SIMULATION_PROVIDER_ID,
  SimulationKeyProvider,
  createSimulationKeyProvider,
  type SimulationKeyProviderOptions,
} from './simulation.ts';

export {
  InMemoryKeyMetadataStore,
  type KeyMetadataStore,
  type ServiceIdentityStore,
} from './store.ts';

export { UnavailableKeyProvider } from './unavailable.ts';
