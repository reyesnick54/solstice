/**
 * KMS / HSM / PQC adapters over canonical packages/security contracts.
 * No generic production private-key export. PQC is never inferred from
 * classical signing support.
 */

import {
  negotiateSuiteCapability,
  type HsmHealth,
  type HsmKeyHandle,
  type HsmKmsCapabilities,
  type HsmKmsProvider,
  type PqCapabilityFlag,
} from '../../../security/src/hsm-kms.ts';
import { CeremonySimulationHsm } from '../../../security/src/ceremony/provider.ts';
import { DevelopmentHsmSimulator, DevelopmentKmsSimulator } from '../../../security/src/hsm-simulator.ts';
import type { KeyPurpose } from '../../../security/src/purposes.ts';
import { SUITE_SUNREY_ED25519_V1, type CryptoSuiteId } from '../../../security/src/crypto-suite.ts';
import {
  HSM_READINESS_STATES,
  infraErr,
  infraOk,
  type HsmReadinessState,
  type InfraResult,
  type ProviderType,
} from './types.ts';

export type KmsOperation =
  | 'GENERATE_KEY'
  | 'PUBLIC_DESCRIPTOR'
  | 'ENCRYPT'
  | 'DECRYPT'
  | 'SIGN'
  | 'ROTATE'
  | 'DISABLE'
  | 'KEY_METADATA'
  | 'ATTESTATION'
  | 'HEALTH';

export type ReportedAlgorithmCapability = {
  readonly algorithm: 'ED25519' | 'ML_DSA' | 'ML_KEM' | 'SLH_DSA' | 'HYBRID';
  readonly supported: boolean;
  readonly inferred: false;
  readonly evidence: string;
};

export type InfraKmsReport = {
  readonly providerId: string;
  readonly kind: 'KMS';
  readonly operations: readonly KmsOperation[];
  readonly privateKeyExportSupported: false;
  readonly algorithms: readonly ReportedAlgorithmCapability[];
  readonly health: HsmHealth;
  readonly capabilities: HsmKmsCapabilities;
};

export type InfraHsmReport = {
  readonly providerId: string;
  readonly kind: 'HSM';
  readonly readiness: HsmReadinessState;
  readonly privateKeyExportSupported: false;
  readonly algorithms: readonly ReportedAlgorithmCapability[];
  readonly health: HsmHealth;
  readonly capabilities: HsmKmsCapabilities;
  readonly hardwarePqStatus: HsmKmsCapabilities['hardwarePqReadiness'];
};

export function algorithmCapabilitiesFrom(capabilities: HsmKmsCapabilities): readonly ReportedAlgorithmCapability[] {
  const flags = new Set(capabilities.algorithmFlags);
  return Object.freeze([
    {
      algorithm: 'ED25519',
      supported: flags.has('ED25519') || capabilities.classical,
      inferred: false,
      evidence: flags.has('ED25519') ? 'algorithmFlags.ED25519' : capabilities.classical ? 'capabilities.classical' : 'absent',
    },
    {
      algorithm: 'ML_DSA',
      supported: flags.has('ML_DSA') && capabilities.postQuantum,
      inferred: false,
      evidence: flags.has('ML_DSA') ? 'algorithmFlags.ML_DSA' : 'not declared',
    },
    {
      algorithm: 'ML_KEM',
      supported: flags.has('ML_KEM') && capabilities.postQuantum,
      inferred: false,
      evidence: flags.has('ML_KEM') ? 'algorithmFlags.ML_KEM' : 'not declared',
    },
    {
      algorithm: 'SLH_DSA',
      supported: flags.has('SLH_DSA') && capabilities.postQuantum,
      inferred: false,
      evidence: flags.has('SLH_DSA') ? 'algorithmFlags.SLH_DSA' : 'not declared',
    },
    {
      algorithm: 'HYBRID',
      supported: flags.has('HYBRID_SUPPORT') && capabilities.hybrid,
      inferred: false,
      evidence: flags.has('HYBRID_SUPPORT') ? 'algorithmFlags.HYBRID_SUPPORT' : 'not declared',
    },
  ]);
}

export function refuseInferredPqc(capabilities: HsmKmsCapabilities, claimed: PqCapabilityFlag): InfraResult<true> {
  const negotiated = negotiateSuiteCapability(capabilities, claimed);
  if (!negotiated.ok) {
    return infraErr(negotiated.error.code, negotiated.error.message);
  }
  if (claimed !== 'CLASSICAL_SUPPORTED' && capabilities.classical && !capabilities.postQuantum) {
    return infraErr('PQC_NOT_INFERRED', 'classical signing does not imply ML-DSA or hybrid support');
  }
  return infraOk(true);
}

export function markHsmVerified(current: HsmReadinessState, evidenceDigest: string | null): InfraResult<HsmReadinessState> {
  if (current === 'EXTERNAL_HSM_VERIFIED') {
    return infraOk(current);
  }
  return infraErr(
    'HSM_UNVERIFIED',
    evidenceDigest
      ? `${current} cannot become EXTERNAL_HSM_VERIFIED from the infrastructure adapter; commercial HSM evidence remains external`
      : 'unverified HSM cannot become verified without independent commercial HSM evidence',
  );
}

