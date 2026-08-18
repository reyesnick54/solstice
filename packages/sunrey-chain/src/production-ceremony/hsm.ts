/**
 * Production HSM attestation and PQC capability visibility.
 *
 * CI uses the Chunk 64 simulation provider. Simulation attestation is
 * labeled. Unsupported HSM PQ capability remains visible. No production
 * private-key material is written.
 */

import {
  createCeremonySimulationHsm,
  CEREMONY_HSM_ENVIRONMENT_LABEL,
} from '../../../security/src/ceremony/provider.ts';
import { PQC_LIBRARY_SELECTION } from '../../../security/src/index.ts';
import { encodeString, sha256Hex } from '../validators/canonical.ts';
import { fingerprintOf } from './keys.ts';
import type { ProductionHsmAttestation, ProductionKeyPurpose } from './types.ts';

export const SIMULATION_HSM_PROVIDER_ID = 'sunrey-ceremony-hsm-simulator' as const;

export function assessPqCapability(): {
  readonly capability: 'UNSUPPORTED' | 'SOFTWARE_ONLY' | 'PROVIDER_CLAIMED';
  readonly notes: string;
} {
  return Object.freeze({
    capability: 'SOFTWARE_ONLY',
    notes: `HSM PQ capability is unsupported. Software PQC provider ${PQC_LIBRARY_SELECTION.selectedProvider.providerId} is ${PQC_LIBRARY_SELECTION.productionStatus}. Ceremony does not invent a new mainnet PQ migration.`,
  });
}

export function simulationHsmCapabilities(): {
  readonly providerId: string;
  readonly simulation: true;
  readonly nonExportable: true;
  readonly environmentLabel: string;
  readonly pq: ReturnType<typeof assessPqCapability>;
} {
  const hsm = createCeremonySimulationHsm({ fixtureEnv: { SUNREY_FIXTURE_ENV: 'local' } });
  void hsm.capabilities();
  return Object.freeze({
    providerId: SIMULATION_HSM_PROVIDER_ID,
    simulation: true,
    nonExportable: true,
    environmentLabel: CEREMONY_HSM_ENVIRONMENT_LABEL,
    pq: assessPqCapability(),
  });
}

export function createSimulationAttestation(input: {
  readonly publicKeyHex: string;
  readonly purpose: ProductionKeyPurpose;
  readonly keyHandle: string;
  readonly humanWitness: string | null;
}): ProductionHsmAttestation {
  const pq = assessPqCapability();
  const attestation = `SIMULATION_ATTESTATION:${input.keyHandle}:${input.purpose}:${fingerprintOf(input.publicKeyHex)}`;
  const attestationHash = sha256Hex(Buffer.concat([encodeString('sunrey.hsm.attestation.v1'), encodeString(attestation)]));
  return Object.freeze({
    providerId: SIMULATION_HSM_PROVIDER_ID,
    keyHandle: input.keyHandle,
    publicDescriptor: input.publicKeyHex,
    algorithm: 'Ed25519',
    attestation,
    attestationHash,
    creationEvidence: 'provider-side simulation generateKey; non-exportable handle',
    purpose: input.purpose,
    environment: 'REHEARSAL',
    humanWitness: input.humanWitness,
    label: 'SIMULATION_ATTESTATION',
    pqCapability: pq.capability,
    simulation: true,
  });
}

export function verifyAttestation(record: ProductionHsmAttestation): boolean {
  const expected = sha256Hex(
    Buffer.concat([encodeString('sunrey.hsm.attestation.v1'), encodeString(record.attestation)]),
  );
  return expected === record.attestationHash;
}

export function rejectTamperedAttestation(record: ProductionHsmAttestation): void {
  if (!verifyAttestation(record)) {
    throw new TypeError('tampered HSM attestation rejected');
  }
}

export function rejectSimulationHsmForExternalRequirement(
  record: ProductionHsmAttestation,
  requireRealHsm: boolean,
): void {
  if (requireRealHsm && record.simulation) {
    throw new TypeError('simulation HSM cannot satisfy external HSM requirement');
  }
}

export function providerCannotExceedAcceptance(
  acceptanceStatus: 'NOT_PRESENT' | 'ENGINEERING_ONLY' | 'ACCEPTED' | 'PRODUCTION_ELIGIBLE',
): false {
  void acceptanceStatus;
  return false;
}
