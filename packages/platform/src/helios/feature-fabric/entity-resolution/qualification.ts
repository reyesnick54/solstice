export const HELIOS_AAF03_TEMPORAL_ENTITY_RESOLUTION_QUALIFIED =
  'HELIOS_AAF03_TEMPORAL_ENTITY_RESOLUTION_QUALIFIED' as const;

export const HELIOS_AAF03_TEMPORAL_ENTITY_RESOLUTION_BLOCKED =
  'HELIOS_AAF03_TEMPORAL_ENTITY_RESOLUTION_BLOCKED' as const;

export type TemporalEntityResolutionQualificationResult = {
  readonly marker:
    | typeof HELIOS_AAF03_TEMPORAL_ENTITY_RESOLUTION_QUALIFIED
    | typeof HELIOS_AAF03_TEMPORAL_ENTITY_RESOLUTION_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateTemporalEntityResolutionQualification(input: {
  readonly historicalTickerReuse: boolean;
  readonly mergerModeled: boolean;
  readonly spinOffModeled: boolean;
  readonly dualListingModeled: boolean;
  readonly shareClassesModeled: boolean;
  readonly brandParentModeled: boolean;
  readonly delistedSecurityModeled: boolean;
  readonly ambiguousProviderSymbolDetected: boolean;
  readonly futuresContinuousDistinction: boolean;
  readonly cryptoVenuePairDistinction: boolean;
  readonly persistenceRestart: boolean;
  readonly pointInTimeResolution: boolean;
  readonly noSilentAmbiguity: boolean;
  readonly canonicalOwnersDocumented: boolean;
}): TemporalEntityResolutionQualificationResult {
  const blockers: string[] = [];
  if (!input.historicalTickerReuse) blockers.push('historical_ticker_reuse');
  if (!input.mergerModeled) blockers.push('merger');
  if (!input.spinOffModeled) blockers.push('spin_off');
  if (!input.dualListingModeled) blockers.push('dual_listing');
  if (!input.shareClassesModeled) blockers.push('share_classes');
  if (!input.brandParentModeled) blockers.push('brand_parent');
  if (!input.delistedSecurityModeled) blockers.push('delisted_security');
  if (!input.ambiguousProviderSymbolDetected) blockers.push('ambiguous_provider_symbol');
  if (!input.futuresContinuousDistinction) blockers.push('futures_continuous_series');
  if (!input.cryptoVenuePairDistinction) blockers.push('crypto_venue_pair');
  if (!input.persistenceRestart) blockers.push('persistence_restart');
  if (!input.pointInTimeResolution) blockers.push('point_in_time_resolution');
  if (!input.noSilentAmbiguity) blockers.push('no_silent_ambiguity');
  if (!input.canonicalOwnersDocumented) blockers.push('canonical_owners_documented');

  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified
      ? HELIOS_AAF03_TEMPORAL_ENTITY_RESOLUTION_QUALIFIED
      : HELIOS_AAF03_TEMPORAL_ENTITY_RESOLUTION_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}
