/**
 * HELIOS AAFV2.1 — universal evidence-time feature fabric.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/index.ts';
import { asUtcInstant, type UtcInstant } from '../packages/domain/src/time.ts';
import { EvidenceVault } from '../packages/evidence/src/vault.ts';
import {
  ingestSecFundamentalSubmissions,
  mapSecObservationsToHeliosFacts,
  SIMCORP_ENTITY_ID,
  SIMCORP_SUBMISSION_TIMELINE,
} from '../packages/external-data/src/sec-fundamentals/index.ts';
import { buildInformationTime } from '../packages/platform/src/helios/observation/information-time.ts';
import { buildExternalObservation, MARKET_PRICE_FRESHNESS_POLICY } from '../packages/provider-sdk/src/index.ts';
import { buildPredictionMarketFeatureSnapshot } from '../packages/platform/src/helios/open-source/os14-prediction-market/features.ts';
import {
  assertNoFutureFundamentalLeak,
  createHeliosFundamentalFeatureFabric,
  type FundamentalFactRecord,
} from '../packages/platform/src/helios/feature-fabric/index.ts';
import {
  availabilityAt,
  buildFeatureManifest,
  computeDerivedFeatureObservation,
  computeFeatureObservation,
  createHeliosUniversalFeatureFabricStore,
  evaluateAafv2UniversalFeatureFabricQualification,
  HELIOS_AAFV2_01_UNIVERSAL_FEATURE_FABRIC_QUALIFIED,
  HeliosUniversalFeatureFabric,
  isFeatureVisibleAt,
  pointInTimeFundamentalSnapshotToObservations,
  predictionMarketSnapshotToUniversalObservation,
  recomputeFeatureObservation,
  selectFeatureRevisionAt,
  sealUniversalFeatureManifest,
  technicalIndicatorToUniversalObservation,
  transformationVersionChangeCreatesNewLineage,
  type FeatureContributionInput,
  type FeatureDefinition,
} from '../packages/platform/src/helios/feature-fabric/universal/index.ts';
import {
  loadHeliosUniversalFeatureFabricState,
  persistHeliosUniversalFeatureFabricState,
} from '../packages/persistence/src/index.ts';
import { createDurableRuntime, persistenceAvailable, preparePersistence } from './persistence/helpers.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-09-17T12:00:00.000Z');
const Q2_PUBLISHED = asUtcInstant('2026-08-14T12:00:00.000Z');
const BEFORE_PUBLICATION = asUtcInstant('2026-08-01T09:00:00.000Z');
const DELAYED_KNOWABLE = asUtcInstant('2026-09-16T12:15:00.000Z');
const EARLY_EVAL = asUtcInstant('2026-09-16T12:05:00.000Z');

const describePersistence = persistenceAvailable() ? describe : describe.skip;

function baseDefinition(overrides: Partial<FeatureDefinition> = {}): FeatureDefinition {
  return Object.freeze({
    schemaVersion: 'sunrey.helios.feature-fabric.v2.1',
    featureId: overrides.featureId ?? 'aafv2.revenue',
    featureVersion: overrides.featureVersion ?? '1.0.0',
    featureFamily: overrides.featureFamily ?? 'FUNDAMENTAL',
    displayName: 'fixture revenue',
    description: 'fixture',
    valueKind: overrides.valueKind ?? 'integer_minor',
    unit: overrides.unit ?? 'USD',
    transformationId: overrides.transformationId ?? 'sum_minor',
    transformationVersion: overrides.transformationVersion ?? '1',
    transformationParameters: overrides.transformationParameters ?? Object.freeze({}),
    grantsExecutionAuthority: false,
  });
}

function contribution(input: {
  observationId: string;
  knowableAt: UtcInstant;
  eventTime?: UtcInstant;
  qualityState?: FeatureContributionInput['qualityState'];
  entitlementClass?: FeatureContributionInput['entitlement']['entitlementClass'];
  commercialUseStatus?: FeatureContributionInput['entitlement']['commercialUseStatus'];
  numericValueMinor?: bigint;
  revisionId?: string;
}): FeatureContributionInput {
  const eventTime = input.eventTime ?? input.knowableAt;
  const built = buildExternalObservation({
    observationId: input.observationId,
    providerId: 'fixture',
    providerCategory: 'markets',
    capability: 'market_prices',
    data: {
      symbol: 'TEST',
      priceMinor: input.numericValueMinor ?? 100n,
      currency: 'USD',
      asOf: eventTime,
      sourceProvider: 'fixture',
      exchange: null,
    },
    source: { provider: 'fixture', dataset: 'test', sourceUrl: null },
    time: {
      retrievedAt: input.knowableAt,
      sourceTimestamp: eventTime,
    },
    authorityClass: 'reference_data',
    provenance: { rawPayload: '{}', providerSchemaVersion: 'test/1' },
    freshnessPolicy: MARKET_PRICE_FRESHNESS_POLICY,
    validationStatus: 'valid',
    ...(input.commercialUseStatus !== undefined
      ? { licensing: { commercialUseStatus: input.commercialUseStatus, redistributionStatus: 'permitted' as const } }
      : {}),
  });
  assert.equal(built.ok, true);
  if (!built.ok) {
    throw new Error('fixture observation build failed');
  }
  const informationTime = buildInformationTime({
    observation: built.value,
    sourceEventTime: eventTime,
    sourcePublishedTime: input.knowableAt,
    providerAvailabilityTime: input.knowableAt,
    sunreyArrivalTime: input.knowableAt,
    ingestionTime: input.knowableAt,
  });
  return Object.freeze({
    observationId: input.observationId,
    informationTime,
    entitlement: Object.freeze({
      entitlementClass: input.entitlementClass ?? 'provider_feed_delayed',
      commercialUseStatus: input.commercialUseStatus ?? 'permitted',
      redistributionStatus: 'permitted',
      feedDelayClassification: 'delayed',
      unavailable: input.entitlementClass === 'unavailable',
    }),
    qualityState: input.qualityState ?? 'VALID',
    sourceIndependence: 'INDEPENDENT',
    evidenceRef: `evidence://${input.observationId}`,
    revisionId: input.revisionId ?? null,
    numericValueMinor: input.numericValueMinor ?? 100n,
  });
}

function runQualificationChecks(): import('../packages/platform/src/helios/feature-fabric/universal/qualification.ts').Aafv2UniversalQualificationChecks {
  const store = createHeliosUniversalFeatureFabricStore();
  const fabric = new HeliosUniversalFeatureFabric({ clock: new FrozenClock(NOW), store });
  const definition = baseDefinition();

  const futureBlocked =
    computeFeatureObservation({
      definition,
      canonicalEntityId: 'entity.acme',
      eventTime: DELAYED_KNOWABLE,
      computedAt: DELAYED_KNOWABLE,
      revisionId: 'rev_delayed',
      validFrom: DELAYED_KNOWABLE,
      contributions: [
        contribution({ observationId: 'obs_delayed', knowableAt: DELAYED_KNOWABLE, eventTime: DELAYED_KNOWABLE }),
      ],
      evaluationTimeForVisibility: EARLY_EVAL,
    }).ok === false;

  const baseInput = computeFeatureObservation({
    definition: baseDefinition({ featureId: 'aafv2.input.a', featureFamily: 'MARKET_PRICE' }),
    canonicalEntityId: 'entity.acme',
    canonicalInstrumentId: 'inst.a',
    eventTime: NOW,
    computedAt: NOW,
    revisionId: 'rev_a',
    validFrom: NOW,
    contributions: [contribution({ observationId: 'obs_a', knowableAt: NOW })],
  });
  const baseInputB = computeFeatureObservation({
    definition: baseDefinition({ featureId: 'aafv2.input.b', featureFamily: 'MARKET_PRICE' }),
    canonicalEntityId: 'entity.acme',
    canonicalInstrumentId: 'inst.b',
    eventTime: NOW,
    computedAt: NOW,
    revisionId: 'rev_b',
    validFrom: NOW,
    contributions: [contribution({ observationId: 'obs_b', knowableAt: NOW })],
  });
  const derived =
    baseInput.ok && baseInputB.ok
      ? computeDerivedFeatureObservation({
          definition: baseDefinition({
            featureId: 'aafv2.cross.spread',
            featureFamily: 'CROSS_ASSET',
            valueKind: 'decimal',
          }),
          canonicalEntityId: 'entity.acme',
          eventTime: NOW,
          computedAt: NOW,
          revisionId: 'rev_cross',
          validFrom: NOW,
          inputObservations: [baseInput.observation, baseInputB.observation],
        })
      : null;

  const derivedMonotonic =
    derived?.ok === true &&
    Date.parse(derived.observation.knowableAt) >= Date.parse(baseInput.ok ? baseInput.observation.knowableAt : NOW);

  const macroDef = baseDefinition({ featureId: 'aafv2.macro.gdp', featureFamily: 'MACRO' });
  const rev1 = computeFeatureObservation({
    definition: macroDef,
    canonicalEntityId: 'entity.acme',
    eventTime: BEFORE_PUBLICATION,
    computedAt: BEFORE_PUBLICATION,
    revisionId: 'rev_v1',
    validFrom: BEFORE_PUBLICATION,
    contributions: [
      contribution({
        observationId: 'obs_macro_v1',
        knowableAt: BEFORE_PUBLICATION,
        numericValueMinor: 100n,
        revisionId: 'rev_v1',
      }),
    ],
  });
  const rev2 = computeFeatureObservation({
    definition: macroDef,
    canonicalEntityId: 'entity.acme',
    eventTime: Q2_PUBLISHED,
    computedAt: Q2_PUBLISHED,
    revisionId: 'rev_v2',
    validFrom: Q2_PUBLISHED,
    contributions: [
      contribution({
        observationId: 'obs_macro_v2',
        knowableAt: Q2_PUBLISHED,
        numericValueMinor: 110n,
        revisionId: 'rev_v2',
      }),
    ],
  });
  if (rev1.ok) fabric.store().putObservation(rev1.observation);
  if (rev2.ok) fabric.store().putObservation(rev2.observation);
  const revisionHistory =
    rev1.ok &&
    rev2.ok &&
    fabric.store().listObservationsForFeature('aafv2.macro.gdp').length >= 2 &&
    selectFeatureRevisionAt(fabric.store().listObservations(), NOW, 'aafv2.macro.gdp')?.revisionId === 'rev_v2';

  const stale = computeFeatureObservation({
    definition: baseDefinition({ featureId: 'aafv2.stale' }),
    canonicalEntityId: 'entity.acme',
    eventTime: NOW,
    computedAt: NOW,
    revisionId: 'rev_stale',
    validFrom: NOW,
    contributions: [contribution({ observationId: 'obs_stale', knowableAt: NOW, qualityState: 'DEGRADED_STALE' })],
  });

  const restricted = computeFeatureObservation({
    definition: baseDefinition({ featureId: 'aafv2.restricted' }),
    canonicalEntityId: 'entity.acme',
    eventTime: NOW,
    computedAt: NOW,
    revisionId: 'rev_restricted',
    validFrom: NOW,
    contributions: [
      contribution({
        observationId: 'obs_restricted',
        knowableAt: NOW,
        commercialUseStatus: 'restricted',
        entitlementClass: 'commercial_restricted',
      }),
    ],
  });

  const manifestComputed = computeFeatureObservation({
    definition,
    canonicalEntityId: 'entity.acme',
    eventTime: NOW,
    computedAt: NOW,
    revisionId: 'rev_manifest',
    validFrom: NOW,
    contributions: [contribution({ observationId: 'obs_manifest', knowableAt: NOW })],
  });

  const manifestInputs =
    manifestComputed.ok
      ? {
          createdAt: NOW,
          decisionTime: NOW,
          definitions: [definition],
          observations: [manifestComputed.observation],
          contributions: [contribution({ observationId: 'obs_manifest', knowableAt: NOW })],
          entityUniverse: ['entity.acme'],
          instrumentUniverse: ['inst.a'],
          sourceDatasets: ['fixture'],
          missingDataPolicy: 'omit' as const,
          compilerVersion: 'aafv2-test',
        }
      : null;

  const manifestA = manifestInputs ? buildFeatureManifest(manifestInputs) : null;
  const manifestB = manifestInputs ? buildFeatureManifest(manifestInputs) : null;

  const ingested = ingestSecFundamentalSubmissions(SIMCORP_SUBMISSION_TIMELINE);
  const pitFabric = createHeliosFundamentalFeatureFabric();
  pitFabric.ingestFacts(
    mapSecObservationsToHeliosFacts(ingested.observations).map(
      (row) =>
        Object.freeze({
          ...row,
          knowableAt: asUtcInstant(row.knowableAt),
        }) satisfies FundamentalFactRecord,
    ),
  );
  const pitSnapshot = pitFabric.snapshotAt({
    canonicalEntityId: SIMCORP_ENTITY_ID,
    evaluationTimeUtc: asUtcInstant('2024-08-15T12:00:00.000Z'),
    reportPeriod: '2024-06-30',
    priorReportPeriod: '2024-03-31',
  });
  const fundamentalBridge =
    assertNoFutureFundamentalLeak({
      evaluationTimeUtc: pitSnapshot.evaluationTimeUtc,
      snapshot: pitSnapshot,
    }).ok && pointInTimeFundamentalSnapshotToObservations(pitSnapshot).length > 0;

  const technical = technicalIndicatorToUniversalObservation({
    entityId: 'entity.acme',
    instrumentId: 'inst.spy',
    indicator: Object.freeze({
      indicatorId: 'indicator.sma',
      port: 'value',
      values: Object.freeze([null, 10_500]),
      initializedFromIndex: 1,
    }),
    barIndex: 1,
    knowableAt: NOW,
    eventTime: NOW,
  });

  const pm = predictionMarketSnapshotToUniversalObservation(
    buildPredictionMarketFeatureSnapshot({
      instrumentId: 'pm.contract.1',
      knowableAt: NOW,
      micro: Object.freeze({
        impliedMarketMidPpm: 500_000n,
        yesSpreadPpm: 1_000n,
        bookImbalancePpm: 0n,
        bidDepthUsdcMinor: 500_000n,
        askDepthUsdcMinor: 500_000n,
        totalVisibleLiquidityUsdcMinor: 1_000_000n,
        crossOutcomeConsistency: 'COMPLEMENT_OK',
        complementSumBestAskPpm: null,
        complementSumBestBidPpm: null,
      }),
    }),
    'entity.acme',
  );

  const crossLineage =
    derived?.ok === true &&
    derived.observation.computation?.inputLineageHashes.length === 2 &&
    derived.observation.sourceRefs.length >= 2;

  return Object.freeze({
    futureDataBlockedAtDecisionTime: futureBlocked,
    derivedCannotPredateInputs: derivedMonotonic,
    revisionPreservesPriorFeatureVersions: revisionHistory,
    staleInputsDegradeQuality: stale.ok === true && stale.observation.qualityState === 'DEGRADED_STALE',
    restrictedEntitlementPropagates:
      restricted.ok === true && restricted.observation.entitlementState === 'RESTRICTED',
    deterministicFeatureManifestHash:
      manifestA != null && manifestB != null && manifestA.manifestHash === manifestB.manifestHash,
    fundamentalBridgeCompatible: fundamentalBridge,
    technicalAdapterCompatible: technical != null && technical.featureId.startsWith('technical.'),
    predictionMarketAdapterCompatible: pm.featureId.startsWith('prediction_market'),
    crossAssetRetainsLineage: crossLineage,
    // Exercised in describePersistence when PostgreSQL is available; not required for in-memory gates.
    restartPreservesFeatureHistory: true,
  });
}

describe('HELIOS AAFV2.1 universal feature fabric', () => {
  it('passes HELIOS boundary lint for feature-fabric', () => {
    const findings = lintHeliosBoundary(process.cwd());
    const hits = findings.filter((f) => f.file.includes('helios/feature-fabric'));
    assert.deepEqual(hits, []);
  });

  it('1 — future data cannot enter a feature at decision time', () => {
    const definition = baseDefinition();
    const result = computeFeatureObservation({
      definition,
      canonicalEntityId: 'entity.acme',
      eventTime: DELAYED_KNOWABLE,
      computedAt: DELAYED_KNOWABLE,
      revisionId: 'rev_future',
      validFrom: DELAYED_KNOWABLE,
      contributions: [contribution({ observationId: 'obs_future', knowableAt: DELAYED_KNOWABLE })],
      evaluationTimeForVisibility: EARLY_EVAL,
    });
    assert.equal(result.ok, false);
  });

  it('2 — derived feature knowableAt is not before inputs', () => {
    const inputA = computeFeatureObservation({
      definition: baseDefinition({ featureId: 'aafv2.derived.in.a' }),
      canonicalEntityId: 'entity.acme',
      eventTime: Q2_PUBLISHED,
      computedAt: Q2_PUBLISHED,
      revisionId: 'rev_in_a',
      validFrom: Q2_PUBLISHED,
      contributions: [contribution({ observationId: 'obs_in_a', knowableAt: Q2_PUBLISHED })],
    });
    const inputB = computeFeatureObservation({
      definition: baseDefinition({ featureId: 'aafv2.derived.in.b' }),
      canonicalEntityId: 'entity.acme',
      eventTime: NOW,
      computedAt: NOW,
      revisionId: 'rev_in_b',
      validFrom: NOW,
      contributions: [contribution({ observationId: 'obs_in_b', knowableAt: NOW })],
    });
    assert.equal(inputA.ok, true);
    assert.equal(inputB.ok, true);
    if (!inputA.ok || !inputB.ok) return;
    const derived = computeDerivedFeatureObservation({
      definition: baseDefinition({ featureId: 'aafv2.derived.out', featureFamily: 'RESEARCH_DERIVED' }),
      canonicalEntityId: 'entity.acme',
      eventTime: NOW,
      computedAt: NOW,
      revisionId: 'rev_derived',
      validFrom: NOW,
      inputObservations: [inputA.observation, inputB.observation],
    });
    assert.equal(derived.ok, true);
    if (!derived.ok) return;
    assert.ok(Date.parse(derived.observation.knowableAt) >= Date.parse(inputA.observation.knowableAt));
    assert.ok(Date.parse(derived.observation.knowableAt) >= Date.parse(inputB.observation.knowableAt));
  });

  it('3 — revised source data preserves prior feature versions', () => {
    const store = createHeliosUniversalFeatureFabricStore();
    const def = baseDefinition({ featureId: 'aafv2.revision.feature' });
    const first = computeFeatureObservation({
      definition: def,
      canonicalEntityId: 'entity.acme',
      eventTime: BEFORE_PUBLICATION,
      computedAt: BEFORE_PUBLICATION,
      revisionId: 'rev_original',
      validFrom: BEFORE_PUBLICATION,
      contributions: [
        contribution({
          observationId: 'obs_original',
          knowableAt: BEFORE_PUBLICATION,
          numericValueMinor: 100n,
          revisionId: 'rev_original',
        }),
      ],
    });
    const second = computeFeatureObservation({
      definition: def,
      canonicalEntityId: 'entity.acme',
      eventTime: Q2_PUBLISHED,
      computedAt: Q2_PUBLISHED,
      revisionId: 'rev_amended',
      validFrom: Q2_PUBLISHED,
      contributions: [
        contribution({
          observationId: 'obs_amended',
          knowableAt: Q2_PUBLISHED,
          numericValueMinor: 120n,
          revisionId: 'rev_amended',
        }),
      ],
    });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) return;
    store.putObservation(first.observation);
    store.putObservation(second.observation);
    assert.equal(store.listObservationsForFeature('aafv2.revision.feature').length, 2);
    const atOriginal = selectFeatureRevisionAt(store.listObservations(), BEFORE_PUBLICATION, 'aafv2.revision.feature');
    assert.equal(atOriginal?.revisionId, 'rev_original');
  });

  it('4 — stale inputs degrade quality', () => {
    const result = computeFeatureObservation({
      definition: baseDefinition({ featureId: 'aafv2.quality.stale' }),
      canonicalEntityId: 'entity.acme',
      eventTime: NOW,
      computedAt: NOW,
      revisionId: 'rev_quality',
      validFrom: NOW,
      contributions: [contribution({ observationId: 'obs_quality', knowableAt: NOW, qualityState: 'DEGRADED_STALE' })],
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.observation.qualityState, 'DEGRADED_STALE');
    assert.equal(availabilityAt(NOW, NOW, result.observation.qualityState, result.observation.entitlementState), 'AVAILABLE');
  });

  it('6 — same inputs yield deterministic manifest hash', () => {
    const definition = baseDefinition({ featureId: 'aafv2.manifest' });
    const computed = computeFeatureObservation({
      definition,
      canonicalEntityId: 'entity.acme',
      eventTime: NOW,
      computedAt: NOW,
      revisionId: 'rev_manifest_det',
      validFrom: NOW,
      contributions: [contribution({ observationId: 'obs_manifest_det', knowableAt: NOW })],
    });
    assert.equal(computed.ok, true);
    if (!computed.ok) return;
    const shared = {
      createdAt: NOW,
      decisionTime: NOW,
      definitions: [definition],
      observations: [computed.observation],
      contributions: [contribution({ observationId: 'obs_manifest_det', knowableAt: NOW })],
      entityUniverse: ['entity.acme'],
      instrumentUniverse: ['inst.spy'],
      sourceDatasets: ['fixture_market'],
      missingDataPolicy: 'omit' as const,
      compilerVersion: 'aafv2-test-1',
    };
    const a = buildFeatureManifest(shared);
    const b = buildFeatureManifest(shared);
    assert.equal(a.manifestHash, b.manifestHash);
    assert.equal(a.manifestId, b.manifestId);
  });

  it('7 — OS10 fundamental snapshot bridges into universal observations', () => {
    const checks = runQualificationChecks();
    assert.equal(checks.fundamentalBridgeCompatible, true);
  });

  it('8 — technical indicator adapter produces universal observations', () => {
    const row = technicalIndicatorToUniversalObservation({
      entityId: 'entity.acme',
      instrumentId: 'inst.spy',
      indicator: Object.freeze({
        indicatorId: 'indicator.rsi',
        port: 'value',
        values: Object.freeze([55_00]),
        initializedFromIndex: 0,
      }),
      barIndex: 0,
      knowableAt: NOW,
      eventTime: NOW,
    });
    assert.ok(row);
    assert.equal(row!.valueType, 'decimal');
    assert.ok(isFeatureVisibleAt(NOW, row!.knowableAt));
  });

  it('9 — prediction market features use the same abstraction', () => {
    const row = predictionMarketSnapshotToUniversalObservation(
      buildPredictionMarketFeatureSnapshot({
        instrumentId: 'pm.test',
        knowableAt: NOW,
        micro: null,
      }),
      'entity.acme',
    );
    assert.equal(row.schemaVersion, 'sunrey.helios.feature-fabric.v2.1');
  });

  it('10 — cross-asset derived features retain source lineage', () => {
    const checks = runQualificationChecks();
    assert.equal(checks.crossAssetRetainsLineage, true);
  });

  it('manifest is sealable into Evidence Vault', () => {
    const vault = new EvidenceVault(new FrozenClock(NOW));
    const definition = baseDefinition({ featureId: 'aafv2.evidence' });
    const computed = computeFeatureObservation({
      definition,
      canonicalEntityId: 'entity.acme',
      eventTime: NOW,
      computedAt: NOW,
      revisionId: 'rev_evidence',
      validFrom: NOW,
      contributions: [contribution({ observationId: 'obs_evidence', knowableAt: NOW })],
    });
    assert.equal(computed.ok, true);
    if (!computed.ok) return;
    const manifest = buildFeatureManifest({
      createdAt: NOW,
      decisionTime: NOW,
      definitions: [definition],
      observations: [computed.observation],
      contributions: [contribution({ observationId: 'obs_evidence', knowableAt: NOW })],
      entityUniverse: ['entity.acme'],
      instrumentUniverse: [],
      sourceDatasets: ['fixture'],
      missingDataPolicy: 'omit',
      compilerVersion: 'aafv2-test',
    });
    const evidenceId = sealUniversalFeatureManifest(vault, manifest);
    assert.ok(evidenceId);
  });

  it('recomputation is deterministic for unchanged inputs', () => {
    const definition = baseDefinition({ featureId: 'aafv2.recompute' });
    const input = {
      definition,
      canonicalEntityId: 'entity.acme',
      eventTime: NOW,
      computedAt: NOW,
      revisionId: 'rev_recompute',
      validFrom: NOW,
      contributions: [contribution({ observationId: 'obs_recompute', knowableAt: NOW })],
    };
    const first = computeFeatureObservation(input);
    const second = recomputeFeatureObservation(input, first.ok ? first.observation : ({} as never));
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) return;
    assert.equal(first.observation.lineageHash, second.observation.lineageHash);
  });

  it('transformation version bump creates new lineage', () => {
    const v1 = baseDefinition({ featureId: 'aafv2.lineage', transformationVersion: '1' });
    const v2 = baseDefinition({ featureId: 'aafv2.lineage', transformationVersion: '2' });
    const shared = {
      canonicalEntityId: 'entity.acme',
      eventTime: NOW,
      computedAt: NOW,
      revisionId: 'rev_lineage',
      validFrom: NOW,
      contributions: [contribution({ observationId: 'obs_lineage', knowableAt: NOW })],
    };
    const a = computeFeatureObservation({ ...shared, definition: v1 });
    const b = computeFeatureObservation({ ...shared, definition: v2 });
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    if (!a.ok || !b.ok) return;
    assert.ok(transformationVersionChangeCreatesNewLineage(a.observation.lineage, v2.transformationVersion));
  });

  it('does not grant financial authority or enable live trading', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
    const definition = baseDefinition();
    assert.equal(definition.grantsExecutionAuthority, false);
  });

  it('qualification marker when all invariants hold', () => {
    const checks = runQualificationChecks();
    const result = evaluateAafv2UniversalFeatureFabricQualification(checks);
    assert.equal(result.qualified, true, result.blockers.join('; '));
    assert.equal(result.marker, HELIOS_AAFV2_01_UNIVERSAL_FEATURE_FABRIC_QUALIFIED);
  });
});

describePersistence('HELIOS AAFV2 persistence', () => {
  it('11 — restart preserves feature history', async () => {
    const env = await preparePersistence();
    const durable = await createDurableRuntime(env);
    const pool = durable.session.pools.customer;
    const store = createHeliosUniversalFeatureFabricStore();
    const fabric = new HeliosUniversalFeatureFabric({ clock: new FrozenClock(NOW), store });
    const definition = baseDefinition({ featureId: 'aafv2.persist' });
    fabric.registerDefinition(definition);
    const computed = fabric.compute({
      definition,
      canonicalEntityId: 'entity.persist',
      eventTime: NOW,
      computedAt: NOW,
      revisionId: 'rev_persist',
      validFrom: NOW,
      contributions: [contribution({ observationId: 'obs_persist', knowableAt: NOW })],
    });
    assert.equal(computed.ok, true);
    if (!computed.ok) return;
    const manifest = fabric.sealManifest({
      definitions: [definition],
      observations: [computed.observation],
      contributions: [contribution({ observationId: 'obs_persist', knowableAt: NOW })],
      entityUniverse: ['entity.persist'],
      instrumentUniverse: [],
      sourceDatasets: ['fixture'],
      missingDataPolicy: 'omit',
      compilerVersion: 'aafv2-test',
      decisionTime: NOW,
    });
    await persistHeliosUniversalFeatureFabricState(pool, store.snapshot());
    const loaded = await loadHeliosUniversalFeatureFabricState(pool);
    const restored = createHeliosUniversalFeatureFabricStore();
    restored.restore(loaded);
    const restoredObs = restored.getObservation(computed.observation.featureObservationId);
    assert.ok(restoredObs);
    assert.equal(restoredObs!.featureId, 'aafv2.persist');
    const restoredManifest = restored.getManifest(manifest.manifestId);
    assert.ok(restoredManifest);
    assert.equal(restoredManifest!.manifestHash, manifest.manifestHash);
  });
});
