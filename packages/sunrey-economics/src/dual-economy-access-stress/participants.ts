/**
 * Deterministic participant population for ACCESS-22 stress runs.
 */

import { DeterministicRng, mulBps } from '../seed.ts';
import { ACCESS_22_BENCHMARK_PARTICIPANT_ID } from './ids.ts';
import type { Access22Scenario, ParticipantTokenDistribution } from './types.ts';

const BENCHMARK_SUNREY_MINOR = 100n;
const BENCHMARK_MOONREY_MINOR = 100n;

export type ScaleResolution = Readonly<{
  readonly effectiveParticipantCount: number;
  readonly sampledParticipantCount: number;
}>;

export function resolveScaleParticipantCount(
  requested: number,
  scaleLevel: import('./ids.ts').Access22ScaleLevel,
): ScaleResolution {
  switch (scaleLevel) {
    case 'SCALE_1K':
      return Object.freeze({ effectiveParticipantCount: Math.min(requested, 1_000), sampledParticipantCount: Math.min(requested, 1_000) });
    case 'SCALE_100K':
      return Object.freeze({ effectiveParticipantCount: Math.min(requested, 100_000), sampledParticipantCount: Math.min(requested, 100_000) });
    case 'SCALE_1M':
      return Object.freeze({ effectiveParticipantCount: Math.min(requested, 1_000_000), sampledParticipantCount: Math.min(requested, 50_000) });
    case 'SCALE_10M_SAMPLED':
      return Object.freeze({ effectiveParticipantCount: 10_000_000, sampledParticipantCount: 25_000 });
    case 'SCALE_100M_AGGREGATE':
      return Object.freeze({ effectiveParticipantCount: 100_000_000, sampledParticipantCount: 5_000 });
    default:
      return Object.freeze({ effectiveParticipantCount: requested, sampledParticipantCount: requested });
  }
}

export function buildParticipants(
  scenario: Access22Scenario,
  scaleLevel: import('./ids.ts').Access22ScaleLevel,
  includeBenchmark = false,
): readonly ParticipantTokenDistribution[] {
  const scale = resolveScaleParticipantCount(scenario.participantCount, scaleLevel);
  const count = scale.sampledParticipantCount;
  const rng = new DeterministicRng(scenario.seed);
  const participants: ParticipantTokenDistribution[] = [];

  const whaleMode = scenario.scenarioId.includes('whale');
  const sybilMode = scenario.scenarioId.includes('sybil');
  const fiatSrMode = scenario.scenarioId.includes('fiat-to-sr');
  const fiatMrMode = scenario.scenarioId.includes('fiat-to-mr');

  for (let index = 0; index < count; index += 1) {
    const subjectId = `subj.${scenario.scenarioId}.${index}`;
    let sunreyMinor = 50n + BigInt(rng.nextBounded(500));
    let moonreyMinor = 50n + BigInt(rng.nextBounded(500));

    if (whaleMode && index === 0) {
      sunreyMinor = 500_000n;
      moonreyMinor = 500_000n;
    }
    if (sybilMode && index < 10) {
      sunreyMinor = 10_000n;
      moonreyMinor = 10_000n;
    }
    if (fiatSrMode && index < count / 10) {
      sunreyMinor = mulBps(sunreyMinor, 20_000n);
    }
    if (fiatMrMode && index < count / 10) {
      moonreyMinor = mulBps(moonreyMinor, 20_000n);
    }

    const dualHolder = sunreyMinor > 0n && moonreyMinor > 0n;
    participants.push(
      Object.freeze({
        subjectId,
        sunreyMinor,
        moonreyMinor,
        dualHolder,
        dataContributionUnits: BigInt(rng.nextBounded(100)),
        productiveContributionUnits: BigInt(rng.nextBounded(100)),
        sybilClusterId: sybilMode && index < 10 ? 'sybil.cluster.0' : null,
      }),
    );
  }

  if (includeBenchmark) {
    participants.push(
      Object.freeze({
        subjectId: ACCESS_22_BENCHMARK_PARTICIPANT_ID,
        sunreyMinor: BENCHMARK_SUNREY_MINOR,
        moonreyMinor: BENCHMARK_MOONREY_MINOR,
        dualHolder: true,
        dataContributionUnits: 10n,
        productiveContributionUnits: 10n,
        sybilClusterId: null,
      }),
    );
  }

  return Object.freeze(participants);
}

export function benchmarkParticipant(): ParticipantTokenDistribution {
  return Object.freeze({
    subjectId: ACCESS_22_BENCHMARK_PARTICIPANT_ID,
    sunreyMinor: BENCHMARK_SUNREY_MINOR,
    moonreyMinor: BENCHMARK_MOONREY_MINOR,
    dualHolder: true,
    dataContributionUnits: 10n,
    productiveContributionUnits: 10n,
    sybilClusterId: null,
  });
}
