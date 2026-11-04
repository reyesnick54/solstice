/**
 * Earnings event execution twin requirements — gaps, spread, liquidity, partial fills, open auction.
 */

import { BAR_EXECUTION_MODES, type BarExecutionMode } from '../execution-twin/simulation/taxonomy.ts';
import {
  EARN11_EVENT_EXECUTION_PROFILE_ID,
  EARN11_EVENT_EXECUTION_PROFILE_SCHEMA,
} from './taxonomy.ts';

export type EarningsEventExecutionSimulationProfile = {
  readonly schema: typeof EARN11_EVENT_EXECUTION_PROFILE_SCHEMA;
  readonly profileId: typeof EARN11_EVENT_EXECUTION_PROFILE_ID;
  readonly overnightGapModeled: true;
  readonly spreadWideningModeled: true;
  readonly liquidityReductionModeled: true;
  readonly slippageModeled: true;
  readonly partialFillsModeled: true;
  readonly marketOpenAuctionApproximation: true;
  readonly barExecutionMode: Exclude<BarExecutionMode, 'CLOSE_ONLY'>;
  readonly forbidCloseToCloseOnlyPromotion: true;
  readonly grantsExecutionAuthority: false;
};

export const DEFAULT_EARN11_EVENT_EXECUTION_PROFILE: EarningsEventExecutionSimulationProfile = Object.freeze({
  schema: EARN11_EVENT_EXECUTION_PROFILE_SCHEMA,
  profileId: EARN11_EVENT_EXECUTION_PROFILE_ID,
  overnightGapModeled: true,
  spreadWideningModeled: true,
  liquidityReductionModeled: true,
  slippageModeled: true,
  partialFillsModeled: true,
  marketOpenAuctionApproximation: true,
  barExecutionMode: 'DETERMINISTIC_OHLC_PATH',
  forbidCloseToCloseOnlyPromotion: true,
  grantsExecutionAuthority: false,
});

export type EarningsEventExecutionProfileGateResult = {
  readonly acceptable: boolean;
  readonly blockers: readonly string[];
};

export function gateEarningsEventExecutionProfile(
  input: Partial<EarningsEventExecutionSimulationProfile> & { readonly barExecutionMode?: BarExecutionMode },
): EarningsEventExecutionProfileGateResult {
  const blockers: string[] = [];
  if (input.profileId !== EARN11_EVENT_EXECUTION_PROFILE_ID) {
    blockers.push('unknown_event_execution_profile');
  }
  const barExecutionMode = input.barExecutionMode as BarExecutionMode | undefined;
  if (barExecutionMode === 'CLOSE_ONLY') {
    blockers.push('close_to_close_only_fills_forbidden_for_earnings_promotion');
  }
  if (!BAR_EXECUTION_MODES.includes(barExecutionMode ?? 'DETERMINISTIC_OHLC_PATH')) {
    blockers.push('bar_execution_mode_unspecified');
  }
  if (input.overnightGapModeled !== true) blockers.push('overnight_gap_not_modeled');
  if (input.spreadWideningModeled !== true) blockers.push('spread_widening_not_modeled');
  if (input.liquidityReductionModeled !== true) blockers.push('liquidity_reduction_not_modeled');
  if (input.slippageModeled !== true) blockers.push('slippage_not_modeled');
  if (input.partialFillsModeled !== true) blockers.push('partial_fills_not_modeled');
  if (input.marketOpenAuctionApproximation !== true) {
    blockers.push('market_open_auction_not_approximated');
  }
  if (input.forbidCloseToCloseOnlyPromotion !== true) {
    blockers.push('close_to_close_promotion_not_blocked');
  }
  return Object.freeze({
    acceptable: blockers.length === 0,
    blockers: Object.freeze(blockers),
  });
}

export function earningsPromotionBlockedByBarMode(barExecutionMode: BarExecutionMode): boolean {
  return barExecutionMode === 'CLOSE_ONLY';
}
