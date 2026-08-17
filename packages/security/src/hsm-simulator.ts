/**
 * Development HSM simulator.
 *
 * Emulates a non-exportable key handle, generate, sign, rotate, and
 * disable using node:crypto Ed25519. Labeled simulation. Private
 * material never leaves this module.
 */

import { createEd25519SignatureProvider } from './ed25519-provider.ts';
import {
  freezePublicKeyDescriptor,
  freezeSignatureDescriptor,
  keyId,
  keyVersion,
  type PublicKeyDescriptor,
  type SignatureDescriptor,
} from './crypto-descriptors.ts';
import {
  createDefaultCryptoSuiteRegistry,
  SUITE_SUNREY_ED25519_V1,
  SUITE_SUNREY_HYBRID_SIM_V1,
  SUITE_SUNREY_MLDSA_65_V1,
  type CryptoSuiteId,
} from './crypto-suite.ts';
import { securityErr, securityOk, type SecurityResult } from './errors.ts';
import type { KeyPurpose } from './purposes.ts';
import { secureRandomHex } from './random.ts';
import type { PrivateKeyMaterial } from './redaction.ts';
import {
  negotiateSuiteCapability,
  type HsmAttestationMetadata,
  type HsmGenerateInput,
  type HsmHealth,
  type HsmImportInput,
  type HsmKeyHandle,
  type HsmKmsCapabilities,
  type HsmKmsProvider,
  type HsmProviderVersion,
  type HsmSignInput,
} from './hsm-kms.ts';

export const DEVELOPMENT_HSM_PROVIDER_ID = 'sunrey-development-hsm-simulator';
export const DEVELOPMENT_KMS_PROVIDER_ID = 'sunrey-development-kms-simulator';
export const DEVELOPMENT_HSM_VERSION = 'hsm-sim-v1';
export const DEVELOPMENT_HSM_ENVIRONMENT_LABEL =
  'SIMULATION development HSM. Non-exportable handles via node:crypto Ed25519. Not a certified HSM. Not for production.';
export const DEVELOPMENT_KMS_ENVIRONMENT_LABEL =
  'SIMULATION development KMS. Non-exportable handles via node:crypto Ed25519. Not a cloud KMS. Not for production.';

const CUSTODY_PURPOSE: KeyPurpose = 'WALLET_SIGNING';

type InternalRecord = {
  handle: HsmKeyHandle;
  publicKey: PublicKeyDescriptor;
  material: PrivateKeyMaterial;
};

function suiteCapabilityFlag(suiteId: CryptoSuiteId): 'CLASSICAL_SUPPORTED' | 'HYBRID_SUPPORTED' | 'PQ_SUPPORTED' {
  if (suiteId === SUITE_SUNREY_MLDSA_65_V1) {
    return 'PQ_SUPPORTED';
  }
  if (suiteId === SUITE_SUNREY_HYBRID_SIM_V1) {
    return 'HYBRID_SUPPORTED';
  }
  return 'CLASSICAL_SUPPORTED';
}

export class DevelopmentHsmSimulator implements HsmKmsProvider {
  readonly providerId: string = DEVELOPMENT_HSM_PROVIDER_ID;
  readonly kind: 'HSM' | 'KMS' = 'HSM';
  readonly environmentLabel: string = DEVELOPMENT_HSM_ENVIRONMENT_LABEL;
  readonly implementationState = 'SIMULATION' as const;
  readonly simulation = true;

