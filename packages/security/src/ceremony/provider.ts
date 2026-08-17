/**
 * Ceremony simulation HSM.
 *
 * Test-only credentials, non-exportable interface semantics, separate
 * authority keys, audit records. Labeled SIMULATION. Not a commercial
 * HSM and not a completed production ceremony.
 */

import { createEd25519SignatureProvider } from '../ed25519-provider.ts';
import {
  freezePublicKeyDescriptor,
  freezeSignatureDescriptor,
  keyId,
  keyVersion,
  type PublicKeyDescriptor,
  type SignatureDescriptor,
} from '../crypto-descriptors.ts';
import {
  createDefaultCryptoSuiteRegistry,
  SUITE_SUNREY_ED25519_V1,
  SUITE_SUNREY_HYBRID_ED25519_MLDSA_V1,
  SUITE_SUNREY_MLDSA_65_V1,
  type CryptoSuiteId,
} from '../crypto-suite.ts';
import { securityErr, securityOk, type SecurityResult } from '../errors.ts';
import {
  negotiateSuiteCapability,
  type HsmAttestationMetadata,
  type HsmAuditEventReference,
  type HsmBackupReference,
  type HsmGenerateInput,
  type HsmHealth,
  type HsmImportInput,
  type HsmKeyHandle,
  type HsmKmsCapabilities,
  type HsmKmsProvider,
  type HsmProviderVersion,
  type HsmSignInput,
} from '../hsm-kms.ts';
import { createMlDsa65Provider } from '../pq-provider.ts';
import type { KeyPurpose } from '../purposes.ts';
import { secureRandomHex } from '../random.ts';
import type { PrivateKeyMaterial } from '../redaction.ts';
import { assertCeremonyFixtureContext, FIXTURE_KEY_MARKER } from './access.ts';
import type { PqCapabilityAssessment } from './types.ts';

export const CEREMONY_HSM_PROVIDER_ID = 'sunrey-ceremony-hsm-simulator';
export const CEREMONY_HSM_VERSION = 'ceremony-hsm-sim-v1';
export const CEREMONY_HSM_ENVIRONMENT_LABEL =
  `SIMULATION ceremony HSM. ${FIXTURE_KEY_MARKER}. Non-exportable handles. Not a certified HSM. Not a completed production ceremony.`;

const CEREMONY_PURPOSES: readonly KeyPurpose[] = [
  'VALIDATOR_CONSENSUS_SIGNING',
  'BLOCK_PROPOSAL_SIGNING',
  'P2P_IDENTITY',
  'GOVERNANCE_SIGNING',
  'WALLET_SIGNING',
  'ORACLE_SIGNING',
  'ATTESTATION_SIGNING',
  'GENESIS_SIGNING',
  'RELEASE_SIGNING',
  'RECOVERY_SIGNING',
  'BACKUP_ENCRYPTION',
];

type InternalRecord = {
  handle: HsmKeyHandle;
  publicKey: PublicKeyDescriptor;
  material: PrivateKeyMaterial;
};

export class CeremonySimulationHsm implements HsmKmsProvider {
  readonly providerId = CEREMONY_HSM_PROVIDER_ID;
  readonly kind = 'HSM' as const;
  readonly environmentLabel = CEREMONY_HSM_ENVIRONMENT_LABEL;
  readonly implementationState = 'SIMULATION' as const;
  readonly simulation = true;

  private readonly records = new Map<string, InternalRecord>();
  private readonly ed25519 = createEd25519SignatureProvider();
  private readonly mlDsa = createMlDsa65Provider(true);
  private readonly registry = createDefaultCryptoSuiteRegistry();
  private readonly fixtureGuard: () => SecurityResult<true>;

  constructor(options: { readonly fixtureEnv?: NodeJS.ProcessEnv } = {}) {
    const env = options.fixtureEnv ?? process.env;
    this.fixtureGuard = () => assertCeremonyFixtureContext(env);
  }

