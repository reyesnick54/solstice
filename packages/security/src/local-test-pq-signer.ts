/**
 * Local/test institutional signer that genuinely supports standardized PQ.
 *
 * This is not an external HSM. Do not advertise certified HSM PQ.
 */

import type { PublicKeyDescriptor, SignatureDescriptor } from './crypto-descriptors.ts';
import type { CryptoSuiteId } from './crypto-suite.ts';
import {
  SUITE_SUNREY_ED25519_V1,
  SUITE_SUNREY_HYBRID_ED25519_MLDSA_V1,
  SUITE_SUNREY_MLDSA_65_V1,
} from './crypto-suite.ts';
import { createEd25519SignatureProvider } from './ed25519-provider.ts';
import { securityErr, securityOk, type SecurityResult } from './errors.ts';
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
} from './hsm-kms.ts';
import { createMlDsa65Provider } from './pq-provider.ts';
import type { KeyPurpose } from './purposes.ts';
import { secureRandomHex } from './random.ts';
import type { PrivateKeyMaterial } from './redaction.ts';
import { freezePublicKeyDescriptor, freezeSignatureDescriptor, keyId, keyVersion } from './crypto-descriptors.ts';

export const LOCAL_TEST_PQ_SIGNER_ID = 'sunrey-local-test-pq-signer';
export const LOCAL_TEST_PQ_ENVIRONMENT_LABEL =
  'LOCAL/TEST standardized PQ signer via @noble/post-quantum. REAL_PQ_SUPPORTED. Not an external HSM. Not production-approved.';

type InternalRecord = {
  handle: HsmKeyHandle;
  publicKey: PublicKeyDescriptor;
  material: PrivateKeyMaterial;
};

export class LocalTestPqSigningProvider implements HsmKmsProvider {
  readonly providerId = LOCAL_TEST_PQ_SIGNER_ID;
  readonly kind = 'HSM' as const;
  readonly environmentLabel = LOCAL_TEST_PQ_ENVIRONMENT_LABEL;
  readonly implementationState = 'SIMULATION' as const;
  readonly simulation = true;
  readonly realPqSupported = true;
  readonly externalHsmPqSupported = false;

  private readonly records = new Map<string, InternalRecord>();
  private readonly ed25519 = createEd25519SignatureProvider();
  private readonly mlDsa = createMlDsa65Provider(true);

  capabilities(): HsmKmsCapabilities {
    return Object.freeze({
      flags: Object.freeze(['CLASSICAL_SUPPORTED', 'HYBRID_SUPPORTED', 'PQ_SUPPORTED', 'REAL_PQ_SUPPORTED'] as const),
      classical: true,
      hybrid: true,
      postQuantum: true,
      realPqSupported: true,
      externalHsmPqSupported: false,
      keyImportPolicy: 'DEVELOPMENT_ALLOWED',
      privateMaterialExportSupported: false,
      algorithmFlags: Object.freeze([
        'ED25519',
        'ML_DSA',
        'HYBRID_SUPPORT',
        'NON_EXPORTABLE',
        'ATTESTATION',
        'BACKUP_SUPPORTED',
      ] as const),
      hardwarePqReadiness: 'HARDWARE_PROVIDER_UNCONFIRMED',
      softwarePqReadiness: 'SOFTWARE_PROVIDER_AVAILABLE',
      attestationSupported: true,
      multiAuthAdminSupported: false,
      backupSupported: true,
      nonExportable: true,
      capabilityEvidenceRefs: Object.freeze(['SIMULATION', 'SOFTWARE_PROVIDER_AVAILABLE']),
      simulationClass: 'SIMULATION',
    });
  }

  generateKey(input: HsmGenerateInput): SecurityResult<HsmKeyHandle> {
    if (input.purpose !== 'WALLET_SIGNING') {
      return securityErr('PURPOSE_MISMATCH', 'local test PQ signer accepts WALLET_SIGNING only');
    }
    const capability =
      input.suiteId === SUITE_SUNREY_MLDSA_65_V1
        ? 'REAL_PQ_SUPPORTED'
        : input.suiteId === SUITE_SUNREY_HYBRID_ED25519_MLDSA_V1
          ? 'HYBRID_SUPPORTED'
          : 'CLASSICAL_SUPPORTED';
    const negotiated = negotiateSuiteCapability(this.capabilities(), capability);
    if (!negotiated.ok) {
      return negotiated;
    }
    const generated =
      input.suiteId === SUITE_SUNREY_MLDSA_65_V1
        ? this.mlDsa.generateKey(input.purpose, input.suiteId, input.keyId)
        : this.ed25519.generateKey(input.purpose, input.suiteId, input.keyId);
    if (!generated.ok) {
      return generated;
    }
    return this.store(generated.value.publicKey, generated.value.privateKey, 1);
  }

  importAllowedKey(input: HsmImportInput): SecurityResult<HsmKeyHandle> {
    if (input.importPolicy !== 'DEVELOPMENT_ALLOWED') {
      return securityErr('POLICY_REJECTED', 'import is forbidden unless development policy permits');
    }
    const derived =
      input.suiteId === SUITE_SUNREY_MLDSA_65_V1
        ? this.mlDsa.fromSeed(input.seedHex, input.purpose, input.suiteId, input.keyId)
        : this.ed25519.fromSeed(input.seedHex, input.purpose, input.suiteId, input.keyId);
    if (!derived.ok) {
      return derived;
    }
    return this.store(derived.value.publicKey, derived.value.privateKey, 1);
  }

  getPublicDescriptor(handle: HsmKeyHandle): SecurityResult<PublicKeyDescriptor> {
    const record = this.records.get(handle.handleId);
    if (!record) {
      return securityErr('KEY_NOT_FOUND', 'local test PQ handle is unknown');
    }
    return securityOk(record.publicKey);
  }

