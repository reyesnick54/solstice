/**
 * Provider-neutral HSM / KMS contract.
 *
 * HSM-class providers never return private key material. Application
 * code receives handles, public descriptors, and signatures only.
 * CryptoSuite negotiation is explicit: unavailable suites fail closed
 * with no silent downgrade.
 */

import type { PublicKeyDescriptor, SignatureDescriptor } from './crypto-descriptors.ts';
import type { CryptoSuiteId } from './crypto-suite.ts';
import type { SecurityResult } from './errors.ts';
import type { KeyPurpose } from './purposes.ts';

export const HSM_KMS_KINDS = ['HSM', 'KMS'] as const;
export type HsmKmsKind = (typeof HSM_KMS_KINDS)[number];

export const HSM_IMPLEMENTATION_STATES = ['SIMULATION', 'PORT_ONLY'] as const;
export type HsmImplementationState = (typeof HSM_IMPLEMENTATION_STATES)[number];

export const PQ_CAPABILITY_FLAGS = [
  'CLASSICAL_SUPPORTED',
  'HYBRID_SUPPORTED',
  'PQ_SUPPORTED',
  'REAL_PQ_SUPPORTED',
] as const;
export type PqCapabilityFlag = (typeof PQ_CAPABILITY_FLAGS)[number];

export const HSM_ALGORITHM_CAPABILITIES = [
  'ED25519',
  'ML_DSA',
  'ML_KEM',
  'SLH_DSA',
  'HYBRID_SUPPORT',
  'NON_EXPORTABLE',
  'ATTESTATION',
  'MULTI_AUTH_ADMIN',
  'BACKUP_SUPPORTED',
] as const;
export type HsmAlgorithmCapability = (typeof HSM_ALGORITHM_CAPABILITIES)[number];

export const PQ_HARDWARE_READINESS = [
  'SOFTWARE_PROVIDER_AVAILABLE',
  'HARDWARE_PROVIDER_CONFIRMED',
  'HARDWARE_PROVIDER_UNCONFIRMED',
] as const;
export type PqHardwareReadiness = (typeof PQ_HARDWARE_READINESS)[number];

export const HSM_KEY_IMPORT_POLICIES = ['FORBIDDEN', 'DEVELOPMENT_ALLOWED'] as const;
export type HsmKeyImportPolicy = (typeof HSM_KEY_IMPORT_POLICIES)[number];

export type HsmKeyHandle = {
  readonly handleId: string;
  readonly keyId: string;
  readonly keyVersion: number;
  readonly purpose: KeyPurpose;
  readonly suiteId: CryptoSuiteId;
  readonly exportable: false;
  readonly disabled: boolean;
  readonly compromised: boolean;
  readonly providerId: string;
  readonly kind: HsmKmsKind;
};

export type HsmKmsCapabilities = {
  readonly flags: readonly PqCapabilityFlag[];
  readonly classical: boolean;
  readonly hybrid: boolean;
  readonly postQuantum: boolean;
  readonly realPqSupported: boolean;
  readonly externalHsmPqSupported: false;
  readonly keyImportPolicy: HsmKeyImportPolicy;
  readonly privateMaterialExportSupported: false;
  readonly algorithmFlags: readonly HsmAlgorithmCapability[];
  readonly hardwarePqReadiness: PqHardwareReadiness;
  readonly softwarePqReadiness: PqHardwareReadiness;
  readonly attestationSupported: boolean;
  readonly multiAuthAdminSupported: boolean;
  readonly backupSupported: boolean;
  readonly nonExportable: true;
  readonly capabilityEvidenceRefs: readonly string[];
  readonly simulationClass: 'SIMULATION' | 'UNDECLARED';
};

export type HsmBackupReference = {
  readonly keyId: string;
  readonly keyVersion: number;
  readonly providerId: string;
  readonly backupHandleRef: string;
  readonly encryptionPurpose: 'BACKUP_ENCRYPTION';
  readonly containsPlaintextKey: false;
  readonly simulation: boolean;
};