export function hsmReadinessForProvider(kind: 'simulation' | 'software' | 'external-unverified'): HsmReadinessState {
  if (kind === 'simulation') {
    return 'SIMULATION_HSM';
  }
  if (kind === 'software') {
    return 'SOFTWARE_SECURE_PROVIDER';
  }
  return 'EXTERNAL_HSM_CONFIGURED_UNVERIFIED';
}

export function assertCiHsmAllowed(state: HsmReadinessState): InfraResult<true> {
  if (state === 'SIMULATION_HSM' || state === 'SOFTWARE_SECURE_PROVIDER') {
    return infraOk(true);
  }
  return infraErr('HSM_CI_FORBIDDEN', `CI may only exercise SIMULATION_HSM or SOFTWARE_SECURE_PROVIDER, not ${state}`);
}

export function reportKms(provider: HsmKmsProvider): InfraKmsReport {
  const capabilities = provider.capabilities();
  const health = provider.healthCheck();
  return Object.freeze({
    providerId: provider.providerId,
    kind: 'KMS',
    operations: Object.freeze([
      'GENERATE_KEY',
      'PUBLIC_DESCRIPTOR',
      'ENCRYPT',
      'DECRYPT',
      'SIGN',
      'ROTATE',
      'DISABLE',
      'KEY_METADATA',
      'ATTESTATION',
      'HEALTH',
    ] as const satisfies readonly KmsOperation[]),
    privateKeyExportSupported: false,
    algorithms: algorithmCapabilitiesFrom(capabilities),
    health: health.ok
      ? health.value
      : Object.freeze({
          healthy: false,
          providerId: provider.providerId,
          environmentLabel: provider.environmentLabel,
          simulation: provider.simulation,
        }),
    capabilities,
  });
}

export function reportHsm(provider: HsmKmsProvider, readiness: HsmReadinessState): InfraHsmReport {
  const capabilities = provider.capabilities();
  const health = provider.healthCheck();
  return Object.freeze({
    providerId: provider.providerId,
    kind: 'HSM',
    readiness,
    privateKeyExportSupported: false,
    algorithms: algorithmCapabilitiesFrom(capabilities),
    health: health.ok
      ? health.value
      : Object.freeze({
          healthy: false,
          providerId: provider.providerId,
          environmentLabel: provider.environmentLabel,
          simulation: provider.simulation,
        }),
    capabilities,
    hardwarePqStatus: capabilities.hardwarePqReadiness,
  });
}

export function createSimulationHsm(): CeremonySimulationHsm {
  return new CeremonySimulationHsm({ fixtureEnv: { SUNREY_FIXTURE_ENV: 'test' } });
}

export function createSoftwareSecureProvider(): DevelopmentHsmSimulator {
  return new DevelopmentHsmSimulator();
}

export function createSoftwareKms(): DevelopmentKmsSimulator {
  return new DevelopmentKmsSimulator();
}

export type CloudKmsConfig = {
  readonly providerType: Exclude<ProviderType, 'LOCAL_INTEGRATION'>;
  readonly endpoint: string;
  readonly credentialRefHref: string;
  readonly declaredAlgorithms: readonly ReportedAlgorithmCapability[];
};

export function cloudKmsCapabilities(config: CloudKmsConfig): HsmKmsCapabilities {
  const declared = new Set(config.declaredAlgorithms.filter((row) => row.supported).map((row) => row.algorithm));
  return Object.freeze({
    flags: Object.freeze(declared.has('ED25519') ? (['CLASSICAL_SUPPORTED'] as const) : []),
    classical: declared.has('ED25519'),
    hybrid: declared.has('HYBRID'),
    postQuantum: declared.has('ML_DSA') || declared.has('SLH_DSA'),
    realPqSupported: false,
    externalHsmPqSupported: false,
    keyImportPolicy: 'FORBIDDEN',
    privateMaterialExportSupported: false,
    algorithmFlags: Object.freeze([
      ...(declared.has('ED25519') ? (['ED25519'] as const) : []),
      ...(declared.has('ML_DSA') ? (['ML_DSA'] as const) : []),
      ...(declared.has('ML_KEM') ? (['ML_KEM'] as const) : []),
      ...(declared.has('SLH_DSA') ? (['SLH_DSA'] as const) : []),
      ...(declared.has('HYBRID') ? (['HYBRID_SUPPORT'] as const) : []),
      'NON_EXPORTABLE' as const,
    ]),
    hardwarePqReadiness: 'HARDWARE_PROVIDER_UNCONFIRMED',
    softwarePqReadiness: 'SOFTWARE_PROVIDER_AVAILABLE',
    attestationSupported: false,
    multiAuthAdminSupported: false,
    backupSupported: true,
    nonExportable: true,
    capabilityEvidenceRefs: Object.freeze(['chunk-60-pqc', 'chunk-64-hsm-contract']),
    simulationClass: 'UNDECLARED',
  });
}

export function generateNonExportableKey(
  provider: HsmKmsProvider,
  purpose: KeyPurpose = 'BACKUP_ENCRYPTION',
  suiteId: CryptoSuiteId = SUITE_SUNREY_ED25519_V1,
): InfraResult<HsmKeyHandle> {
  const generated = provider.generateKey({ purpose, suiteId });
  if (!generated.ok) {
    return infraErr(generated.error.code, generated.error.message);
  }
  if (generated.value.exportable !== false) {
    return infraErr('PRIVATE_KEY_EXPORT', 'production KMS/HSM keys must be non-exportable');
  }
  return infraOk(generated.value);
}

export { HSM_READINESS_STATES };
