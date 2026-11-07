import { asUtcInstant } from '@solstice/domain';

import { createTemporalEntityGraphStore } from '../../feature-fabric/entity-resolution/graph-store.ts';
import {
  MD06_TEMPORAL_ENTITY_KINDS,
  MD06_TEMPORAL_RELATIONSHIP_TYPES,
  HELIOS_MD06_INSTRUMENT_MASTER_BLOCKED,
  HELIOS_MD06_INSTRUMENT_MASTER_QUALIFIED,
} from './taxonomy.ts';
import {
  TEMPORAL_ENTITY_KINDS,
  TEMPORAL_RELATIONSHIP_TYPES,
} from '../../feature-fabric/entity-resolution/types.ts';
import { createInstrumentMasterFabric } from './fabric.ts';
import {
  assertTickerIsNotPermanentIdentity,
  identifiersSufficientForPermanentIdentity,
  instrumentIdentityIdFor,
} from './ids.ts';
import { md06ReferenceSeedBundle, MD06_FIXTURE_META_IDENTITY, MD06_FIXTURE_NVDA_IDENTITY } from './fixtures.ts';
import { rawSeriesDigest } from './price-series.ts';

export { HELIOS_MD06_INSTRUMENT_MASTER_QUALIFIED, HELIOS_MD06_INSTRUMENT_MASTER_BLOCKED };

export type Md06InstrumentMasterQualificationChecks = {
  readonly temporalGraphKindsExtended: boolean;
  readonly temporalGraphRelationsExtended: boolean;
  readonly tickerNotPermanentIdentity: boolean;
  readonly symbolChangePreservesIdentity: boolean;
  readonly venueMappingPointInTime: boolean;
  readonly corporateActionKnowableAt: boolean;
  readonly rawSeriesImmutable: boolean;
  readonly adjustedSeriesSeparate: boolean;
  readonly contractLifecycleComplete: boolean;
  readonly noExecutionAuthority: boolean;
};

export type Md06InstrumentMasterQualificationResult = {
  readonly marker:
    | typeof HELIOS_MD06_INSTRUMENT_MASTER_QUALIFIED
    | typeof HELIOS_MD06_INSTRUMENT_MASTER_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function runMd06SelfChecks(): Md06InstrumentMasterQualificationChecks {
  const graph = createTemporalEntityGraphStore();
  const fabric = createInstrumentMasterFabric({ graph, seed: md06ReferenceSeedBundle() });
  const store = fabric.store;

  const earlyFb = store.resolveListingAt({
    ticker: 'FB',
    mic: 'XNAS',
    asOf: asUtcInstant('2020-01-01T00:00:00.000Z'),
    knowableAtCutoff: asUtcInstant('2020-01-02T00:00:00.000Z'),
  });
  const lateMeta = store.resolveListingAt({
    ticker: 'META',
    mic: 'XNAS',
    asOf: asUtcInstant('2023-01-01T00:00:00.000Z'),
    knowableAtCutoff: asUtcInstant('2023-01-02T00:00:00.000Z'),
  });

  const rawBefore = rawSeriesDigest(store.listRawPrices(MD06_FIXTURE_NVDA_IDENTITY));
  const adjusted = fabric.adjustedResearchSeries(
    MD06_FIXTURE_NVDA_IDENTITY,
    asUtcInstant('2024-06-15T00:00:00.000Z'),
  );
  store.appendRawPrice({
    observationId: 'raw:nvda:should-not-rewrite',
    instrumentIdentityId: MD06_FIXTURE_NVDA_IDENTITY,
    seriesKind: 'RAW',
    eventTime: asUtcInstant('2024-06-11T00:00:00.000Z'),
    knowableAt: asUtcInstant('2024-06-11T01:00:00.000Z'),
    closeMinor: 12_500n,
    volume: 1n,
    immutable: true,
  });
  const rawAfter = rawSeriesDigest(store.listRawPrices(MD06_FIXTURE_NVDA_IDENTITY));

  const venue = store.resolveVenueInstrument({
    mic: 'XNAS',
    exchangeNativeId: 'META',
    asOf: asUtcInstant('2023-06-01T00:00:00.000Z'),
    knowableAtCutoff: asUtcInstant('2023-06-02T00:00:00.000Z'),
  });

  const contract = store.snapshot().contractLifecycles[0];

  const split = store.listCorporateActions(MD06_FIXTURE_NVDA_IDENTITY).find((row) => row.kind === 'split');

  return Object.freeze({
    temporalGraphKindsExtended: MD06_TEMPORAL_ENTITY_KINDS.every((kind) =>
      (TEMPORAL_ENTITY_KINDS as readonly string[]).includes(kind),
    ),
    temporalGraphRelationsExtended: MD06_TEMPORAL_RELATIONSHIP_TYPES.every((rel) =>
      (TEMPORAL_RELATIONSHIP_TYPES as readonly string[]).includes(rel),
    ),
    tickerNotPermanentIdentity: assertTickerIsNotPermanentIdentity(MD06_FIXTURE_META_IDENTITY, 'META'),
    symbolChangePreservesIdentity:
      earlyFb.instrumentIdentityId === MD06_FIXTURE_META_IDENTITY &&
      lateMeta.instrumentIdentityId === MD06_FIXTURE_META_IDENTITY,
    venueMappingPointInTime:
      venue.resolutionState === 'RESOLVED' && venue.instrumentIdentityId === MD06_FIXTURE_META_IDENTITY,
    corporateActionKnowableAt:
      split !== undefined &&
      split.exDate !== null &&
      Date.parse(split.knowableAt) <= Date.parse(split.exDate),
    rawSeriesImmutable: rawBefore !== '' && rawBefore === rawAfter.split(';').slice(0, 2).join(';'),
    adjustedSeriesSeparate:
      adjusted.seriesKind === 'ADJUSTED_RESEARCH' &&
      adjusted.points.some((row) => row.closeMinor !== 12_000n),
    contractLifecycleComplete:
      contract !== undefined &&
      contract.expiry !== undefined &&
      contract.lastTrade !== null &&
      contract.multiplier > 0 &&
      contract.tickSize > 0,
    noExecutionAuthority:
      fabric.grantsExecutionAuthority === false &&
      store.snapshot().grantsExecutionAuthority === false &&
      graph.listNodes().every((node) => node.grantsExecutionAuthority === false),
  });
}

export function evaluateMd06InstrumentMasterQualification(
  checks: Md06InstrumentMasterQualificationChecks = runMd06SelfChecks(),
): Md06InstrumentMasterQualificationResult {
  const blockers = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([key]) => key);
  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_MD06_INSTRUMENT_MASTER_QUALIFIED : HELIOS_MD06_INSTRUMENT_MASTER_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}

/** Guard: permanent identity must not be derived from ticker alone. */
export function rejectTickerOnlyIdentity(ticker: string): string | null {
  const onlyTicker = Object.freeze([{ system: 'ticker', value: ticker }]);
  if (!identifiersSufficientForPermanentIdentity(onlyTicker)) {
    return null;
  }
  return instrumentIdentityIdFor(`ticker:${ticker}`);
}
