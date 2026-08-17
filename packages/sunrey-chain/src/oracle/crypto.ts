import { createHash } from 'node:crypto';

import {
  CHAIN_PURPOSE_DEFAULT_SUITE,
  SUITE_SUNREY_HYBRID_ED25519_MLDSA_V1,
  SUITE_SUNREY_MLDSA_65_V1,
  createDefaultCryptoSuiteRegistry,
  createSecurityProviderCatalog,
  decodeHybridComponent,
  encodeHybridComponent,
  evaluateCryptoPolicy,
  signWithSuite,
  verifyWithSuite,
  type CryptoSuiteRegistry,
  type ProviderCatalog,
  type PublicKeyDescriptor,
} from '../../../security/src/index.ts';
import type { PrivateKeyMaterial } from '../../../security/src/redaction.ts';
import { err, ok, type Result } from '../../../domain/src/result.ts';
import { commitCanonical } from '../hash.ts';
import {
  ORACLE_MESSAGE_DOMAIN,
  ORACLE_PROTOCOL_VERSION,
  type OracleObservation,
  type OracleRejection,
} from './types.ts';

export type OracleCryptoPorts = {
  readonly registry: CryptoSuiteRegistry;
  readonly catalog: ProviderCatalog;
};

export function defaultOracleCrypto(): OracleCryptoPorts {
  return Object.freeze({
    registry: createDefaultCryptoSuiteRegistry(),
    catalog: createSecurityProviderCatalog(),
  });
}

export function defaultOracleSuiteId(): string {
  return CHAIN_PURPOSE_DEFAULT_SUITE.ORACLE_SIGNING;
}

export function oracleSeedFromLabel(label: string): string {
  return createHash('sha256').update(`SUNREY-ORACLE-DEV-SEED-v1:${label}`).digest('hex');
}

function oraclePqSeedFromLabel(label: string): string {
  return createHash('sha256').update(`SUNREY-ORACLE-PQ-SEED-v1:${label}`).digest('hex');
}

export function isHybridOracleSuite(suiteId: string): boolean {
  return suiteId === SUITE_SUNREY_HYBRID_ED25519_MLDSA_V1;
}

function classicalOracleAlgorithm(ports: OracleCryptoPorts) {
  const suite = ports.registry.get(CHAIN_PURPOSE_DEFAULT_SUITE.ORACLE_SIGNING);
  return suite.ok ? suite.value.signatureAlgorithm : null;
}

export function deriveOracleKey(
  ports: OracleCryptoPorts,
  suiteId: string,
  label: string,
): Result<{ readonly publicKey: PublicKeyDescriptor; readonly privateKey: PrivateKeyMaterial }, OracleRejection> {
  const suite = ports.registry.get(suiteId);
  if (!suite.ok || suite.value.signatureAlgorithm === null) {
    return err({ code: 'ORACLE_WRONG_CRYPTO_SUITE', detail: `unknown CryptoSuite ${suiteId}` });
  }
  if (isHybridOracleSuite(suiteId)) {
    const classicalAlg = classicalOracleAlgorithm(ports);
    if (classicalAlg === null) {
      return err({ code: 'ORACLE_WRONG_CRYPTO_SUITE', detail: 'classical oracle suite has no signature algorithm' });
    }
    const ed = ports.catalog.signature(classicalAlg);
    const pq = ports.catalog.signature('ML_DSA_65_V1');
    if (!ed.ok) {
      return err({ code: 'ORACLE_WRONG_CRYPTO_SUITE', detail: ed.error.message });
    }
    if (!pq.ok) {
      return err({ code: 'ORACLE_HYBRID_REQUIRED', detail: `${pq.error.message}; fail-closed` });
    }
    const classical = ed.value.fromSeed(
      oracleSeedFromLabel(label),
      'ORACLE_SIGNING',
      SUITE_SUNREY_HYBRID_ED25519_MLDSA_V1,
      `oracle:${label}`,
    );
    const postQuantum = pq.value.fromSeed(
      oraclePqSeedFromLabel(label),
      'ORACLE_SIGNING',
      SUITE_SUNREY_HYBRID_ED25519_MLDSA_V1,
      `oracle:${label}:pq`,
    );
    if (!classical.ok) {
      return err({ code: 'ORACLE_WRONG_CRYPTO_SUITE', detail: classical.error.message });
    }
    if (!postQuantum.ok) {
      return err({ code: 'ORACLE_HYBRID_REQUIRED', detail: `${postQuantum.error.message}; fail-closed` });
    }
    return ok({
      publicKey: {
        ...classical.value.publicKey,
        publicKeyHex: encodeHybridComponent(
          classical.value.publicKey.publicKeyHex,
          postQuantum.value.publicKey.publicKeyHex,
        ),
      },
      privateKey: classical.value.privateKey,
    });
  }
  const provider = ports.catalog.signature(suite.value.signatureAlgorithm);
  if (!provider.ok) {
    return err({ code: 'ORACLE_WRONG_CRYPTO_SUITE', detail: provider.error.message });
  }
  const seed =
    suiteId === SUITE_SUNREY_MLDSA_65_V1 ? oraclePqSeedFromLabel(label) : oracleSeedFromLabel(label);
  const derived = provider.value.fromSeed(seed, 'ORACLE_SIGNING', suite.value.suiteId, `oracle:${label}`);
  if (!derived.ok) {
    return err({ code: 'ORACLE_WRONG_CRYPTO_SUITE', detail: derived.error.message });
  }
  return ok(derived.value);
}

