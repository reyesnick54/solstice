export {
  AES_256_GCM,
  AES_GCM_IV_BYTES,
  AES_GCM_KEY_BYTES,
  ALGORITHM_NOTES,
  ED25519,
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
  ALGORITHM_FAMILIES,
  ALGORITHM_IDS,
  APPLICATION_MAC_ALGORITHM_ID,
  CLASSICAL_SIGNATURE_ALGORITHM_ID,
  SECP256K1_NOT_AN_ALIAS,
  assertAlgorithmId,
  isAlgorithmId,
  type AlgorithmId,
} from './algorithm-ids.ts';

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
  APPLICATION_KEY_PURPOSES,
  CHAIN_KEY_PURPOSES,
  CHAIN_PURPOSE_DEFAULT_SUITE,
  KEY_PURPOSES,
  PURPOSE_ALGORITHMS,
  assertKeyPurpose,
  isApplicationKeyPurpose,
  isChainKeyPurpose,
  isKeyPurpose,
  type ApplicationKeyPurpose,
  type ChainKeyPurpose,
  type KeyPurpose,
} from './purposes.ts';

export {
  CRYPTO_ENVIRONMENTS,
  CryptoSuiteRegistry,
  SUITE_LIFECYCLE_STATES,
  SUITE_SUNREY_APP_HMAC_V1,
  SUITE_SUNREY_ED25519_DEPRECATED,
  SUITE_SUNREY_ED25519_V1,
  SUITE_SUNREY_ED25519_VERIFY_ONLY,
  SUITE_SUNREY_HYBRID_SIM_V1,
  SUITE_SUNREY_MLDSA_65_V1,
  SUITE_SUNREY_MLKEM_768_V1,
  SUITE_SUNREY_SLHDSA_V1,
  createDefaultCryptoSuiteRegistry,
  createTestCryptoSuiteRegistry,
  cryptoSuiteId,
  defaultCryptoSuites,
  freezeCryptoSuite,
  isSuiteLifecycleState,
  testFixtureCryptoSuites,
  type CryptoEnvironment,
  type CryptoSuite,
  type CryptoSuiteId,
  type SuiteLifecycleState,
  type VerificationGracePolicy,
} from './crypto-suite.ts';

export {
  HYBRID_COMBINERS,
  HYBRID_VERIFICATION_POLICIES,
  KEY_LIFECYCLE_STATES,
  freezeHybridSignatureDescriptor,
  freezePublicKeyDescriptor,
  freezeSignatureDescriptor,
  isKeyLifecycleState,
  keyId,
  keyVersion,
  type HybridCombiner,
  type HybridSignatureDescriptor,
  type HybridVerificationPolicy,
  type KemObjectDescriptor,
  type KeyId,
  type KeyLifecycleState,
  type KeyVersion,
  type PublicKeyDescriptor,
  type SignatureDescriptor,
} from './crypto-descriptors.ts';

export {
  SIGNED_BINDING_SCHEMA_VERSION,
  bindingDigest,
  createSignedBinding,
  encodeSignedBinding,
  payloadHash,
  type SignedBinding,
} from './crypto-binding.ts';

export { signHybrid, verifyHybrid, type HybridSignInput } from './crypto-hybrid.ts';

export {
  CRYPTO_POLICY_ENGINE_ID,
  CRYPTO_POLICY_MUTATION_API,
  CRYPTO_POLICY_OUTCOMES,
  CRYPTO_POLICY_REASON_CODES,
  canOriginate,
  evaluateCryptoPolicy,
  type CryptoActorType,
  type CryptoPolicyDecision,
  type CryptoPolicyInput,
  type CryptoPolicyOutcome,
  type CryptoPolicyReasonCode,
} from './crypto-policy.ts';

export {
  CRYPTO_MIGRATION_STATES,
  HYBRID_REQUIRED_ROLES,
  INITIAL_CRYPTO_MIGRATION_STATE,
  MIGRATION_TRANSITION_OWNER,
  isCryptoMigrationState,
  type CryptoMigrationState,
} from './crypto-migration.ts';

export {
  FORBIDDEN_PRIVATE_KEY_SURFACES,
  PRIVATE_KEY_FIELD_NAMES,
  assertNoPrivateKeyMaterial,
  findPrivateKeyLeakage,
  rejectErrorWithSecret,
  safePublicLog,
} from './crypto-leakage.ts';

export { CRYPTO_PROVIDER_PERMIT, PROVIDER_ONLY_FILES, assertProviderPermit } from './crypto-guard.ts';

export type {
  GeneratedKeyPair,
  KemProvider,
  ProviderCatalog,
  SharedSecretHandle,
  SignatureProvider,
} from './crypto-providers.ts';

export {
  ED25519_ENVIRONMENT_LABEL,
  ED25519_PROVIDER_ID,
  ED25519_PUBLIC_KEY_BYTES,
  ED25519_SECRET_KEY_BYTES,
  ED25519_SIGNATURE_BYTES,
  Ed25519SignatureProvider,
  createEd25519SignatureProvider,
} from './ed25519-provider.ts';

export {
  SIMULATION_PQ_ENVIRONMENT_LABEL,
  SIMULATION_PQ_PROVIDER_ID,
  SimulationPqKemProvider,
  SimulationPqSignatureProvider,
  createSimulationPqKemProvider,
  createSimulationPqSignatureProvider,
} from './pq-simulation-provider.ts';

export { SecurityProviderCatalog, createSecurityProviderCatalog } from './provider-catalog.ts';

export { PQC_LIBRARY_SELECTION } from './pqc-library-selection.ts';

export { CRYPTOGRAPHIC_INVENTORY } from './crypto-inventory.ts';

export { RFC8032_ED25519_TEST1, RFC8032_ED25519_TEST3, RFC8032_ED25519_VECTORS } from './ed25519-vectors.ts';

export { runCryptoBenchmarks, type BenchmarkRow } from './crypto-benchmark.ts';

export { signWithSuite, verifyWithSuite, type SuiteSignRequest } from './suite-signer.ts';

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
