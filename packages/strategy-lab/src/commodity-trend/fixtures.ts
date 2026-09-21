import { asUtcInstant, type UtcInstant } from '@solstice/domain';
import { asMarketDatasetVersion } from '../ids.ts';
import {
  GOLD_ETF_GLD_ID,
  GOLD_FUTURES_GCZ2026_ID,
  GOLD_REFERENCE_ID,
  HELIOS_M11_INSTRUMENT_UNIVERSE,
  WTI_COMMODITY_REFERENCE_ID,
  WTI_FUTURES_CLM2026_ID,
  WTI_OIL_ETF_PROXY_ID,
} from '../multi-asset/constants.ts';
import { commodityBarToChronologicalObservation } from '../multi-asset/commodity-observation-bridge.ts';
import { freezeEvaluationDatasetManifest, type EvaluationDatasetManifest } from '../evaluation/manifest.ts';
import type {
  CommodityTrendBar,
  CommodityTrendGovernance,
  CommodityTrendMarketState,
  CommodityTrendPosition,
} from './types.ts';
import { DEFAULT_M11_CONFIG } from './constants.ts';

function instant(iso: string): UtcInstant {
  return asUtcInstant(iso);
}

export const VALID_GOVERNANCE: CommodityTrendGovernance = Object.freeze({
  workOrderActive: true,
  customerMandateValid: true,
  decisionValidityEnvelopeValid: true,
  longPermitted: true,
  shortPermitted: true,
});

export const VALID_GOVERNANCE_LONG_ONLY: CommodityTrendGovernance = Object.freeze({
  workOrderActive: true,
  customerMandateValid: true,
  decisionValidityEnvelopeValid: true,
  longPermitted: true,
  shortPermitted: false,
});

function baseMarket(overrides?: Partial<CommodityTrendMarketState>): CommodityTrendMarketState {
  return Object.freeze({
    regime: 'TRENDING',
    freshnessStatus: 'fresh',
    observationAgeMs: 600_000,
    providerHealth: 'healthy',
    spreadBps: 18,
    liquidityScore: 75,
    relativeVolumeRatio: 1.2,
    realizedVolatilityBps: 900,
    fastMaMinor: 2_410_00n,
    slowMaMinor: 2_380_00n,
    trendDirection1h: 'UP',
    trendDirection4h: 'UP',
    contextTrend1d: 'UP',
    rateOfChangeBps: 120,
    breakoutState: 'BULLISH',
    sessionState: 'OPEN',
    instrumentKind: 'etf_proxy',
    rollState: 'FRONT',
    contractExpired: false,
    historyBars: 48,
    marketState: 'NORMAL',
    ...overrides,
  });
}

export function validGoldUptrendMarket(overrides?: Partial<CommodityTrendMarketState>): CommodityTrendMarketState {
  return baseMarket(overrides);
}

export function validGoldDowntrendMarket(overrides?: Partial<CommodityTrendMarketState>): CommodityTrendMarketState {
  return baseMarket({
    fastMaMinor: 2_360_00n,
    slowMaMinor: 2_390_00n,
    trendDirection1h: 'DOWN',
    trendDirection4h: 'DOWN',
    contextTrend1d: 'DOWN',
    rateOfChangeBps: -140,
    breakoutState: 'BEARISH',
    ...overrides,
  });
}

export function validWtiUptrendMarket(overrides?: Partial<CommodityTrendMarketState>): CommodityTrendMarketState {
  return baseMarket({
    fastMaMinor: 78_50n,
    slowMaMinor: 76_20n,
    rateOfChangeBps: 95,
    ...overrides,
  });
}

export function validWtiDowntrendMarket(overrides?: Partial<CommodityTrendMarketState>): CommodityTrendMarketState {
  return baseMarket({
    fastMaMinor: 74_10n,
    slowMaMinor: 76_80n,
    trendDirection1h: 'DOWN',
    trendDirection4h: 'DOWN',
    contextTrend1d: 'DOWN',
    rateOfChangeBps: -110,
    breakoutState: 'BEARISH',
    ...overrides,
  });
}

export function baseGoldBar(overrides?: Partial<CommodityTrendBar>): CommodityTrendBar {
  return Object.freeze({
    instrumentId: GOLD_ETF_GLD_ID,
    periodStart: instant('2026-09-20T14:00:00.000Z'),
    openMinor: 2_420_00n,
    highMinor: 2_435_00n,
    lowMinor: 2_415_00n,
    closeMinor: 2_430_00n,
    volumeMinor: 500_000_00n,
    bidMinor: 2_429_50n,
    askMinor: 2_430_50n,
    ...overrides,
  });
}

export function baseWtiBar(overrides?: Partial<CommodityTrendBar>): CommodityTrendBar {
  return Object.freeze({
    instrumentId: WTI_OIL_ETF_PROXY_ID,
    periodStart: instant('2026-09-20T14:00:00.000Z'),
    openMinor: 79_00n,
    highMinor: 79_80n,
    lowMinor: 78_60n,
    closeMinor: 79_50n,
    volumeMinor: 800_000_00n,
    bidMinor: 79_45n,
    askMinor: 79_55n,
    ...overrides,
  });
}

