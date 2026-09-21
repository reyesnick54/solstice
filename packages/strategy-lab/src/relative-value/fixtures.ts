import { asUtcInstant, type UtcInstant } from '@solstice/domain';
import { buildChronologicalObservation, freezeEvaluationDatasetManifest } from '../evaluation/manifest.ts';
import type { EvaluationDatasetManifest } from '../evaluation/manifest.ts';
import { M09_QQQ_INSTRUMENT_ID, M09_SPY_INSTRUMENT_ID } from '../m09/ids.ts';
import {
  CRYPTO_BTC_USD_ASSET_ID,
  CRYPTO_ETH_USD_ASSET_ID,
} from '../multi-asset/constants.ts';
import {
  M12_BTC_ETH_PAIR_ID,
  M12_GLD_GC_RESEARCH_PAIR_ID,
  M12_SPY_QQQ_PAIR_ID,
} from './ids.ts';
import type { M12PairId } from './ids.ts';
import type { M12BarObservation } from './types.ts';
import { M12_GLD_ETF_INSTRUMENT_ID, M12_GOLD_FUTURES_CONTINUOUS_ID } from './ids.ts';

const BASE_DAY = '2026-05-01';

function barTime(dayOffset: number, barIndex: number): UtcInstant {
  const absoluteHour = 12 + barIndex;
  const day = 1 + dayOffset + Math.floor(absoluteHour / 24);
  const hour = absoluteHour % 24;
  return asUtcInstant(
    `${BASE_DAY.slice(0, 8)}${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00.000Z`,
  );
}

export function buildM12Bar(input: {
  readonly instrumentId: string;
  readonly barIndex: number;
  readonly dayOffset?: number;
  readonly closeMinor: bigint;
  readonly overrides?: Partial<
    Pick<
      M12BarObservation,
      'available' | 'spreadBps' | 'knowableAt' | 'sourceEventTime' | 'providerHealth' | 'providerId'
    >
  >;
}): M12BarObservation {
  const at = input.overrides?.sourceEventTime ?? barTime(input.dayOffset ?? 0, input.barIndex);
  const close = input.closeMinor;
  const spread = input.overrides?.spreadBps ?? 8n;
  return Object.freeze({
    instrumentId: input.instrumentId,
    barInterval: '1h',
    sourceEventTime: at,
    knowableAt: input.overrides?.knowableAt ?? at,
    closeMinor: close,
    bidMinor: close - spread,
    askMinor: close + spread,
    spreadBps: spread,
    available: input.overrides?.available ?? true,
    providerId: input.overrides?.providerId ?? 'fixture_m12',
    providerSequence: input.barIndex,
    providerHealth: input.overrides?.providerHealth ?? 'healthy',
    observationId: `obs_m12_${input.instrumentId}_${String(input.barIndex)}`,
  });
}

function spyCloseStable(barIndex: number): bigint {
  return 450_00n + BigInt(barIndex) * 10n;
}

function qqqCloseStable(barIndex: number): bigint {
  return 380_00n + BigInt(barIndex) * 8n;
}

function spyCloseUnstable(barIndex: number): bigint {
  const base = 450_00n;
  if (barIndex < 40) {
    return base + BigInt(barIndex) * 10n;
  }
  return base + 400n - BigInt(barIndex - 40) * 60n;
}

function qqqCloseUnstable(barIndex: number): bigint {
  return 380_00n + BigInt(barIndex) * 8n;
}

function coLinearSpy(barIndex: number, spreadShift: bigint): bigint {
  const qqq = 380_00n + BigInt(barIndex) * 8n;
  return (qqq * 12_500n) / 10_000n + 7_000n + spreadShift;
}

function spyCloseConvergence(barIndex: number): bigint {
  if (barIndex < 50) {
    return coLinearSpy(barIndex, 0n);
  }
  if (barIndex < 55) {
    return coLinearSpy(barIndex, -3_500n);
  }
  return coLinearSpy(barIndex, 0n);
}

function qqqCloseConvergence(barIndex: number): bigint {
  return 380_00n + BigInt(barIndex) * 8n;
}

function btcClose(barIndex: number, scenario: 'stable' | 'collapse'): bigint {
  if (scenario === 'collapse' && barIndex >= 45) {
    return 65_000_00n + BigInt(barIndex - 45) * 500_00n;
  }
  return 65_000_00n + BigInt(barIndex) * 100n;
}

function ethClose(barIndex: number, scenario: 'stable' | 'collapse'): bigint {
  if (scenario === 'collapse' && barIndex >= 45) {
    return 3_200_00n - BigInt(barIndex - 45) * 50_00n;
  }
  return 3_200_00n + BigInt(barIndex) * 80n;
}

export type M12FixtureScenario =
  | 'stable_pair'
  | 'unstable_pair'
  | 'correlation_collapse'
  | 'spread_widening'
  | 'spread_convergence'
  | 'insufficient_history';