  capabilities(): HsmKmsCapabilities {
    return Object.freeze({
      flags: Object.freeze(['CLASSICAL_SUPPORTED', 'HYBRID_SUPPORTED'] as const),
      classical: true,
      hybrid: true,
      postQuantum: false,
      realPqSupported: false,
      externalHsmPqSupported: false,
      keyImportPolicy: 'DEVELOPMENT_ALLOWED',
      privateMaterialExportSupported: false,
      algorithmFlags: Object.freeze([
        'ED25519',
        'HYBRID_SUPPORT',
        'NON_EXPORTABLE',
        'ATTESTATION',
        'MULTI_AUTH_ADMIN',
        'BACKUP_SUPPORTED',
      ] as const),
      hardwarePqReadiness: 'HARDWARE_PROVIDER_UNCONFIRMED',
      softwarePqReadiness: 'SOFTWARE_PROVIDER_AVAILABLE',
      attestationSupported: true,
      multiAuthAdminSupported: true,
      backupSupported: true,
      nonExportable: true,
      capabilityEvidenceRefs: Object.freeze(['SIMULATION']),
      simulationClass: 'SIMULATION',
    });
  }

  assessPqCapability(): PqCapabilityAssessment {
    return Object.freeze({
      software: 'SOFTWARE_PROVIDER_AVAILABLE',
      hardware: 'HARDWARE_PROVIDER_UNCONFIRMED',
      hybridSoftwareAvailable: true,
      hardwareEvidenceRefs: Object.freeze([]),
      note: 'Chunk 60 software PQC is available in development/testnet. External HSM PQC is unconfirmed. No hardware PQC claim.',
    });
  }

  generateKey(input: HsmGenerateInput): SecurityResult<HsmKeyHandle> {
    const fixture = this.fixtureGuard();
    if (!fixture.ok) {
      return fixture;
    }
    if (!CEREMONY_PURPOSES.includes(input.purpose)) {
      return securityErr('PURPOSE_MISMATCH', `ceremony HSM rejects purpose ${input.purpose}`);
    }
    const suiteCheck = this.assertSuite(input.suiteId);
    if (!suiteCheck.ok) {
      return suiteCheck;
    }
    const generated =
      input.suiteId === SUITE_SUNREY_MLDSA_65_V1 || input.suiteId === SUITE_SUNREY_HYBRID_ED25519_MLDSA_V1
        ? this.softwarePqKey(input)
        : this.ed25519.generateKey(input.purpose, input.suiteId, input.keyId);
    if (!generated.ok) {
      return generated;
    }
    return this.store(generated.value.publicKey, generated.value.privateKey, 1);
  }

  importAllowedKey(input: HsmImportInput): SecurityResult<HsmKeyHandle> {
    const fixture = this.fixtureGuard();
    if (!fixture.ok) {
      return fixture;
    }
    if (input.importPolicy !== 'DEVELOPMENT_ALLOWED') {
      return securityErr('POLICY_REJECTED', 'ceremony HSM import is forbidden unless development policy permits');
    }
    const derived = this.ed25519.fromSeed(input.seedHex, input.purpose, input.suiteId, input.keyId);
    if (!derived.ok) {
      return derived;
    }
    return this.store(derived.value.publicKey, derived.value.privateKey, 1);
  }

  getPublicDescriptor(handle: HsmKeyHandle): SecurityResult<PublicKeyDescriptor> {
    const record = this.lookup(handle);
    if (!record.ok) {
      return record;
    }
    return securityOk(record.value.publicKey);
  }

