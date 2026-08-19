/**
 * Operational reports and Economic Asset Registry projections.
 *
 * The fabric projects descriptors. The registry remains source of truth.
 */

import { asUtcInstant } from '../../../../../domain/src/time.ts';
import {
  EconomicAssetRegistry,
  type EconomicAssetDescriptor,
} from '../../../../../economic-asset-registry/src/index.ts';
import { OracleEconomicAssetAdapter } from '../../economic-asset-adapter.ts';
import type { EconomicDataSource, OracleProviderOnboardingRecord } from '../types.ts';
import type { OracleObservation, VerifiedEconomicFact } from '../../types.ts';
import type { SourceProvenance } from '../types.ts';
import { buildCoverageReport } from './coverage.ts';
import type { EconomicDataCollectionEnvelope, EconomicDataFabricCoverageReport } from './types.ts';

export type FabricOperationalReport = {
  readonly coverage: EconomicDataFabricCoverageReport;
  readonly envelopeCount: number;
  readonly liveProviderConnections: 0;
  readonly fabricFinalizesFacts: false;
  readonly fabricMintsMoonRey: false;
  readonly chunk71RemainsMonetaryAuthority: true;
};

export function operationalReport(
  envelopes: readonly EconomicDataCollectionEnvelope[],
): FabricOperationalReport {
  return Object.freeze({
    coverage: buildCoverageReport(),
    envelopeCount: envelopes.length,
    liveProviderConnections: 0,
    fabricFinalizesFacts: false,
    fabricMintsMoonRey: false,
    chunk71RemainsMonetaryAuthority: true,
  });
}

export function projectFabricAssets(input: {
  readonly source: EconomicDataSource;
  readonly onboarding: OracleProviderOnboardingRecord;
  readonly observations?: readonly OracleObservation[];
  readonly provenance?: SourceProvenance;
  readonly fact?: VerifiedEconomicFact;
  readonly nowUnix: bigint;
  readonly registry?: EconomicAssetRegistry;
}): {
  readonly registry: EconomicAssetRegistry;
  readonly sourceDescriptor: EconomicAssetDescriptor | undefined;
  readonly observationDescriptor: EconomicAssetDescriptor | undefined;
  readonly factDescriptor: EconomicAssetDescriptor | undefined;
  readonly fabricIsRegistryAuthority: false;
} {
  const registry = input.registry ?? new EconomicAssetRegistry();
  const adapter = new OracleEconomicAssetAdapter(registry);
  const at = asUtcInstant(new Date(Number(input.nowUnix) * 1000).toISOString());
  const source = adapter.projectSource(input.source, input.onboarding, at);
  const observation =
    input.observations
      ? adapter.projectObservationSet({
          observations: input.observations,
          source: input.source,
          provenance: input.provenance,
          at,
        })
      : undefined;
  const fact = input.fact ? adapter.projectVerifiedFact({ fact: input.fact, at }) : undefined;
  return Object.freeze({
    registry,
    sourceDescriptor: source.ok ? source.value : undefined,
    observationDescriptor: observation && observation.ok ? observation.value : undefined,
    factDescriptor: fact && fact.ok ? fact.value : undefined,
    fabricIsRegistryAuthority: false,
  });
}
