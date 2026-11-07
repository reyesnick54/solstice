/**
 * Comparable-set filters for decentralized macro reference consolidation.
 */

import {
  FX_CONSOLIDATION_LANES,
  type CommodityReferenceKind,
  type FxQuoteKind,
  type Md10MacroDomain,
  type RateObservationKind,
} from './taxonomy.ts';
import type { MacroCommodityObservation, MacroFxObservation, MacroMarketObservation, MacroRateObservation } from './types.ts';

export type FxCompatibilityKey = {
  readonly baseCurrency: string;
  readonly quoteCurrency: string;
  readonly tenor: string;
  readonly consolidationLane: (typeof FX_CONSOLIDATION_LANES)[FxQuoteKind];
};

export type RateCompatibilityKey = {
  readonly kind: RateObservationKind;
  readonly currency: string;
  readonly jurisdiction: string;
  readonly tenorLabel: string;
};

export type CommodityCompatibilityKey = {
  readonly kind: CommodityReferenceKind;
  readonly commodityCode: string;
  readonly currency: string;
  readonly contractMonth: string | null;
};

export function fxConsolidationLane(kind: FxQuoteKind): (typeof FX_CONSOLIDATION_LANES)[FxQuoteKind] {
  return FX_CONSOLIDATION_LANES[kind];
}

export function fxCompatibilityKey(observation: MacroFxObservation): FxCompatibilityKey {
  return Object.freeze({
    baseCurrency: observation.baseCurrency,
    quoteCurrency: observation.quoteCurrency,
    tenor: observation.tenor,
    consolidationLane: fxConsolidationLane(observation.kind),
  });
}

export function rateCompatibilityKey(observation: MacroRateObservation): RateCompatibilityKey {
  return Object.freeze({
    kind: observation.kind,
    currency: observation.currency,
    jurisdiction: observation.jurisdiction,
    tenorLabel: observation.tenorLabel,
  });
}

export function commodityCompatibilityKey(observation: MacroCommodityObservation): CommodityCompatibilityKey {
  return Object.freeze({
    kind: observation.kind,
    commodityCode: observation.commodityCode,
    currency: observation.currency,
    contractMonth: observation.contractMonth,
  });
}

export function sameFxCompatibility(a: MacroFxObservation, b: MacroFxObservation): boolean {
  const left = fxCompatibilityKey(a);
  const right = fxCompatibilityKey(b);
  return (
    left.baseCurrency === right.baseCurrency &&
    left.quoteCurrency === right.quoteCurrency &&
    left.tenor === right.tenor &&
    left.consolidationLane === right.consolidationLane
  );
}

export function sameRateCompatibility(a: MacroRateObservation, b: MacroRateObservation): boolean {
  const left = rateCompatibilityKey(a);
  const right = rateCompatibilityKey(b);
  return (
    left.kind === right.kind &&
    left.currency === right.currency &&
    left.jurisdiction === right.jurisdiction &&
    left.tenorLabel === right.tenorLabel
  );
}

export function sameCommodityCompatibility(a: MacroCommodityObservation, b: MacroCommodityObservation): boolean {
  const left = commodityCompatibilityKey(a);
  const right = commodityCompatibilityKey(b);
  return (
    left.kind === right.kind &&
    left.commodityCode === right.commodityCode &&
    left.currency === right.currency &&
    left.contractMonth === right.contractMonth
  );
}

export function filterCompatibleFx(
  seed: MacroFxObservation,
  observations: readonly MacroFxObservation[],
): readonly MacroFxObservation[] {
  return Object.freeze(observations.filter((row) => sameFxCompatibility(seed, row)));
}

export function filterCompatibleRates(
  seed: MacroRateObservation,
  observations: readonly MacroRateObservation[],
): readonly MacroRateObservation[] {
  return Object.freeze(observations.filter((row) => sameRateCompatibility(seed, row)));
}

export function filterCompatibleCommodity(
  seed: MacroCommodityObservation,
  observations: readonly MacroCommodityObservation[],
): readonly MacroCommodityObservation[] {
  return Object.freeze(observations.filter((row) => sameCommodityCompatibility(seed, row)));
}

export function assertLicensedSwapRate(observation: MacroRateObservation): boolean {
  if (observation.kind !== 'swap_reference_rate') {
    return true;
  }
  return observation.licensedSwapReference;
}

/** Futures vs spot/physical benchmarks require an explicit basis link. */
export function requiresCommodityBasisLink(
  leftKind: CommodityReferenceKind,
  rightKind: CommodityReferenceKind,
): boolean {
  if (leftKind === rightKind) {
    return false;
  }
  const kinds = new Set([leftKind, rightKind]);
  if (!kinds.has('futures')) {
    return false;
  }
  return kinds.has('physical_benchmark') || kinds.has('spot_reference');
}

export function observationsShareDomain(
  observations: readonly MacroMarketObservation[],
): Md10MacroDomain | null {
  if (observations.length === 0) {
    return null;
  }
  const domain = observations[0]!.domain;
  return observations.every((row) => row.domain === domain) ? domain : null;
}
