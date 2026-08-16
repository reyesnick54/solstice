/**
 * Provider-neutral off-chain OracleAdapter.
 *
 * Adapters collect information outside consensus and emit unsigned
 * observation drafts. Consensus never imports an adapter for execution
 * and never calls HTTP, websites, models, or external databases.
 */

import type { DeviceProvenance, FixedQuantity, GeographicScope, OracleObservation } from './types.ts';

export type OracleObservationDraft = Omit<
  OracleObservation,
  'observationId' | 'signatureHex' | 'publicKeyHex' | 'cryptoSuite'
> & {
  readonly publicKeyHex?: string;
  readonly cryptoSuite?: string;
};

export type OracleAdapterContext = {
  readonly oracleId: string;
  readonly feedId: string;
  readonly subject: string;
  readonly networkId: string;
  readonly chainId: string;
  readonly sequence: bigint;
  readonly measurementStartUnix: bigint;
  readonly measurementEndUnix: bigint;
  readonly observationTimeUnix: bigint;
  readonly validUntilUnix: bigint;
};

export type OracleAdapter = {
  readonly adapterId: string;
  readonly description: string;
  collect(context: OracleAdapterContext, value: FixedQuantity): OracleObservationDraft;
};

const DEVNET_GEO: GeographicScope = Object.freeze({
  schemaVersion: 1,
  jurisdiction: 'SIM',
  region: 'devnet',
  locality: 'lab',
});

function draftFrom(
  adapterId: string,
  context: OracleAdapterContext,
  value: FixedQuantity,
  device: DeviceProvenance | null,
): OracleObservationDraft {
  return Object.freeze({
    schemaVersion: 1,
    oracleId: context.oracleId,
    feedId: context.feedId,
    subject: context.subject,
    value,
    measurementStartUnix: context.measurementStartUnix,
    measurementEndUnix: context.measurementEndUnix,
    observationTimeUnix: context.observationTimeUnix,
    validUntilUnix: context.validUntilUnix,
    geography: DEVNET_GEO,
    sourceReferenceCommitment: `src_${adapterId}_${context.oracleId}_${context.sequence.toString()}`,
    methodologyReference: `method.${adapterId}.v1`,
    confidence: Object.freeze({
      schemaVersion: 1 as const,
      scoreBps: 9_000,
      sampleCount: 1,
      notesRef: adapterId,
    }),
    sequence: context.sequence,
    networkId: context.networkId,
    chainId: context.chainId,
    deviceProvenance: device,
    weight: 1n,
  });
}

export class SimulationEnergyAdapter implements OracleAdapter {
  readonly adapterId = 'sim.energy.grid';
  readonly description = 'Deterministic simulation energy provider. No external grid call.';

  collect(context: OracleAdapterContext, value: FixedQuantity): OracleObservationDraft {
    return draftFrom(this.adapterId, context, value, null);
  }
}

export class SimulationComputeAdapter implements OracleAdapter {
  readonly adapterId = 'sim.compute.usage';
  readonly description = 'Deterministic simulation compute/GPU usage provider. No cloud API call.';

  collect(context: OracleAdapterContext, value: FixedQuantity): OracleObservationDraft {
    return draftFrom(this.adapterId, context, value, {
      schemaVersion: 1,
      deviceId: 'dev_gpu_sim_1',
      ownerController: context.oracleId,
      firmwareHash: 'fw_sim_compute_v1',
      hardwareAttestation: 'attest_sim_compute_v1',
      calibrationRecord: 'cal_sim_compute_v1',
      measurementSchema: 'compute.gpu_s.v1',
    });
  }
}

export function consensusMustNotCallAdapters(): true {
  return true;
}
