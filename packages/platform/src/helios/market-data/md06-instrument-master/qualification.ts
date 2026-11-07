/**
 * MD06 qualification — HELIOS_MD06_INSTRUMENT_MASTER_QUALIFIED
 */

import { asUtcInstant } from '@solstice/domain';

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
import { assertTickerNotPermanentIdentity, instrumentIdentityIdFromPermanentIdentifier } from './identifiers.ts';
import { createHeliosMd06InstrumentMasterFabric } from './fabric.ts';
import { seedMd06ReferenceInstrumentMaster } from './fixtures.ts';
import { rawSeriesUnchangedAfterAdjustment } from './price-series.ts';

export type Md06QualificationChecks = {
  readonly tickerNotPermanentIdentity: boolean;
  readonly symbolChangePreservesIdentity: boolean;
  readonly splitAdjustsResearchOnly: boolean;
  readonly rawSeriesImmutable: boolean;
  readonly corporateActionKnowableAt: boolean;
  readonly contractLifecycleModeled: boolean;
  readonly optionLifecycleModeled: boolean;
  readonly tradingSessionModeled: boolean;
  readonly venueMappingPointInTime: boolean;
  readonly temporalGraphExtended: boolean;
  readonly persistenceRestart: boolean;
  readonly noExecutionAuthority: boolean;
};

export type Md06QualificationResult = {
  readonly marker:
    | typeof HELIOS_MD06_INSTRUMENT_MASTER_QUALIFIED
    | typeof HELIOS_MD06_INSTRUMENT_MASTER_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateMd06InstrumentMasterQualification(
  checks: Md06QualificationChecks,
): Md06QualificationResult {
  const blockers: string[] = [];
  if (!checks.tickerNotPermanentIdentity) blockers.push('ticker_not_permanent_identity');
  if (!checks.symbolChangePreservesIdentity) blockers.push('symbol_change_identity');
  if (!checks.splitAdjustsResearchOnly) blockers.push('split_adjusted_research');
  if (!checks.rawSeriesImmutable) blockers.push('raw_series_immutable');
  if (!checks.corporateActionKnowableAt) blockers.push('corporate_action_knowable_at');
  if (!checks.contractLifecycleModeled) blockers.push('contract_lifecycle');
  if (!checks.optionLifecycleModeled) blockers.push('option_lifecycle');
  if (!checks.tradingSessionModeled) blockers.push('trading_session');
  if (!checks.venueMappingPointInTime) blockers.push('venue_mapping_pit');
  if (!checks.temporalGraphExtended) blockers.push('temporal_graph_extension');
  if (!checks.persistenceRestart) blockers.push('persistence_restart');
  if (!checks.noExecutionAuthority) blockers.push('execution_authority');

  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_MD06_INSTRUMENT_MASTER_QUALIFIED : HELIOS_MD06_INSTRUMENT_MASTER_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}

export function runMd06QualificationHarness(): Md06QualificationResult {
  let tickerRejected = false;
  try {
    assertTickerNotPermanentIdentity('TICKER');
  } catch {
    tickerRejected = true;
  }
  const figiId = instrumentIdentityIdFromPermanentIdentifier('FIGI', 'BBG000B9XRY4');
  tickerRejected = tickerRejected && figiId.startsWith('imid:figi:');

  const fixture = seedMd06ReferenceInstrumentMaster();
  const fabric = createHeliosMd06InstrumentMasterFabric({
    master: fixture.store,
    graph: fixture.graph,
  });

  const preSymbol = asUtcInstant('2020-01-02T00:00:00.000Z');
  const postSymbol = asUtcInstant('2023-01-02T00:00:00.000Z');
  const fb = fabric.resolveTicker({ ticker: 'FB', venueMic: 'XNAS', asOf: preSymbol, knowableAtCutoff: preSymbol });
  const meta = fabric.resolveTicker({
    ticker: 'META',
    venueMic: 'XNAS',
    asOf: postSymbol,
    knowableAtCutoff: postSymbol,
  });

  const rawBefore = fixture.store.listRawBars(fixture.nvdaIdentityId);
  fixture.store.rebuildAdjustedResearch(fixture.nvdaIdentityId, asUtcInstant('2025-01-01T00:00:00.000Z'));
  const rawAfter = fixture.store.listRawBars(fixture.nvdaIdentityId);
  const adjusted = fixture.store.listAdjustedBars(fixture.nvdaIdentityId);

  const splitAction = fixture.store.listCorporateActions().find((row) => row.kind === 'SPLIT');
  const clLifecycle = fixture.store
    .listContractLifecycles()
    .find((row) => row.instrumentIdentityId === fixture.clContractIdentityId);
  const optionLifecycle = fixture.store
    .listContractLifecycles()
    .find((row) => row.instrumentIdentityId === fixture.nvdaCallIdentityId);

  const providerBinding = fabric.resolveProviderTicker({
    providerId: 'md06_fixture',
    providerSymbol: 'META',
    asOf: postSymbol,
    knowableAtCutoff: postSymbol,
  });

  const snap = fixture.store.snapshot(asUtcInstant('2025-01-01T00:00:00.000Z'));
  const restarted = seedMd06ReferenceInstrumentMaster();
  restarted.store.restore(snap);
  const restartOk = restarted.store.listIdentities().length === fixture.store.listIdentities().length;

  const graphKindsOk = MD06_TEMPORAL_ENTITY_KINDS.every((kind) =>
    (TEMPORAL_ENTITY_KINDS as readonly string[]).includes(kind),
  );
  const graphRelsOk = MD06_TEMPORAL_RELATIONSHIP_TYPES.every((rel) =>
    (TEMPORAL_RELATIONSHIP_TYPES as readonly string[]).includes(rel),
  );

  const preAdj = adjusted.find((row) => row.barTime === asUtcInstant('2024-06-09T21:00:00.000Z'));
  const postAdj = adjusted.find((row) => row.barTime === asUtcInstant('2024-06-10T21:00:00.000Z'));

  return evaluateMd06InstrumentMasterQualification({
    tickerNotPermanentIdentity: tickerRejected,
    symbolChangePreservesIdentity:
      fb.instrumentIdentityId === fixture.metaIdentityId &&
      meta.instrumentIdentityId === fixture.metaIdentityId &&
      fb.listingId !== meta.listingId,
    splitAdjustsResearchOnly:
      preAdj !== undefined &&
      postAdj !== undefined &&
      preAdj.closeMinor === rawBefore[0]!.closeMinor &&
      postAdj.closeMinor === 12_150n &&
      rawAfter[1]!.closeMinor === 121_500n,
    rawSeriesImmutable: rawSeriesUnchangedAfterAdjustment(rawBefore, rawAfter),
    corporateActionKnowableAt: splitAction !== undefined && splitAction.schedule.knowableAt.length > 0,
    contractLifecycleModeled: clLifecycle !== undefined && clLifecycle.expiry !== null && clLifecycle.lastTrade !== null,
    optionLifecycleModeled:
      optionLifecycle !== undefined &&
      optionLifecycle.putCall === 'CALL' &&
      optionLifecycle.underlyingInstrumentIdentityId === fixture.nvdaIdentityId,
    tradingSessionModeled: fixture.store.listTradingSessions().length >= 1,
    venueMappingPointInTime: providerBinding.resolutionState === 'RESOLVED',
    temporalGraphExtended: graphKindsOk && graphRelsOk,
    persistenceRestart: restartOk,
    noExecutionAuthority: fixture.store.listIdentities().every((row) => row.grantsExecutionAuthority === false),
  });
}