function signHybridOracle(
  ports: OracleCryptoPorts,
  publicKey: PublicKeyDescriptor,
  privateKey: PrivateKeyMaterial,
  payload: string,
): Result<string, OracleRejection> {
  const label = publicKey.keyId.startsWith('oracle:') ? publicKey.keyId.slice('oracle:'.length) : publicKey.keyId;
  const classicalAlg = classicalOracleAlgorithm(ports);
  if (classicalAlg === null) {
    return err({ code: 'ORACLE_WRONG_CRYPTO_SUITE', detail: 'classical oracle suite has no signature algorithm' });
  }
  const ed = ports.catalog.signature(classicalAlg);
  const pq = ports.catalog.signature('ML_DSA_65_V1');
  if (!ed.ok || !pq.ok) {
    return err({
      code: 'ORACLE_HYBRID_REQUIRED',
      detail: 'standardized PQ provider unavailable; fail-closed; no classical-only fallback',
    });
  }
  const pub = decodeHybridComponent(publicKey.publicKeyHex);
  if (!pub.ok) {
    return err({ code: 'ORACLE_INVALID_SIGNATURE', detail: 'hybrid oracle public key is malformed' });
  }
  const digest = Buffer.from(payload, 'utf8');
  const classicalSig = ed.value.signRaw(privateKey.reveal().toString('hex'), pub.value.classicalHex, digest);
  const pqKey = pq.value.fromSeed(
    oraclePqSeedFromLabel(label),
    'ORACLE_SIGNING',
    SUITE_SUNREY_HYBRID_ED25519_MLDSA_V1,
    `${publicKey.keyId}:pq`,
  );
  if (!classicalSig.ok || !pqKey.ok) {
    return err({ code: 'ORACLE_INVALID_SIGNATURE', detail: 'hybrid oracle sign failed; fail-closed' });
  }
  const pqSig = pq.value.signRaw(pqKey.value.privateKey.reveal().toString('hex'), pub.value.postQuantumHex, digest);
  if (!pqSig.ok) {
    return err({ code: 'ORACLE_INVALID_SIGNATURE', detail: pqSig.error.message });
  }
  return ok(encodeHybridComponent(classicalSig.value.toString('hex'), pqSig.value.toString('hex')));
}

