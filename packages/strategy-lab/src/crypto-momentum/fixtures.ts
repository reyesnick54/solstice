import { asUtcInstant, type UtcInstant } from '@solstice/domain';
import { asMarketDatasetVersion } from '../ids.ts';
import {
  CRYPTO_BTC_USD_ASSET_ID,
  CRYPTO_ETH_USD_ASSET_ID,
  HELIOS_CRYPTO_USD_INSTRUMENTS,
} from '../multi-asset/constants.ts';
import { cryptoBarToChronologicalObservation } from '../multi-asset/crypto-observation-bridge.ts';
import { freezeEvaluationDatasetManifest, type EvaluationDatasetManifest } from '../evaluation/manifest.ts';
import type {
  CryptoMomentumBar,
  CryptoMomentumBreakoutControls,
  CryptoMomentumGovernance,
  CryptoMomentumMarketState,
  CryptoMomentumPosition,
} from './types.ts';
import { DEFAULT_M10_BREAKOUT_BUFFER_BPS, DEFAULT_M10_CONFIG } from './constants.ts';

function instant(iso: string): UtcInstant {
  return asUtcInstant(iso);
}

const VALID_GOVERNANCE: CryptoMomentumGovernance = Object.freeze({
  workOrderActive: true,
  customerMandateValid: true,
  decisionValidityEnvelopeValid: true,
});

function applyBuffer(rangeHighMinor: bigint, bufferBps: number): bigint {
  return rangeHighMinor + (rangeHighMinor * BigInt(bufferBps)) / 10_000n;
}

export function baseBtcBar(overrides?: Partial<CryptoMomentumBar>): CryptoMomentumBar {
  return Object.freeze({
    instrumentId: CRYPTO_BTC_USD_ASSET_ID,
    periodStart: instant('2026-09-01T12:00:00.000Z'),
    openMinor: 65_000_00n,
    highMinor: 65_500_00n,
    lowMinor: 64_800_00n,
    closeMinor: 65_400_00n,
    volumeMinor: 2_000_000_00n,
    bidMinor: 65_395_00n,
    askMinor: 65_405_00n,
    ...overrides,
  });
}

export function baseEthBar(overrides?: Partial<CryptoMomentumBar>): CryptoMomentumBar {
  return Object.freeze({
    instrumentId: CRYPTO_ETH_USD_ASSET_ID,
    periodStart: instant('2026-09-01T12:00:00.000Z'),
    openMinor: 3_400_00n,
    highMinor: 3_450_00n,
    lowMinor: 3_380_00n,
    closeMinor: 3_430_00n,
    volumeMinor: 1_500_000_00n,
    bidMinor: 3_429_00n,
    askMinor: 3_431_00n,
    ...overrides,
  });
}

export function validBtcBreakoutMarket(overrides?: Partial<CryptoMomentumMarketState>): CryptoMomentumMarketState {
  const rollingHigh = 65_000_00n;
  return Object.freeze({
    regime: 'TRENDING',
    freshnessStatus: 'fresh',
    observationAgeMs: 300_000,
    providerHealth: 'healthy',
    spreadBps: 15,
    relativeVolumeRatio: 2.0,
    rollingRangeHighMinor: rollingHigh,
    rollingRangeLowMinor: 63_500_00n,
    realizedVolatilityBps: 1_200,
    ...overrides,
  });
}

export function validEthBreakoutMarket(overrides?: Partial<CryptoMomentumMarketState>): CryptoMomentumMarketState {
  const rollingHigh = 3_400_00n;
  return Object.freeze({
    regime: 'TRENDING',
    freshnessStatus: 'fresh',
    observationAgeMs: 300_000,
    providerHealth: 'healthy',
    spreadBps: 18,
    relativeVolumeRatio: 1.8,
    rollingRangeHighMinor: rollingHigh,
    rollingRangeLowMinor: 3_250_00n,
    realizedVolatilityBps: 1_500,
    ...overrides,
  });
}

export function validBreakoutControls(
  rollingHighMinor: bigint,
  overrides?: Partial<CryptoMomentumBreakoutControls>,
): CryptoMomentumBreakoutControls {
  return Object.freeze({
    persistenceBarsConfirmed: 1,
    minimumCloseBeyondBreakoutMinor: applyBuffer(rollingHighMinor, DEFAULT_M10_BREAKOUT_BUFFER_BPS),
    ...overrides,
  });
}