export function syntheticM12BarSeries(input?: {
  readonly pairId?: M12PairId;
  readonly barCount?: number;
  readonly scenario?: M12FixtureScenario;
}): readonly M12BarObservation[] {
  const pairId = input?.pairId ?? M12_SPY_QQQ_PAIR_ID;
  const count = input?.barCount ?? 60;
  const scenario = input?.scenario ?? 'stable_pair';
  const bars: M12BarObservation[] = [];

  if (pairId === M12_SPY_QQQ_PAIR_ID) {
    for (let i = 0; i < count; i += 1) {
      const spyClose =
        scenario === 'unstable_pair'
          ? spyCloseUnstable(i)
          : scenario === 'spread_convergence' || scenario === 'spread_widening'
            ? spyCloseConvergence(i)
            : spyCloseStable(i);
      const qqqClose =
        scenario === 'spread_convergence' || scenario === 'spread_widening'
          ? qqqCloseConvergence(i)
          : qqqCloseStable(i);
      bars.push(
        buildM12Bar({ instrumentId: M09_SPY_INSTRUMENT_ID, barIndex: i, closeMinor: spyClose }),
        buildM12Bar({ instrumentId: M09_QQQ_INSTRUMENT_ID, barIndex: i, closeMinor: qqqClose }),
      );
    }
    return Object.freeze(bars);
  }

  if (pairId === M12_BTC_ETH_PAIR_ID) {
    const cryptoScenario = scenario === 'correlation_collapse' ? 'collapse' : 'stable';
    for (let i = 0; i < count; i += 1) {
      bars.push(
        buildM12Bar({ instrumentId: CRYPTO_BTC_USD_ASSET_ID, barIndex: i, closeMinor: btcClose(i, cryptoScenario) }),
        buildM12Bar({ instrumentId: CRYPTO_ETH_USD_ASSET_ID, barIndex: i, closeMinor: ethClose(i, cryptoScenario) }),
      );
    }
    return Object.freeze(bars);
  }

  for (let i = 0; i < count; i += 1) {
    bars.push(
      buildM12Bar({ instrumentId: M12_GLD_ETF_INSTRUMENT_ID, barIndex: i, closeMinor: 180_00n + BigInt(i) * 5n }),
      buildM12Bar({
        instrumentId: M12_GOLD_FUTURES_CONTINUOUS_ID,
        barIndex: i,
        closeMinor: 185_00n + BigInt(i) * 5n,
      }),
    );
  }
  return Object.freeze(bars);
}

export function m12ChronologicalManifest(pairId: M12PairId = M12_SPY_QQQ_PAIR_ID): EvaluationDatasetManifest {
  const bars = syntheticM12BarSeries({ pairId, scenario: 'spread_convergence' });
  const instruments = [...new Set(bars.map((row) => row.instrumentId))];
  const observations = bars.map((bar) =>
    buildChronologicalObservation({
      observationId: bar.observationId,
      instrumentId: bar.instrumentId,
      sourceEventTime: bar.sourceEventTime,
      sunreyArrivalTime: bar.knowableAt,
      ingestionTime: bar.knowableAt,
      providerId: bar.providerId,
      providerSequence: bar.providerSequence,
      openMinor: bar.closeMinor - 10n,
      highMinor: bar.closeMinor + 20n,
      lowMinor: bar.closeMinor - 20n,
      closeMinor: bar.closeMinor,
      bidMinor: bar.bidMinor,
      askMinor: bar.askMinor,
      available: bar.available,
      sessionOpen: true,
    }),
  );

  const frozen = freezeEvaluationDatasetManifest({
    version: `edmf-m12-${pairId}-v1`,
    instruments: Object.freeze(instruments),
    membership: Object.freeze(
      instruments.map((instrumentId) => ({
        instrumentId,
        enteredAt: asUtcInstant(`${BASE_DAY}T00:00:00.000Z`),
        leftAt: null,
      })),
    ),
    timeRange: {
      start: asUtcInstant(`${BASE_DAY}T12:00:00.000Z`),
      end: asUtcInstant('2026-05-04T23:00:00.000Z'),
    },
    providerIds: Object.freeze(['fixture_m12']),
    datasetIds: Object.freeze([`fixture_m12_${pairId}`]),
    corporateActionHandling: 'INVESTMENTS_SPLIT_DIVIDEND_SEMANTICS',
    corporateActionVersion: 'corp-m12-v1',
    degradedPeriods: Object.freeze([]),
    feedEntitlement: 'SYNTHETIC_FIXTURE',
    gapsExplicit: Object.freeze([]),
    limitations: Object.freeze([
      'HELIOS M12 synthetic 1h relative-value fixture — not live market data.',
      'Correlation does not imply arbitrage; pair validation gates entries.',
    ]),
    observations: Object.freeze(observations),
    corporateActions: Object.freeze([]),
  });
  if (!frozen.ok) {
    throw new Error(frozen.error.message);
  }
  return frozen.value;
}

export function barsFromManifest(manifest: EvaluationDatasetManifest): readonly M12BarObservation[] {
  return Object.freeze(
    manifest.observations.map((row) =>
      buildM12Bar({
        instrumentId: row.instrumentId,
        barIndex: row.providerSequence,
        closeMinor: row.closeMinor,
        overrides: {
          sourceEventTime: row.informationTime.sourceEventTime,
          knowableAt: row.informationTime.knowableAt,
          available: row.available,
        },
      }),
    ),
  );
}
