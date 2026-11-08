/**
 * HELIOS FORWARD ALPHA — ALPHA10 scope axes and campaign declarations.
 *
 * Regime vocabulary is shared with EVOL10 (point-in-time labels only).
 */

import {
  HELIOS_EVOL10_REGIME_DIMENSIONS,
  HELIOS_EVOL10_STRESS_REGIME_DIMENSIONS,
  type HeliosEvol10RegimeDimension,
  type HeliosEvol10MacroObservation,
  mapM13DimensionsToEvol10,
  mapMacroObservationToEvol10,
  mergeEvol10Tags,
} from '../evol10/taxonomy.ts';
import { labelEvol10RegimeDimensions } from '../evol10/regime-generalization.ts';

export {
  HELIOS_EVOL10_REGIME_DIMENSIONS,
  HELIOS_EVOL10_STRESS_REGIME_DIMENSIONS,
  type HeliosEvol10RegimeDimension,
  type HeliosEvol10MacroObservation,
  labelEvol10RegimeDimensions,
  mapM13DimensionsToEvol10,
  mapMacroObservationToEvol10,
  mergeEvol10Tags,
};

/** Cross-section labels for forward performance slicing (caller-supplied, PIT only). */
export const HELIOS_ALPHA10_SCOPE_AXES = [
  'asset_class',
  'sector',
  'market',
  'venue',
  'geography',
] as const;

export type HeliosAlpha10ScopeAxis = (typeof HELIOS_ALPHA10_SCOPE_AXES)[number];

export type ForwardRegimeScopeSlice = {
  readonly assetClass: string | null;
  readonly sector: string | null;
  readonly market: string | null;
  readonly venue: string | null;
  readonly geography: string | null;
};

export const EMPTY_FORWARD_REGIME_SCOPE: ForwardRegimeScopeSlice = Object.freeze({
  assetClass: null,
  sector: null,
  market: null,
  venue: null,
  geography: null,
});

/**
 * Immutable declaration sealed before forward campaign start.
 * Used to distinguish pre-declared regime specialists from retrospective claims.
 */
export type Alpha10CampaignRegimeDeclaration = {
  readonly campaignId: string;
  readonly strategyId: string;
  readonly declaredAt: string;
  readonly regimeSpecialist: boolean;
  /** When specialist: regimes where the strategy is intended to operate. */
  readonly intendedRegimes: readonly HeliosEvol10RegimeDimension[];
  /** When generalist: full mandate the strategy must tolerate. */
  readonly mandateRegimes: readonly HeliosEvol10RegimeDimension[];
};

export function scopeSliceKey(scope: ForwardRegimeScopeSlice): string {
  return [
    scope.assetClass ?? '_',
    scope.sector ?? '_',
    scope.market ?? '_',
    scope.venue ?? '_',
    scope.geography ?? '_',
  ].join('|');
}