function verifyHybridOracle(
  ports: OracleCryptoPorts,
  publicKey: PublicKeyDescriptor,
  payload: string,
  signatureHex: string,
): Result<true, OracleRejection> {
  const classicalAlg = classicalOracleAlgorithm(ports);
  if (classicalAlg === null) {
    return err({ code: 'ORACLE_WRONG_CRYPTO_SUITE', detail: 'classical oracle suite has no signature algorithm' });
  }
  const ed = ports.catalog.signature(classicalAlg);
  const pq = ports.catalog.signature('ML_DSA_65_V1');
  if (!ed.ok || !pq.ok) {
    return err({
      code: 'ORACLE_HYBRID_REQUIRED',
      detail: 'standardized PQ provider unavailable; fail-closed',
    });
  }
  const pub = decodeHybridComponent(publicKey.publicKeyHex);
  const sig = decodeHybridComponent(signatureHex);
  if (!pub.ok || !sig.ok) {
    return err({ code: 'ORACLE_INVALID_SIGNATURE', detail: 'hybrid oracle envelope is malformed' });
  }
  const digest = Buffer.from(payload, 'utf8');
  const classicalOk = ed.value.verifyRaw(pub.value.classicalHex, digest, sig.value.classicalHex);
  const pqOk = pq.value.verifyRaw(pub.value.postQuantumHex, digest, sig.value.postQuantumHex);
  if (!classicalOk.ok || !pqOk.ok) {
    return err({ code: 'ORACLE_INVALID_SIGNATURE', detail: 'REQUIRE_ALL: hybrid oracle verification failed' });
  }
  return ok(true);
}

export function unsignedObservationCommitment(
  observation: Omit<OracleObservation, 'observationId' | 'signatureHex'>,
): string {
  return commitCanonical({
    domain: ORACLE_MESSAGE_DOMAIN,
    schemaVersion: observation.schemaVersion,
    oracleId: observation.oracleId,
    feedId: observation.feedId,
    subject: observation.subject,
    value: {
      mantissa: observation.value.mantissa.toString(),
      scale: observation.value.scale,
      unit: observation.value.unit,
    },
    measurementStartUnix: observation.measurementStartUnix.toString(),
    measurementEndUnix: observation.measurementEndUnix.toString(),
    observationTimeUnix: observation.observationTimeUnix.toString(),
    validUntilUnix: observation.validUntilUnix.toString(),
    geography: observation.geography,
    sourceReferenceCommitment: observation.sourceReferenceCommitment,
    methodologyReference: observation.methodologyReference,
    confidence: observation.confidence,
    sequence: observation.sequence.toString(),
    networkId: observation.networkId,
    chainId: observation.chainId,
    cryptoSuite: observation.cryptoSuite,
    publicKeyHex: observation.publicKeyHex,
    deviceProvenance: observation.deviceProvenance,
    weight: observation.weight.toString(),
  });
}

export function observationIdOf(
  observation: Omit<OracleObservation, 'observationId' | 'signatureHex'>,
): string {
  return `obs_${unsignedObservationCommitment(observation)}`;
}

export function signObservation(
  ports: OracleCryptoPorts,
  unsigned: Omit<OracleObservation, 'observationId' | 'signatureHex'>,
  privateKey: PrivateKeyMaterial,
  publicKey: PublicKeyDescriptor,
  requireHybrid: boolean,
): Result<OracleObservation, OracleRejection> {
  const policy = evaluateCryptoPolicy(ports.registry, {
    protocolVersion: ORACLE_PROTOCOL_VERSION,
    networkId: unsigned.networkId,
    actorType: 'ORACLE',
    keyPurpose: 'ORACLE_SIGNING',
    environment: 'simulation',
    migrationState: requireHybrid ? 'HYBRID_REQUIRED_SELECTED_ROLES' : 'CLASSICAL_ONLY',
    operation: 'SIGN',
    suiteId: unsigned.cryptoSuite,
  });
  if (policy.outcome === 'REJECT') {
    return err({ code: 'ORACLE_WRONG_CRYPTO_SUITE', detail: policy.reasonCode });
  }
  if (policy.outcome === 'REQUIRE_HYBRID') {
    return err({ code: 'ORACLE_HYBRID_REQUIRED', detail: 'high-value feed requires hybrid signatures' });
  }
  const payload = unsignedObservationCommitment(unsigned);
  if (isHybridOracleSuite(unsigned.cryptoSuite)) {
    const hybrid = signHybridOracle(ports, publicKey, privateKey, payload);
    if (!hybrid.ok) {
      return hybrid;
    }
    return ok(
      Object.freeze({
        ...unsigned,
        observationId: observationIdOf(unsigned),
        signatureHex: hybrid.value,
      }),
    );
  }
  const signed = signWithSuite({
    registry: ports.registry,
    catalog: ports.catalog,
    suiteId: unsigned.cryptoSuite,
    policy: {
      protocolVersion: ORACLE_PROTOCOL_VERSION,
      networkId: unsigned.networkId,
      actorType: 'ORACLE',
      keyPurpose: 'ORACLE_SIGNING',
      environment: 'simulation',
      migrationState: 'CLASSICAL_ONLY',
    },
    publicKey,
    privateKey,
    payload,
    networkId: unsigned.networkId,
    chainId: unsigned.chainId,
    protocolVersion: ORACLE_PROTOCOL_VERSION,
    messageDomain: ORACLE_MESSAGE_DOMAIN,
  });
  if (!signed.ok) {
    return err({ code: 'ORACLE_INVALID_SIGNATURE', detail: signed.error.message });
  }
  return ok(
    Object.freeze({
      ...unsigned,
      observationId: observationIdOf(unsigned),
      signatureHex: signed.value.signatureHex,
    }),
  );
}