  signCanonicalDigest(input: HsmSignInput): SecurityResult<SignatureDescriptor> {
    const record = this.records.get(input.handle.handleId);
    if (!record) {
      return securityErr('KEY_NOT_FOUND', 'local test PQ handle is unknown');
    }
    if (record.handle.disabled || record.handle.compromised) {
      return securityErr('KEY_NOT_USABLE', 'disabled or compromised key cannot sign');
    }
    if (input.suiteId !== record.handle.suiteId) {
      return securityErr('DOWNGRADE_REJECTED', 'requested CryptoSuite does not match key; no silent downgrade');
    }
    const provider = input.suiteId === SUITE_SUNREY_MLDSA_65_V1 ? this.mlDsa : this.ed25519;
    const signed = provider.signRaw(
      record.material.reveal().toString('hex'),
      record.publicKey.publicKeyHex,
      input.digest,
    );
    if (!signed.ok) {
      return signed;
    }
    return securityOk(
      freezeSignatureDescriptor({
        algorithmId: record.publicKey.algorithmId,
        suiteId: record.publicKey.suiteId,
        keyId: record.publicKey.keyId,
        keyVersion: record.publicKey.keyVersion,
        purpose: record.publicKey.purpose,
        signatureHex: signed.value.toString('hex'),
        domain: 'sunrey.custody.wallet.v1',
        protocolVersion: 'sunrey-protocol-0',
      }),
    );
  }

  rotateKey(handle: HsmKeyHandle): SecurityResult<HsmKeyHandle> {
    const record = this.records.get(handle.handleId);
    if (!record) {
      return securityErr('KEY_NOT_FOUND', 'local test PQ handle is unknown');
    }
    return this.generateKey({
      purpose: record.handle.purpose,
      suiteId: record.handle.suiteId,
      keyId: `${record.handle.keyId}:v${record.handle.keyVersion + 1}`,
    });
  }

  disableKey(handle: HsmKeyHandle): SecurityResult<HsmKeyHandle> {
    const record = this.records.get(handle.handleId);
    if (!record) {
      return securityErr('KEY_NOT_FOUND', 'local test PQ handle is unknown');
    }
    const disabled = Object.freeze({ ...record.handle, disabled: true });
    this.records.set(handle.handleId, { ...record, handle: disabled });
    return securityOk(disabled);
  }

  getAttestationMetadata(handle: HsmKeyHandle): SecurityResult<HsmAttestationMetadata> {
    const record = this.records.get(handle.handleId);
    if (!record) {
      return securityErr('KEY_NOT_FOUND', 'local test PQ handle is unknown');
    }
    return securityOk(
      Object.freeze({
        providerId: this.providerId,
        providerVersion: 'local-test-pq-v1',
        keyId: record.handle.keyId,
        keyVersion: record.handle.keyVersion,
        suiteId: record.handle.suiteId,
        purpose: record.handle.purpose,
        environmentLabel: this.environmentLabel,
        simulation: true,
        exportable: false,
      }),
    );
  }

  getProviderKeyVersion(handle: HsmKeyHandle): SecurityResult<HsmProviderVersion> {
    const record = this.records.get(handle.handleId);
    if (!record) {
      return securityErr('KEY_NOT_FOUND', 'local test PQ handle is unknown');
    }
    return securityOk(
      Object.freeze({
        providerId: this.providerId,
        providerVersion: 'local-test-pq-v1',
        keyId: record.handle.keyId,
        keyVersion: record.handle.keyVersion,
      }),
    );
  }

  healthCheck(): SecurityResult<HsmHealth> {
    return securityOk(
      Object.freeze({
        healthy: this.mlDsa.available,
        providerId: this.providerId,
        environmentLabel: this.environmentLabel,
        simulation: true,
      }),
    );
  }

  getBackupReference(handle: HsmKeyHandle): SecurityResult<HsmBackupReference> {
    const record = this.records.get(handle.handleId);
    if (!record) {
      return securityErr('KEY_NOT_FOUND', 'local test PQ handle is unknown');
    }
    return securityOk(
      Object.freeze({
        keyId: record.handle.keyId,
        keyVersion: record.handle.keyVersion,
        providerId: this.providerId,
        backupHandleRef: `sim-backup:${record.handle.keyId}:v${record.handle.keyVersion}`,
        encryptionPurpose: 'BACKUP_ENCRYPTION',
        containsPlaintextKey: false,
        simulation: true,
      }),
    );
  }

  recordAuditEvent(eventType: string, handle?: HsmKeyHandle): SecurityResult<HsmAuditEventReference> {
    return securityOk(
      Object.freeze({
        eventId: `ltpq-audit_${secureRandomHex(8)}`,
        eventType,
        providerId: this.providerId,
        keyId: handle?.keyId ?? null,
        evidenceRef: `sim-ltpq-audit:${eventType}`,
        simulation: true,
      }),
    );
  }

  private store(
    publicKey: PublicKeyDescriptor,
    material: PrivateKeyMaterial,
    version: number,
  ): SecurityResult<HsmKeyHandle> {
    const handle: HsmKeyHandle = Object.freeze({
      handleId: `ltpq_${secureRandomHex(12)}`,
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

export function createLocalTestPqSigningProvider(): LocalTestPqSigningProvider {
  return new LocalTestPqSigningProvider();
}

export const CLASSICAL_LOCAL_SUITE = SUITE_SUNREY_ED25519_V1;
export const HYBRID_LOCAL_SUITE = SUITE_SUNREY_HYBRID_ED25519_MLDSA_V1;
export const PQ_LOCAL_SUITE = SUITE_SUNREY_MLDSA_65_V1;
