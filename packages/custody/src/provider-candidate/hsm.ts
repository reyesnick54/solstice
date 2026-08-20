import type { HsmKeyHandle } from '../../../security/src/hsm-kms.ts';
import type { HsmKmsProvider } from '../../../security/src/hsm-kms.ts';
import { candidateErr, candidateOk, type CustodyCandidateResult, type CustodyKeyOrigin } from './types.ts';
import { assertWorkloadMayUseKey } from './auth.ts';

export type CustodyHsmKeyProfile = {
  readonly origin: CustodyKeyOrigin;
  readonly exportable: boolean;
  readonly attestationClass: 'SOFTWARE_FIXTURE' | 'EXTERNAL_HARDWARE_REQUIRED';
  readonly hardwareAttestationAccepted: boolean;
};

export function validateHsmKeyProfile(profile: CustodyHsmKeyProfile): CustodyCandidateResult<CustodyHsmKeyProfile> {
  if (profile.exportable !== false) {
    return candidateErr('EXPORTABLE_FORBIDDEN', 'production-candidate keys must be non-exportable');
  }
  if (profile.origin === 'IMPORT_WRAPPED_KEY') {
    return candidateErr('PLAINTEXT_IMPORT_FORBIDDEN', 'plaintext key import is not silently permitted');
  }
  if (profile.attestationClass === 'SOFTWARE_FIXTURE' && profile.hardwareAttestationAccepted) {
    return candidateErr('FAKE_ATTESTATION', 'software fixture attestation is not real hardware attestation');
  }
  return candidateOk(profile);
}

export function generateNonExportableCustodyKey(
  hsm: HsmKmsProvider,
  suiteId: HsmKeyHandle['suiteId'],
): CustodyCandidateResult<HsmKeyHandle> {
  const generated = hsm.generateKey({ purpose: 'WALLET_SIGNING', suiteId });
  if (!generated.ok) {
    return candidateErr(generated.error.code, generated.error.message);
  }
  if (generated.value.exportable !== false) {
    return candidateErr('EXPORTABLE_FORBIDDEN', 'HSM key must be non-exportable');
  }
  return candidateOk(generated.value);
}

export function rejectPrivateKeyExport(_handle: HsmKeyHandle): CustodyCandidateResult<never> {
  return candidateErr('PRIVATE_MATERIAL_FORBIDDEN', 'private key material must never leave the HSM/KMS boundary');
}

export function assertOracleCannotUseCustodyHsm(): CustodyCandidateResult<true> {
  return assertWorkloadMayUseKey('oracle_collector', 'CUSTODY_HSM');
}

export function assertCustodyCannotUseGovernanceKms(): CustodyCandidateResult<true> {
  return assertWorkloadMayUseKey('custody_worker', 'GOVERNANCE_KMS');
}

export type FixtureAttestation = {
  readonly class: 'SOFTWARE_FIXTURE';
  readonly realHardwareAttestation: false;
  readonly productionAccepted: false;
};

export function fixtureHsmAttestation(): FixtureAttestation {
  return Object.freeze({
    class: 'SOFTWARE_FIXTURE',
    realHardwareAttestation: false,
    productionAccepted: false,
  });
}