  signCanonicalDigest(input: HsmSignInput): SecurityResult<SignatureDescriptor> {
    const record = this.lookup(input.handle);
    if (!record.ok) {
      return record;
    }
    if (record.value.handle.disabled || record.value.handle.compromised) {
      return securityErr('KEY_NOT_USABLE', 'disabled or compromised ceremony key cannot sign');
    }
    if (input.purpose !== record.value.handle.purpose) {
      return securityErr('PURPOSE_MISMATCH', 'sign purpose does not match key purpose');
    }
    if (input.suiteId !== record.value.handle.suiteId) {
      return securityErr('DOWNGRADE_REJECTED', 'requested CryptoSuite does not match key; no silent downgrade');
    }
    const signed = this.ed25519.signRaw(
      record.value.material.reveal().toString('hex'),
      record.value.publicKey.publicKeyHex,
      input.digest,
    );
    if (!signed.ok) {
      return signed;
    }
    return securityOk(
      freezeSignatureDescriptor({
        algorithmId: record.value.publicKey.algorithmId,
        suiteId: record.value.publicKey.suiteId,
        keyId: record.value.publicKey.keyId,
        keyVersion: record.value.publicKey.keyVersion,
        purpose: record.value.publicKey.purpose,
        signatureHex: signed.value.toString('hex'),
        domain: 'sunrey.ceremony.v1',
        protocolVersion: 'sunrey-protocol-0',
      }),
    );
  }

  rotateKey(handle: HsmKeyHandle): SecurityResult<HsmKeyHandle> {
    const record = this.lookup(handle);
    if (!record.ok) {
      return record;
    }
    const generated = this.generateKey({
      purpose: record.value.handle.purpose,
      suiteId: record.value.handle.suiteId,
      keyId: `${record.value.handle.keyId}:v${record.value.handle.keyVersion + 1}`,
    });
    if (!generated.ok) {
      return generated;
    }
    const retired: HsmKeyHandle = Object.freeze({ ...record.value.handle, disabled: true });
    this.records.set(handle.handleId, { ...record.value, handle: retired });
    return generated;
  }

  disableKey(handle: HsmKeyHandle): SecurityResult<HsmKeyHandle> {
    const record = this.lookup(handle);
    if (!record.ok) {
      return record;
    }
    const disabled: HsmKeyHandle = Object.freeze({ ...record.value.handle, disabled: true });
    this.records.set(handle.handleId, { ...record.value, handle: disabled });
    return securityOk(disabled);
  }

  markCompromised(handle: HsmKeyHandle): SecurityResult<HsmKeyHandle> {
    const record = this.lookup(handle);
    if (!record.ok) {
      return record;
    }
    const compromised: HsmKeyHandle = Object.freeze({
      ...record.value.handle,
      disabled: true,
      compromised: true,
    });
    this.records.set(handle.handleId, { ...record.value, handle: compromised });
    return securityOk(compromised);
  }

  getAttestationMetadata(handle: HsmKeyHandle): SecurityResult<HsmAttestationMetadata> {
    const record = this.lookup(handle);
    if (!record.ok) {
      return record;
    }
    return securityOk(
      Object.freeze({
        providerId: this.providerId,
        providerVersion: CEREMONY_HSM_VERSION,
        keyId: record.value.handle.keyId,
        keyVersion: record.value.handle.keyVersion,
        suiteId: record.value.handle.suiteId,
        purpose: record.value.handle.purpose,
        environmentLabel: this.environmentLabel,
        simulation: true,
        exportable: false,
      }),
    );
  }

  getProviderKeyVersion(handle: HsmKeyHandle): SecurityResult<HsmProviderVersion> {
    const record = this.lookup(handle);
    if (!record.ok) {
      return record;
    }
    return securityOk(
      Object.freeze({
        providerId: this.providerId,
        providerVersion: CEREMONY_HSM_VERSION,
        keyId: record.value.handle.keyId,
        keyVersion: record.value.handle.keyVersion,
      }),
    );
  }

  healthCheck(): SecurityResult<HsmHealth> {
    return securityOk(
      Object.freeze({
        healthy: true,
        providerId: this.providerId,
        environmentLabel: this.environmentLabel,
        simulation: true,
      }),
    );
  }

