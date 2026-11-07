import { createHash } from 'node:crypto';
import type { AlternativeDataCoverageState, AlternativeDataObservation } from './types.ts';
import type { AlternativeDataSignalFamily } from './taxonomy.ts';

function stableCoveragePayload(
  family: AlternativeDataSignalFamily,
  providerId: string,
  observations: readonly AlternativeDataObservation[],
): string {
  const rows = observations
    .filter((row) => row.signalFamily === family && row.providerId === providerId)
    .map((row) => ({
      id: row.observationId,
      knowableAt: row.knowableAt,
      eventTime: row.eventTime,
      quality: row.qualityState,
    }));
  return JSON.stringify({ family, providerId, rows });
}

export function buildAlternativeDataCoverageState(input: {
  readonly signalFamily: AlternativeDataSignalFamily;
  readonly providerId: string;
  readonly observations: readonly AlternativeDataObservation[];
}): AlternativeDataCoverageState {
  const scoped = input.observations.filter(
    (row) => row.signalFamily === input.signalFamily && row.providerId === input.providerId,
  );
  const regionSet = new Set<string>();
  for (const row of scoped) {
    for (const code of row.geographicCoverage.regionCodes) {
      regionSet.add(code);
    }
  }
  const degraded = scoped.some(
    (row) =>
      row.qualityState === 'DEGRADED_STALE' ||
      row.qualityState === 'DEGRADED_PARTIAL_COVERAGE' ||
      row.qualityState === 'QUARANTINED',
  );
  const temporalCoverageStart =
    scoped
      .map((row) => row.eventTime ?? row.knowableAt)
      .sort((a, b) => Date.parse(a) - Date.parse(b))[0] ?? null;
  const temporalCoverageEnd =
    scoped
      .map((row) => row.eventTime ?? row.knowableAt)
      .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
  const digest = createHash('sha256').update(stableCoveragePayload(input.signalFamily, input.providerId, scoped)).digest('hex');
  const sample = scoped[0];
  return Object.freeze({
    signalFamily: input.signalFamily,
    providerId: input.providerId,
    geographicCoverage: sample?.geographicCoverage ?? {
      regionCodes: Object.freeze([...regionSet]),
      coverageKind: regionSet.size > 1 ? 'REGIONAL' : 'UNKNOWN',
      confidence: null,
    },
    temporalCoverageStart,
    temporalCoverageEnd,
    observationCount: scoped.length,
    degraded,
    tensorDigest: digest,
  });
}