export function flatPosition(): CommodityTrendPosition {
  return Object.freeze({
    hasOpenPosition: false,
    side: null,
    entryAt: null,
    entryPriceMinor: null,
    highWaterMarkMinor: null,
    lowWaterMarkMinor: null,
    adverseExcursionBps: 0,
  });
}

export function openLongPosition(entryAt: UtcInstant, entryPriceMinor: bigint): CommodityTrendPosition {
  return Object.freeze({
    hasOpenPosition: true,
    side: 'LONG',
    entryAt,
    entryPriceMinor,
    highWaterMarkMinor: entryPriceMinor,
    lowWaterMarkMinor: null,
    adverseExcursionBps: 0,
  });
}

export function openShortPosition(entryAt: UtcInstant, entryPriceMinor: bigint): CommodityTrendPosition {
  return Object.freeze({
    hasOpenPosition: true,
    side: 'SHORT',
    entryAt,
    entryPriceMinor,
    highWaterMarkMinor: null,
    lowWaterMarkMinor: entryPriceMinor,
    adverseExcursionBps: 0,
  });
}

export function computeSimpleMovingAveragePriorBars(closes: readonly bigint[]): bigint {
  if (closes.length === 0) {
    return 0n;
  }
  const sum = closes.reduce((acc, value) => acc + value, 0n);
  return sum / BigInt(closes.length);
}

export function commodityTrendEvaluationManifest(): EvaluationDatasetManifest {
  const start = instant('2026-09-01T00:00:00.000Z');
  const observations = [];
  let seq = 0;

  const series: readonly { readonly id: string; readonly base: bigint; readonly step: bigint }[] = Object.freeze([
    { id: GOLD_ETF_GLD_ID, base: 2_400_00n, step: 2n },
    { id: GOLD_REFERENCE_ID, base: 2_395_00n, step: 2n },
    { id: GOLD_FUTURES_GCZ2026_ID, base: 2_405_00n, step: 2n },
    { id: WTI_OIL_ETF_PROXY_ID, base: 75_00n, step: 1n },
    { id: WTI_COMMODITY_REFERENCE_ID, base: 74_80n, step: 1n },
    { id: WTI_FUTURES_CLM2026_ID, base: 75_20n, step: 1n },
  ]);

  for (let hour = 0; hour < 72; hour += 1) {
    const day = hour < 24 ? '01' : hour < 48 ? '02' : '03';
    const hourOfDay = hour % 24;
    const at = instant(`2026-09-${day}T${String(hourOfDay).padStart(2, '0')}:00:00.000Z`);
    for (const row of series) {
      const close = row.base + BigInt(hour) * row.step;
      observations.push(
        commodityBarToChronologicalObservation({
          observationId: `obs_${row.id}_${String(hour)}`,
          instrumentId: row.id,
          periodStart: at,
          knowableAt: at,
          providerId: 'finnhub_fixture',
          providerSequence: seq++,
          openMinor: close - row.step,
          highMinor: close + row.step * 2n,
          lowMinor: close - row.step * 2n,
          closeMinor: close,
          bidMinor: close - 5n,
          askMinor: close + 5n,
        }),
      );
    }
  }

  const frozen = freezeEvaluationDatasetManifest({
    version: asMarketDatasetVersion('edmf-m11-commodity-trend-v1'),
    instruments: Object.freeze([...HELIOS_M11_INSTRUMENT_UNIVERSE]),
    membership: Object.freeze(
      HELIOS_M11_INSTRUMENT_UNIVERSE.map((instrumentId) => ({
        instrumentId,
        enteredAt: start,
        leftAt: null,
      })),
    ),
    timeRange: { start, end: instant('2026-09-03T23:00:00.000Z') },
    providerIds: Object.freeze(['finnhub_fixture']),
    datasetIds: Object.freeze(['m07_gold_m08_wti_fixture']),
    corporateActionHandling: 'INVESTMENTS_SPLIT_DIVIDEND_SEMANTICS',
    corporateActionVersion: null,
    degradedPeriods: Object.freeze([
      {
        start: instant('2026-09-02T12:00:00.000Z'),
        end: instant('2026-09-02T13:00:00.000Z'),
        reason: 'provider degraded',
      },
    ]),
    feedEntitlement: 'SYNTHETIC_FIXTURE',
    gapsExplicit: Object.freeze([]),
    limitations: Object.freeze([
      'M11 commodity trend fixture built from M07 gold and M08 WTI production-shaped schemas.',
      'Forward-paper / research only — not live commodity or futures execution.',
      'Continuous futures series included for research signals only — never executable.',
    ]),
    observations: Object.freeze(observations),
    corporateActions: Object.freeze([]),
  });
  if (!frozen.ok) {
    throw new Error(frozen.error.message);
  }
  return frozen.value;
}

export const M11_FIXTURE_DEFAULTS = DEFAULT_M11_CONFIG;
