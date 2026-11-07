/**
 * Composite market-data quality score with exposed components (no hidden blending).
 */

import type { UtcInstant } from '@solstice/domain';

import { MD12_DEFAULT_POLICY } from './taxonomy.ts';
import type { Md12AnomalyClassification } from './taxonomy.ts';
import type { Md12QualityBand } from './taxonomy.ts';
import type { MarketDataAnomaly, MarketDataQualityScoreComponents, MarketDataQualityState } from './types.ts';
import type { LiquidityState, MicrostructureState } from './types.ts';
import { HELIOS_MD12_AUTHORITY, HELIOS_MD12_SCHEMA } from './taxonomy.ts';

const COMPONENT_WEIGHTS = Object.freeze({
  freshness: 20n,
  bookIntegrity: 20n,
  tradeIntegrity: 20n,
  sequenceIntegrity: 15n,
  corroboration: 15n,
  anomalyPenalty: 10n,
});

function clampPpm(value: bigint): bigint {
  if (value < 0n) return 0n;
  if (value > 1_000_000n) return 1_000_000n;
  return value;
}

function bandFromComposite(compositePpm: bigint): Md12QualityBand {
  if (compositePpm >= 850_000n) return 'HIGH';
  if (compositePpm >= 700_000n) return 'ADEQUATE';
  if (compositePpm >= 500_000n) return 'DEGRADED';
  return 'UNUSABLE';
}

export function buildMarketDataQualityState(input: {
  readonly instrumentId: string;
  readonly venueId: string;
  readonly providerId: string;
  readonly asOf: UtcInstant;
  readonly quoteAgeMs: number;
  readonly staleQuoteMs?: number;
  readonly anomalies: readonly MarketDataAnomaly[];
  readonly microstructure: MicrostructureState | null;
  readonly liquidity: LiquidityState | null;
  readonly corroborationProviderCount: number;
}): MarketDataQualityState {
  const staleMs = input.staleQuoteMs ?? MD12_DEFAULT_POLICY.staleQuoteMs;
  const freshnessPpm = clampPpm(
    1_000_000n - (BigInt(Math.max(input.quoteAgeMs, 0)) * 1_000_000n) / BigInt(Math.max(staleMs, 1)),
  );

  const bookAnomalies = input.anomalies.filter((row) =>
    ['CROSSED_BOOK', 'LOCKED_BOOK', 'ZERO_SIZE', 'IMPOSSIBLE_PRICE'].includes(row.kind),
  );
  const bookIntegrityPpm = clampPpm(1_000_000n - BigInt(bookAnomalies.length) * 250_000n);

  const tradeAnomalies = input.anomalies.filter((row) =>
    ['DUPLICATE_TRADE', 'TRADE_OUTSIDE_PLAUSIBLE_MARKET', 'PRICE_SPIKE'].includes(row.kind),
  );
  const tradeIntegrityPpm = clampPpm(1_000_000n - BigInt(tradeAnomalies.length) * 200_000n);

  const seqAnomalies = input.anomalies.filter((row) =>
    ['SEQUENCE_DISCONTINUITY', 'TIMESTAMP_REVERSAL', 'LATENCY_SPIKE'].includes(row.kind),
  );
  const sequenceIntegrityPpm = clampPpm(1_000_000n - BigInt(seqAnomalies.length) * 200_000n);

  const corroborationPpm = clampPpm(
    input.corroborationProviderCount >= 2
      ? 1_000_000n
      : input.corroborationProviderCount === 1
        ? 700_000n
        : 400_000n,
  );

  const counts: Partial<Record<Md12AnomalyClassification, number>> = {};
  for (const row of input.anomalies) {
    counts[row.classification] = (counts[row.classification] ?? 0) + 1;
  }
  const untrusted = BigInt(counts.UNTRUSTED ?? 0);
  const likely = BigInt(counts.LIKELY_DATA_ERROR ?? 0);
  const total = BigInt(input.anomalies.length);
  const penaltySharePpm =
    total > 0n ? clampPpm(((untrusted * 500_000n + likely * 250_000n) / total)) : 0n;
  const anomalyPenaltyPpm = clampPpm(1_000_000n - penaltySharePpm);

  const components: MarketDataQualityScoreComponents = Object.freeze({
    freshnessPpm,
    bookIntegrityPpm,
    tradeIntegrityPpm,
    sequenceIntegrityPpm,
    corroborationPpm,
    anomalyPenaltyPpm,
  });

  const weightSum =
    COMPONENT_WEIGHTS.freshness +
    COMPONENT_WEIGHTS.bookIntegrity +
    COMPONENT_WEIGHTS.tradeIntegrity +
    COMPONENT_WEIGHTS.sequenceIntegrity +
    COMPONENT_WEIGHTS.corroboration +
    COMPONENT_WEIGHTS.anomalyPenalty;

  const compositeScorePpm = clampPpm(
    (components.freshnessPpm * COMPONENT_WEIGHTS.freshness +
      components.bookIntegrityPpm * COMPONENT_WEIGHTS.bookIntegrity +
      components.tradeIntegrityPpm * COMPONENT_WEIGHTS.tradeIntegrity +
      components.sequenceIntegrityPpm * COMPONENT_WEIGHTS.sequenceIntegrity +
      components.corroborationPpm * COMPONENT_WEIGHTS.corroboration +
      components.anomalyPenaltyPpm * COMPONENT_WEIGHTS.anomalyPenalty) /
      weightSum,
  );

  const untrustedSharePpm =
    total > 0n ? (untrusted * 1_000_000n) / total : 0n;
  const likelySharePpm = total > 0n ? (likely * 1_000_000n) / total : 0n;

  const sufficientForResearch =
    compositeScorePpm >= BigInt(MD12_DEFAULT_POLICY.minResearchCompositePpm) &&
    untrustedSharePpm <= BigInt(MD12_DEFAULT_POLICY.maxUntrustedAnomalySharePpm) &&
    likelySharePpm <= BigInt(MD12_DEFAULT_POLICY.maxLikelyErrorAnomalySharePpm);

  return Object.freeze({
    schema: HELIOS_MD12_SCHEMA,
    authority: HELIOS_MD12_AUTHORITY,
    instrumentId: input.instrumentId,
    venueId: input.venueId,
    providerId: input.providerId,
    asOf: input.asOf,
    band: bandFromComposite(compositeScorePpm),
    compositeScorePpm,
    components,
    anomalyCounts: Object.freeze({ ...counts }),
    openAnomalyIds: Object.freeze(input.anomalies.map((row) => row.anomalyId)),
    sufficientForResearch,
    microstructure: input.microstructure,
    liquidity: input.liquidity,
  });
}