export type HsmAuditEventReference = {
  readonly eventId: string;
  readonly eventType: string;
  readonly providerId: string;
  readonly keyId: string | null;
  readonly evidenceRef: string;
  readonly simulation: boolean;
};

export type HsmAttestationMetadata = {
  readonly providerId: string;
  readonly providerVersion: string;
  readonly keyId: string;
  readonly keyVersion: number;
  readonly suiteId: CryptoSuiteId;
  readonly purpose: KeyPurpose;
  readonly environmentLabel: string;
  readonly simulation: boolean;
  readonly exportable: false;
};

export type HsmProviderVersion = {
  readonly providerId: string;
  readonly providerVersion: string;
  readonly keyId: string;
  readonly keyVersion: number;
};

export type HsmHealth = {
  readonly healthy: boolean;
  readonly providerId: string;
  readonly environmentLabel: string;
  readonly simulation: boolean;
};

export type HsmGenerateInput = {
  readonly purpose: KeyPurpose;
  readonly suiteId: CryptoSuiteId;
  readonly keyId?: string;
};

export type HsmImportInput = {
  readonly purpose: KeyPurpose;
  readonly suiteId: CryptoSuiteId;
  readonly keyId: string;
  readonly seedHex: string;
  readonly importPolicy: HsmKeyImportPolicy;
};

export type HsmSignInput = {
  readonly handle: HsmKeyHandle;
  readonly digest: Buffer;
  readonly purpose: KeyPurpose;
  readonly suiteId: CryptoSuiteId;
};

/**
 * Canonical HSM/KMS port. There is no extract / export-private method.
 * Callers that need material must use a non-HSM development signer.
 */
export type HsmKmsProvider = {
  readonly providerId: string;
  readonly kind: HsmKmsKind;
  readonly environmentLabel: string;
  readonly implementationState: HsmImplementationState;
  readonly simulation: boolean;
  capabilities(): HsmKmsCapabilities;
  generateKey(input: HsmGenerateInput): SecurityResult<HsmKeyHandle>;
  importAllowedKey(input: HsmImportInput): SecurityResult<HsmKeyHandle>;
  getPublicDescriptor(handle: HsmKeyHandle): SecurityResult<PublicKeyDescriptor>;
  signCanonicalDigest(input: HsmSignInput): SecurityResult<SignatureDescriptor>;
  rotateKey(handle: HsmKeyHandle): SecurityResult<HsmKeyHandle>;
  disableKey(handle: HsmKeyHandle): SecurityResult<HsmKeyHandle>;
  getAttestationMetadata(handle: HsmKeyHandle): SecurityResult<HsmAttestationMetadata>;
  getProviderKeyVersion(handle: HsmKeyHandle): SecurityResult<HsmProviderVersion>;
  healthCheck(): SecurityResult<HsmHealth>;
  getBackupReference(handle: HsmKeyHandle): SecurityResult<HsmBackupReference>;
  recordAuditEvent(eventType: string, handle?: HsmKeyHandle): SecurityResult<HsmAuditEventReference>;
};

export function negotiateSuiteCapability(
  capabilities: HsmKmsCapabilities,
  requested: PqCapabilityFlag,
): SecurityResult<true> {
  const supported =
    (requested === 'CLASSICAL_SUPPORTED' && capabilities.classical) ||
    (requested === 'HYBRID_SUPPORTED' && capabilities.hybrid) ||
    (requested === 'PQ_SUPPORTED' && capabilities.postQuantum) ||
    (requested === 'REAL_PQ_SUPPORTED' && capabilities.realPqSupported);
  if (!supported) {
    return {
      ok: false,
      error: {
        code: 'DOWNGRADE_REJECTED',
        message: `requested ${requested} is unavailable; silent downgrade is forbidden`,
      },
    };
  }
  return { ok: true, value: true };
}