export function flatPosition(): CryptoMomentumPosition {
  return Object.freeze({
    hasOpenPosition: false,
    entryAt: null,
    entryPriceMinor: null,
    highWaterMarkMinor: null,
  });
}

export function openPosition(entryAt: UtcInstant, entryPriceMinor: bigint): CryptoMomentumPosition {
  return Object.freeze({
    hasOpenPosition: true,
    entryAt,
    entryPriceMinor,
    highWaterMarkMinor: entryPriceMinor,
  });
}

export { VALID_GOVERNANCE };

export function cryptoMomentumEvaluationManifest(): EvaluationDatasetManifest {
  const start = instant('2026-09-01T00:00:00.000Z');
  const observations = [];
  let seq = 0;

  for (let hour = 0; hour < 48; hour += 1) {
    const at = instant(`2026-09-${hour < 24 ? '01' : '02'}T${String(hour % 24).padStart(2, '0')}:00:00.000Z`);
    const btcClose = 64_000_00n + BigInt(hour) * 50n;
    const ethClose = 3_300_00n + BigInt(hour) * 5n;
    observations.push(
      cryptoBarToChronologicalObservation({
        observationId: `obs_btc_${String(hour)}`,
        instrumentId: CRYPTO_BTC_USD_ASSET_ID,
        periodStart: at,
        knowableAt: at,
        providerId: 'coingecko_fixture',
        providerSequence: seq++,
        openMinor: btcClose - 20n,
        highMinor: btcClose + 80n,
        lowMinor: btcClose - 100n,
        closeMinor: btcClose,
        bidMinor: btcClose - 5n,
        askMinor: btcClose + 5n,
      }),
      cryptoBarToChronologicalObservation({
        observationId: `obs_eth_${String(hour)}`,
        instrumentId: CRYPTO_ETH_USD_ASSET_ID,
        periodStart: at,
        knowableAt: at,
        providerId: 'coingecko_fixture',
        providerSequence: seq++,
        openMinor: ethClose - 2n,
        highMinor: ethClose + 8n,
        lowMinor: ethClose - 10n,
        closeMinor: ethClose,
        bidMinor: ethClose - 1n,
        askMinor: ethClose + 1n,
      }),
    );
  }

  const frozen = freezeEvaluationDatasetManifest({
    version: asMarketDatasetVersion('edmf-m10-crypto-momentum-v1'),
    instruments: Object.freeze([...HELIOS_CRYPTO_USD_INSTRUMENTS]),
    membership: Object.freeze([
      { instrumentId: CRYPTO_BTC_USD_ASSET_ID, enteredAt: start, leftAt: null },
      { instrumentId: CRYPTO_ETH_USD_ASSET_ID, enteredAt: start, leftAt: null },
    ]),
    timeRange: { start, end: instant('2026-09-02T23:00:00.000Z') },
    providerIds: Object.freeze(['coingecko_fixture']),
    datasetIds: Object.freeze(['m06_crypto_reference_fixture']),
    corporateActionHandling: 'INVESTMENTS_SPLIT_DIVIDEND_SEMANTICS',
    corporateActionVersion: null,
    degradedPeriods: Object.freeze([
      { start: instant('2026-09-01T18:00:00.000Z'), end: instant('2026-09-01T18:00:00.000Z'), reason: 'provider degraded' },
    ]),
    feedEntitlement: 'SYNTHETIC_FIXTURE',
    gapsExplicit: Object.freeze([]),
    limitations: Object.freeze([
      'M10 crypto momentum fixture built from M06 production-shaped reference schema.',
      'Forward-paper / research only — not live crypto execution.',
    ]),
    observations: Object.freeze(observations),
    corporateActions: Object.freeze([]),
  });
  if (!frozen.ok) {
    throw new Error(frozen.error.message);
  }
  return frozen.value;
}

export function computeRollingRangeHighPriorBars(closes: readonly bigint[]): bigint {
  if (closes.length === 0) {
    return 0n;
  }
  return closes.reduce((max, value) => (value > max ? value : max), closes[0]!);
}

export const M10_FIXTURE_DEFAULTS = DEFAULT_M10_CONFIG;