  private readonly records = new Map<string, InternalRecord>();
  private readonly ed25519 = createEd25519SignatureProvider();
  private readonly registry = createDefaultCryptoSuiteRegistry();

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
    });
  }

  generateKey(input: HsmGenerateInput): SecurityResult<HsmKeyHandle> {
    const purposeCheck = this.assertCustodyPurpose(input.purpose);
    if (!purposeCheck.ok) {
      return purposeCheck;
    }
    const suiteCheck = this.assertSuite(input.suiteId);
    if (!suiteCheck.ok) {
      return suiteCheck;
    }
    const generated = this.ed25519.generateKey(input.purpose, input.suiteId, input.keyId);
    if (!generated.ok) {
      return generated;
    }
    return this.store(generated.value.publicKey, generated.value.privateKey, 1);
  }

  importAllowedKey(input: HsmImportInput): SecurityResult<HsmKeyHandle> {
    if (input.importPolicy !== 'DEVELOPMENT_ALLOWED') {
      return securityErr('POLICY_REJECTED', 'HSM-class import is forbidden unless development policy permits');
    }
    const purposeCheck = this.assertCustodyPurpose(input.purpose);
    if (!purposeCheck.ok) {
      return purposeCheck;
    }
    const suiteCheck = this.assertSuite(input.suiteId);
    if (!suiteCheck.ok) {
      return suiteCheck;
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
      return securityErr('KEY_NOT_USABLE', 'disabled or compromised HSM key cannot sign');
    }
    if (input.purpose !== record.value.handle.purpose) {
      return securityErr('PURPOSE_MISMATCH', 'sign purpose does not match key purpose');
    }
    if (input.suiteId !== record.value.handle.suiteId) {
      return securityErr('DOWNGRADE_REJECTED', 'requested CryptoSuite does not match key; no silent downgrade');
    }
    const publicHex = record.value.publicKey.publicKeyHex;
    const signed = this.ed25519.signRaw(
      record.value.material.reveal().toString('hex'),
      publicHex,
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
        domain: 'sunrey.custody.wallet.v1',
        protocolVersion: 'sunrey-protocol-0',
      }),
    );
  }

  rotateKey(handle: HsmKeyHandle): SecurityResult<HsmKeyHandle> {
    const record = this.lookup(handle);
    if (!record.ok) {
      return record;
    }
    const generated = this.ed25519.generateKey(
      record.value.handle.purpose,
      record.value.handle.suiteId,
      `${record.value.handle.keyId}:v${record.value.handle.keyVersion + 1}`,
    );
    if (!generated.ok) {
      return generated;
    }
    this.records.delete(handle.handleId);
    return this.store(generated.value.publicKey, generated.value.privateKey, record.value.handle.keyVersion + 1);
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
        providerVersion: DEVELOPMENT_HSM_VERSION,
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
        providerVersion: DEVELOPMENT_HSM_VERSION,
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

  private assertCustodyPurpose(purpose: KeyPurpose): SecurityResult<true> {
    if (purpose !== CUSTODY_PURPOSE) {
      return securityErr(
        'PURPOSE_MISMATCH',
        `HSM custody keys must use WALLET_SIGNING; ${purpose} is rejected`,
      );
    }
    return securityOk(true);
  }

  private assertSuite(suiteId: CryptoSuiteId): SecurityResult<true> {
    const suite = this.registry.get(suiteId);
    if (!suite.ok) {
      return suite;
    }
    if (suiteId === SUITE_SUNREY_ED25519_V1) {
      return securityOk(true);
    }
    return negotiateSuiteCapability(this.capabilities(), suiteCapabilityFlag(suiteId));
  }

  private lookup(handle: HsmKeyHandle): SecurityResult<InternalRecord> {
    const record = this.records.get(handle.handleId);
    if (!record) {
      return securityErr('KEY_NOT_FOUND', 'HSM handle is unknown');
    }
    return securityOk(record);
  }

  private store(
    publicKey: PublicKeyDescriptor,
    material: PrivateKeyMaterial,
    version: number,
  ): SecurityResult<HsmKeyHandle> {
    const handle: HsmKeyHandle = Object.freeze({
      handleId: `hsmh_${secureRandomHex(12)}`,
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
    const descriptor = freezePublicKeyDescriptor({
      ...publicKey,
      keyId: keyId(publicKey.keyId),
      keyVersion: keyVersion(version),
      providerId: this.providerId,
    });
    this.records.set(handle.handleId, { handle, publicKey: descriptor, material });
    return securityOk(handle);
  }
}

export class DevelopmentKmsSimulator extends DevelopmentHsmSimulator {
  override readonly providerId = DEVELOPMENT_KMS_PROVIDER_ID;
  override readonly kind = 'KMS';
  override readonly environmentLabel = DEVELOPMENT_KMS_ENVIRONMENT_LABEL;
}

export function createDevelopmentHsmSimulator(): DevelopmentHsmSimulator {
  return new DevelopmentHsmSimulator();
}

export function createDevelopmentKmsSimulator(): DevelopmentKmsSimulator {
  return new DevelopmentKmsSimulator();
}
