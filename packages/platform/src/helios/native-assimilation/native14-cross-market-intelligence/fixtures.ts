import { asCustomerId, asUtcInstant } from '@solstice/domain';
import { workOrderIdFor } from '../../ids.ts';
import { M02_REFERENCE_INSTRUMENT_IDS } from '../../market-observation/instrument-registry.ts';
import type { CrossMarketSignalObservation } from './types.ts';

export const NATIVE14_FIXTURE_NOW = asUtcInstant('2026-11-03T09:30:00.000Z');
export const NATIVE14_CUSTOMER_ID = asCustomerId('cust_native14_cm');
export const NATIVE14_WORK_ORDER_ID = workOrderIdFor('cust_native14_cm', 'native14');
export const NATIVE14_SUBJECT_ID = 'subject_native14';

const QQQ = 'SECURITY:US:QQQ:XNAS';
const UST10Y = 'MACRO:US:UST10Y';
const DXY = 'FX:GLOBAL:DXY';
const FED_CUT_MARKET = 'PREDICTION:US:FED_CUT_DEC2026:YES';

/** Fed prediction market + rates + USD + QQQ vol — macro research trigger. */
export function native14MacroDislocationObservations(): readonly CrossMarketSignalObservation[] {
  const t = NATIVE14_FIXTURE_NOW;
  const know = asUtcInstant('2026-11-03T09:29:55.000Z');
  return Object.freeze([
    Object.freeze({
      observationId: 'obs_fed_pm',
      domain: 'PREDICTION_MARKET',
      entityId: FED_CUT_MARKET,
      entityLabel: 'Fed cut Dec 2026 — Yes',
      metricId: 'implied_probability_change',
      moveBps: 320,
      impliedProbabilityPpm: 620_000n,
      volumeAccelerationScore: 1.4,
      evidenceRef: 'ev_native14_fed_pm_sharp',
      observedAt: t,
      knowableAt: know,
    }),
    Object.freeze({
      observationId: 'obs_ust10y',
      domain: 'MACRO',
      entityId: UST10Y,
      entityLabel: 'US 10Y Treasury yield',
      metricId: 'yield_change_bps',
      moveBps: -18,
      impliedProbabilityPpm: null,
      volumeAccelerationScore: null,
      evidenceRef: 'ev_native14_ust10y_move',
      observedAt: t,
      knowableAt: know,
    }),
    Object.freeze({
      observationId: 'obs_dxy',
      domain: 'FX',
      entityId: DXY,
      entityLabel: 'US Dollar Index',
      metricId: 'return_bps',
      moveBps: -45,
      impliedProbabilityPpm: null,
      volumeAccelerationScore: null,
      evidenceRef: 'ev_native14_dxy_move',
      observedAt: t,
      knowableAt: know,
    }),
    Object.freeze({
      observationId: 'obs_qqq_vol',
      domain: 'ETF',
      entityId: QQQ,
      entityLabel: 'Invesco QQQ',
      metricId: 'realized_vol_change_bps',
      moveBps: 85,
      impliedProbabilityPpm: null,
      volumeAccelerationScore: 1.2,
      evidenceRef: 'ev_native14_qqq_vol',
      observedAt: t,
      knowableAt: know,
    }),
  ]);
}

const BTC_SIM = M02_REFERENCE_INSTRUMENT_IDS.BTC;
const BTC_VENUE_A = `${BTC_SIM}:VENUE_A`;
const BTC_VENUE_B = `${BTC_SIM}:VENUE_B`;
const BTC_SETTLE_PM = 'PREDICTION:CRYPTO:BTC_100K_2026:YES';

/** BTC venue divergence + prediction market + funding + volume — crypto research trigger. */
export function native14CryptoDislocationObservations(): readonly CrossMarketSignalObservation[] {
  const t = NATIVE14_FIXTURE_NOW;
  const know = asUtcInstant('2026-11-03T09:29:50.000Z');
  return Object.freeze([
    Object.freeze({
      observationId: 'obs_btc_a',
      domain: 'CRYPTO',
      entityId: BTC_VENUE_A,
      entityLabel: 'BTC USD venue A',
      metricId: 'venue_divergence',
      moveBps: 55,
      impliedProbabilityPpm: null,
      volumeAccelerationScore: 1.8,
      evidenceRef: 'ev_native14_btc_venue_a',
      observedAt: t,
      knowableAt: know,
    }),
    Object.freeze({
      observationId: 'obs_btc_b',
      domain: 'CRYPTO',
      entityId: BTC_VENUE_B,
      entityLabel: 'BTC USD venue B',
      metricId: 'venue_divergence',
      moveBps: -48,
      impliedProbabilityPpm: null,
      volumeAccelerationScore: 1.8,
      evidenceRef: 'ev_native14_btc_venue_b',
      observedAt: t,
      knowableAt: know,
    }),
    Object.freeze({
      observationId: 'obs_btc_pm',
      domain: 'PREDICTION_MARKET',
      entityId: BTC_SETTLE_PM,
      entityLabel: 'BTC 100k 2026 — Yes',
      metricId: 'settlement_probability_divergence',
      moveBps: 90,
      impliedProbabilityPpm: 540_000n,
      volumeAccelerationScore: 1.5,
      evidenceRef: 'ev_native14_btc_pm_div',
      observedAt: t,
      knowableAt: know,
    }),
    Object.freeze({
      observationId: 'obs_btc_funding',
      domain: 'CRYPTO',
      entityId: BTC_SIM,
      entityLabel: 'BTC perpetual funding',
      metricId: 'funding_rate_change_bps',
      moveBps: 62,
      impliedProbabilityPpm: 510_000n,
      volumeAccelerationScore: null,
      evidenceRef: 'ev_native14_btc_funding',
      observedAt: t,
      knowableAt: know,
    }),
    Object.freeze({
      observationId: 'obs_btc_vol',
      domain: 'CRYPTO',
      entityId: BTC_SIM,
      entityLabel: 'BTC aggregate volume',
      metricId: 'volume_acceleration',
      moveBps: 70,
      impliedProbabilityPpm: null,
      volumeAccelerationScore: 2.1,
      evidenceRef: 'ev_native14_btc_volume',
      observedAt: t,
      knowableAt: know,
    }),
  ]);
}

/** Correlation-only pair — should not produce trade-eligible execution paths. */
export function native14WeakCorrelationOnlyObservations(): readonly CrossMarketSignalObservation[] {
  const t = NATIVE14_FIXTURE_NOW;
  const know = asUtcInstant('2026-11-03T09:28:00.000Z');
  return Object.freeze([
    Object.freeze({
      observationId: 'obs_spy_small',
      domain: 'ETF',
      entityId: M02_REFERENCE_INSTRUMENT_IDS.SPY,
      entityLabel: 'SPY',
      metricId: 'return_bps',
      moveBps: 8,
      impliedProbabilityPpm: null,
      volumeAccelerationScore: null,
      evidenceRef: 'ev_native14_spy_small',
      observedAt: t,
      knowableAt: know,
    }),
    Object.freeze({
      observationId: 'obs_gold_small',
      domain: 'COMMODITIES',
      entityId: M02_REFERENCE_INSTRUMENT_IDS.GOLD,
      entityLabel: 'Gold',
      metricId: 'return_bps',
      moveBps: 6,
      impliedProbabilityPpm: null,
      volumeAccelerationScore: null,
      evidenceRef: 'ev_native14_gold_small',
      observedAt: t,
      knowableAt: know,
    }),
  ]);
}