  getBackupReference(handle: HsmKeyHandle): SecurityResult<HsmBackupReference> {
    const record = this.lookup(handle);
    if (!record.ok) {
      return record;
    }
    return securityOk(
      Object.freeze({
        keyId: record.value.handle.keyId,
        keyVersion: record.value.handle.keyVersion,
        providerId: this.providerId,
        backupHandleRef: `ceremony-backup:${record.value.handle.keyId}:v${record.value.handle.keyVersion}`,
        encryptionPurpose: 'BACKUP_ENCRYPTION',
        containsPlaintextKey: false,
        simulation: true,
      }),
    );
  }

  recordAuditEvent(eventType: string, handle?: HsmKeyHandle): SecurityResult<HsmAuditEventReference> {
    return securityOk(
      Object.freeze({
        eventId: `ceremony-audit_${secureRandomHex(8)}`,
        eventType,
        providerId: this.providerId,
        keyId: handle?.keyId ?? null,
        evidenceRef: `sim-ceremony-audit:${eventType}`,
        simulation: true,
      }),
    );
  }

  verifyDigest(
    publicKeyHex: string,
    digest: Buffer,
    signatureHex: string,
  ): SecurityResult<true> {
    return this.ed25519.verifyRaw(publicKeyHex, digest, signatureHex);
  }

  private softwarePqKey(input: HsmGenerateInput): ReturnType<CeremonySimulationHsm['ed25519']['generateKey']> {
    if (input.suiteId === SUITE_SUNREY_MLDSA_65_V1) {
      return this.mlDsa.generateKey(input.purpose, input.suiteId, input.keyId);
    }
    return this.ed25519.generateKey(input.purpose, SUITE_SUNREY_ED25519_V1, input.keyId);
  }

  private assertSuite(suiteId: CryptoSuiteId): SecurityResult<true> {
    const suite = this.registry.get(suiteId);
    if (!suite.ok) {
      return suite;
    }
    if (suiteId === SUITE_SUNREY_ED25519_V1) {
      return securityOk(true);
    }
    if (suiteId === SUITE_SUNREY_MLDSA_65_V1 || suiteId === SUITE_SUNREY_HYBRID_ED25519_MLDSA_V1) {
      return negotiateSuiteCapability(this.capabilities(), 'HYBRID_SUPPORTED');
    }
    return securityErr('DOWNGRADE_REJECTED', `ceremony HSM does not claim hardware support for ${suiteId}`);
  }

  private lookup(handle: HsmKeyHandle): SecurityResult<InternalRecord> {
    const record = this.records.get(handle.handleId);
    if (!record) {
      return securityErr('KEY_NOT_FOUND', 'ceremony HSM handle is unknown');
    }
    return securityOk(record);
  }

  private store(
    publicKey: PublicKeyDescriptor,
    material: PrivateKeyMaterial,
    version: number,
  ): SecurityResult<HsmKeyHandle> {
    const handle: HsmKeyHandle = Object.freeze({
      handleId: `cerhsm_${secureRandomHex(12)}`,
      keyId: publicKey.keyId,
      keyVersion: version,
      purpose: publicKey.purpose,
      suiteId: publicKey.suiteId,
      exportable: false,
      disabled: false,
      compromised: false,
      providerId: this.providerId,
      kind: this.kind,
    });
    this.records.set(handle.handleId, {
      handle,
      publicKey: freezePublicKeyDescriptor({
        ...publicKey,
        keyId: keyId(publicKey.keyId),
        keyVersion: keyVersion(version),
        providerId: this.providerId,
      }),
      material,
    });
    return securityOk(handle);
  }
}

export function createCeremonySimulationHsm(
  options: { readonly fixtureEnv?: NodeJS.ProcessEnv } = {},
): CeremonySimulationHsm {
  return new CeremonySimulationHsm(options);
}