export function verifyObservationSignature(
  ports: OracleCryptoPorts,
  observation: OracleObservation,
  publicKey: PublicKeyDescriptor,
  requireHybrid: boolean,
): Result<true, OracleRejection> {
  if (observation.cryptoSuite !== publicKey.suiteId) {
    return err({ code: 'ORACLE_WRONG_CRYPTO_SUITE', detail: 'observation suite does not match provider' });
  }
  const policy = evaluateCryptoPolicy(ports.registry, {
    protocolVersion: ORACLE_PROTOCOL_VERSION,
    networkId: observation.networkId,
    actorType: 'ORACLE',
    keyPurpose: 'ORACLE_SIGNING',
    environment: 'simulation',
    migrationState: requireHybrid ? 'HYBRID_REQUIRED_SELECTED_ROLES' : 'CLASSICAL_ONLY',
    operation: 'VERIFY',
    suiteId: observation.cryptoSuite,
  });
  if (policy.outcome === 'REJECT') {
    return err({ code: 'ORACLE_WRONG_CRYPTO_SUITE', detail: policy.reasonCode });
  }
  if (policy.outcome === 'REQUIRE_HYBRID') {
    return err({ code: 'ORACLE_HYBRID_REQUIRED', detail: 'high-value feed requires hybrid signatures' });
  }
  const { observationId: _id, signatureHex, ...unsigned } = observation;
  const payload = unsignedObservationCommitment(unsigned);
  if (isHybridOracleSuite(observation.cryptoSuite)) {
    const hybrid = verifyHybridOracle(ports, publicKey, payload, signatureHex);
    if (!hybrid.ok) {
      return hybrid;
    }
    return ok(true);
  }
  const verified = verifyWithSuite({
    registry: ports.registry,
    catalog: ports.catalog,
    suiteId: observation.cryptoSuite,
    policy: {
      protocolVersion: ORACLE_PROTOCOL_VERSION,
      networkId: observation.networkId,
      actorType: 'ORACLE',
      keyPurpose: 'ORACLE_SIGNING',
      environment: 'simulation',
      migrationState: 'CLASSICAL_ONLY',
    },
    publicKey,
    payload,
    networkId: observation.networkId,
    chainId: observation.chainId,
    protocolVersion: ORACLE_PROTOCOL_VERSION,
    messageDomain: ORACLE_MESSAGE_DOMAIN,
    signature: {
      algorithmId: publicKey.algorithmId,
      suiteId: publicKey.suiteId,
      keyId: publicKey.keyId,
      keyVersion: publicKey.keyVersion,
      purpose: 'ORACLE_SIGNING',
      signatureHex,
      domain: ORACLE_MESSAGE_DOMAIN,
      protocolVersion: ORACLE_PROTOCOL_VERSION,
    },
  });
  if (!verified.ok) {
    return err({ code: 'ORACLE_INVALID_SIGNATURE', detail: verified.error.message });
  }
  return ok(true);
}
