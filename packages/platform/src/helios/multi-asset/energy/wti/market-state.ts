/**
 * M08 — aggregated WTI MarketState composition.
 */

import type { UtcInstant } from '@solstice/domain';
import { evaluateRollState } from '../../futures/roll.ts';
import {
  WTI_COMMODITY_REFERENCE_ID,
  WTI_CONTINUOUS_SERIES,
  WTI_FUTURES_FAMILY,
  WTI_OIL_ETF_PROXY_ID,
  WTI_REGISTERED_CONTRACTS,
} from './identities.ts';
import { assess4hTrendReadiness } from './bars.ts';
import type { WtiMarketObservation, WtiMarketState } from './types.ts';
import type { MultiAssetRouteStatus } from '../../types.ts';

export type ComposeMarketStateInput = {
  readonly evaluatedAt: UtcInstant;
  readonly commodityReference: WtiMarketObservation | null;
  readonly oilEtfProxy: WtiMarketObservation | null;
  readonly frontContract: WtiMarketObservation | null;
  readonly continuousSeries: WtiMarketObservation | null;
  readonly routeStatus: MultiAssetRouteStatus;
};

export function composeWtiMarketState(input: ComposeMarketStateInput): WtiMarketState {
  const rollContext = evaluateRollState({
    familyId: WTI_FUTURES_FAMILY.familyId,
    contracts: WTI_REGISTERED_CONTRACTS,
    nowUtc: input.evaluatedAt,
  });

  const trendBars = input.continuousSeries?.bars ?? input.commodityReference?.bars ?? [];
  const trendReadiness4h = assess4hTrendReadiness(trendBars);

  return Object.freeze({
    evaluatedAt: input.evaluatedAt,
    commodityReference: input.commodityReference,
    oilEtfProxy: input.oilEtfProxy,
    futuresFamilyId: WTI_FUTURES_FAMILY.familyId,
    frontContract: input.frontContract,
    continuousSeries: input.continuousSeries,
    rollContext,
    routeStatus: input.routeStatus,
    trendReadiness4h,
  });
}

export function marketStateInstrumentIds(state: WtiMarketState): readonly string[] {
  const ids: string[] = [WTI_FUTURES_FAMILY.familyId];
  if (state.commodityReference) ids.push(WTI_COMMODITY_REFERENCE_ID);
  if (state.oilEtfProxy) ids.push(WTI_OIL_ETF_PROXY_ID);
  if (state.frontContract) ids.push(state.frontContract.instrumentId);
  if (state.continuousSeries) ids.push(WTI_CONTINUOUS_SERIES.continuousId);
  return Object.freeze(ids);
}
