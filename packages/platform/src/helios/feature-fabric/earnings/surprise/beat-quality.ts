/**
 * Beat quality decomposition — not all EPS beats are equal.
 */

import { HELIOS_EARN03_SURPRISE_TENSOR_SCHEMA } from './taxonomy.ts';
import type { BeatQualityDriver } from './taxonomy.ts';
import type { BeatQualityDecomposition, BeatQualityLine, ScaledSurprise } from './types.ts';

const OPERATING_DRIVERS: ReadonlySet<BeatQualityDriver> = new Set([
  'OPERATING',
  'REVENUE',
  'MARGIN',
]);

export function buildBeatQualityDecomposition(input: {
  readonly fiscalPeriod: string;
  readonly reportedEpsBeatMinor: bigint;
  readonly lines: readonly BeatQualityLine[];
}): BeatQualityDecomposition {
  let attributed = 0n;
  const byDriver = new Map<BeatQualityDriver, bigint>();
  for (const line of input.lines) {
    attributed += line.epsImpactMinor;
    byDriver.set(line.driver, (byDriver.get(line.driver) ?? 0n) + line.epsImpactMinor);
  }
  const unattributed = input.reportedEpsBeatMinor - attributed;
  const dominantDriver = pickDominantDriver(byDriver, unattributed);
  const operatingImpact =
    (byDriver.get('OPERATING') ?? 0n) +
    (byDriver.get('REVENUE') ?? 0n) +
    (byDriver.get('MARGIN') ?? 0n);
  const nonOperatingImpact = input.reportedEpsBeatMinor - operatingImpact;
  const operatingQualityScoreScaled = scoreOperatingQuality(
    input.reportedEpsBeatMinor,
    operatingImpact,
    nonOperatingImpact,
  );

  return Object.freeze({
    schema: HELIOS_EARN03_SURPRISE_TENSOR_SCHEMA,
    fiscalPeriod: input.fiscalPeriod,
    reportedEpsBeatMinor: input.reportedEpsBeatMinor,
    attributedEpsMinor: attributed,
    unattributedEpsMinor: unattributed,
    lines: Object.freeze([...input.lines]),
    dominantDriver,
    operatingQualityScoreScaled,
    grantsExecutionAuthority: false as const,
  });
}

export function isOperatingQualityDriver(driver: BeatQualityDriver): boolean {
  return OPERATING_DRIVERS.has(driver);
}

function pickDominantDriver(
  byDriver: Map<BeatQualityDriver, bigint>,
  unattributed: bigint,
): BeatQualityDriver {
  let best: BeatQualityDriver = 'UNKNOWN';
  let bestAbs = unattributed < 0n ? -unattributed : unattributed;
  if (bestAbs > 0n) {
    best = 'UNKNOWN';
  } else {
    bestAbs = 0n;
  }
  for (const [driver, impact] of byDriver) {
    const abs = impact < 0n ? -impact : impact;
    if (abs > bestAbs) {
      bestAbs = abs;
      best = driver;
    }
  }
  return best;
}

function scoreOperatingQuality(
  totalBeat: bigint,
  operatingImpact: bigint,
  nonOperatingImpact: bigint,
): ScaledSurprise {
  const totalAbs = totalBeat < 0n ? -totalBeat : totalBeat;
  if (totalAbs === 0n) {
    return 0;
  }
  const operatingAbs = operatingImpact < 0n ? -operatingImpact : operatingImpact;
  const nonOpAbs = nonOperatingImpact < 0n ? -nonOperatingImpact : nonOperatingImpact;
  const operatingShare = Number((operatingAbs * 10_000n) / totalAbs);
  const penalty = Number((nonOpAbs * 10_000n) / totalAbs);
  return operatingShare - penalty;
}
