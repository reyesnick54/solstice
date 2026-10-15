/**
 * HELIOS AAF02 — evidence-time feature fabric.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/index.ts';
import { asUtcInstant, type UtcInstant } from '../packages/domain/src/time.ts';
import {
  HELIOS_AAF02_EVIDENCE_TIME_FEATURE_FABRIC_QUALIFIED,
  HeliosFeatureFabric,
  assertKnowableNotFromEventTimeAlone,
  availabilityAt,
  buildInformationTime,
  computeFeatureObservation,
  createHeliosFeatureFabricStore,
  evaluateAaf02Qualification,
  isFeatureVisibleAt,
  recomputeFeatureObservation,
  selectFeatureRevisionAt,
  transformationVersionChangeCreatesNewLineage,
  type FeatureContributionInput,
  type FeatureDefinition,
} from '../packages/platform/src/helios/index.ts';
import {
  loadHeliosFeatureFabricState,
  persistHeliosFeatureFabricState,
} from '../packages/persistence/src/index.ts';
import { createDurableRuntime, persistenceAvailable, preparePersistence } from './persistence/helpers.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const Q2_PERIOD_END = asUtcInstant('2026-06-30T23:59:59.000Z');
const Q2_PUBLISHED = asUtcInstant('2026-08-14T12:00:00.000Z');
const BEFORE_PUBLICATION = asUtcInstant('2026-08-01T09:00:00.000Z');
const AFTER_PUBLICATION = asUtcInstant('2026-08-15T09:00:00.000Z');

const MACRO_V1_KNOWABLE = asUtcInstant('2026-01-31T14:00:00.000Z');
const MACRO_V2_KNOWABLE = asUtcInstant('2026-02-28T15:30:00.000Z');
const BETWEEN_REVISIONS = asUtcInstant('2026-02-15T10:00:00.000Z');
const AFTER_V2 = asUtcInstant('2026-03-01T10:00:00.000Z');

const MARKET_EVENT = asUtcInstant('2026-09-16T11:59:55.000Z');
const DELAYED_KNOWABLE = asUtcInstant('2026-09-16T12:15:00.000Z');
const EARLY_EVAL = asUtcInstant('2026-09-16T12:05:00.000Z');
const LATE_EVAL = asUtcInstant('2026-09-16T12:20:00.000Z');

const NOW = asUtcInstant('2026-09-17T12:00:00.000Z');

const describePersistence = persistenceAvailable() ? describe : describe.skip;

function baseDefinition(overrides: Partial<FeatureDefinition> = {}): FeatureDefinition {
  return Object.freeze({
    schemaVersion: 'sunrey.helios.feature-fabric.v1',
    featureId: overrides.featureId ?? 'aaf02.revenue.q2',
    featureVersion: overrides.featureVersion ?? '1.0.0',
    displayName: 'Q2 revenue',
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
}): FeatureContributionInput {
  const eventTime = input.eventTime ?? input.knowableAt;
  const informationTime = buildInformationTime({
    observation: {
      observationId: input.observationId,
      providerId: 'fixture',
      capability: 'market_prices',
      providerCategory: 'markets',
      data: {},
      source: { provider: 'fixture', dataset: 'test' },
      time: { retrievedAt: input.knowableAt, sourceTimestamp: eventTime },
      authorityClass: 'reference_data',
      provenance: { rawPayload: '{}', providerSchemaVersion: '1' },
      freshnessPolicy: { maxAgeMs: 60_000, policyId: 'test' },
      validationStatus: 'valid',
      licensing: {
        commercialUseStatus: input.commercialUseStatus ?? 'permitted',
        redistributionStatus: 'permitted',
      },
    },
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
    numericValueMinor: input.numericValueMinor ?? 100n,
  });
}

describe('HELIOS AAF02 evidence-time feature fabric', () => {
  it('enforces HELIOS boundary — feature fabric does not grant financial authority', () => {
    const findings = lintHeliosBoundary(process.cwd());
    const featureFabricFindings = findings.filter((f) => f.file.includes('helios/feature-fabric'));
    assert.equal(featureFabricFindings.length, 0);
  });

  it('1 — Q2 filing cannot be used before publication time', () => {
    const definition = baseDefinition();
    const row = contribution({
      observationId: 'obs_q2_filing',
      knowableAt: Q2_PUBLISHED,
      eventTime: Q2_PERIOD_END,
      numericValueMinor: 1_000_000n,
    });
    assertKnowableNotFromEventTimeAlone({
      eventTime: Q2_PERIOD_END,
      knowableAt: row.informationTime.knowableAt,
      hasPublicationOrAvailability: true,
    });
    const computed = computeFeatureObservation({
      definition,
      canonicalEntityId: 'entity.acme',
      eventTime: Q2_PERIOD_END,
      computedAt: Q2_PUBLISHED,
      revisionId: 'rev_q2_2026',
      validFrom: Q2_PUBLISHED,
      contributions: [row],
    });
    assert.equal(computed.ok, true);
    if (!computed.ok) return;
    assert.equal(isFeatureVisibleAt(BEFORE_PUBLICATION, computed.observation.knowableAt), false);
    assert.equal(
      availabilityAt(BEFORE_PUBLICATION, computed.observation.knowableAt, computed.observation.qualityState, computed.observation.entitlementState),
      'NOT_YET_KNOWABLE',
    );
    assert.equal(isFeatureVisibleAt(AFTER_PUBLICATION, computed.observation.knowableAt), true);
  });

  it('2 — revised macro release preserves historically knowable revision', () => {
    const definition = baseDefinition({ featureId: 'aaf02.gdp.q1', valueKind: 'decimal' });
    const v1 = computeFeatureObservation({
      definition,
      canonicalEntityId: 'entity.us',
      eventTime: asUtcInstant('2026-01-01T00:00:00.000Z'),
      computedAt: MACRO_V1_KNOWABLE,
      revisionId: 'gdp_2026q1_v1',
      validFrom: MACRO_V1_KNOWABLE,
      contributions: [
        contribution({
          observationId: 'obs_gdp_v1',
          knowableAt: MACRO_V1_KNOWABLE,
          numericValueMinor: 210n,
        }),
      ],
    });
    const v2 = computeFeatureObservation({
      definition,
      canonicalEntityId: 'entity.us',
      eventTime: asUtcInstant('2026-01-01T00:00:00.000Z'),
      computedAt: MACRO_V2_KNOWABLE,
      revisionId: 'gdp_2026q1_v2',
      validFrom: MACRO_V2_KNOWABLE,
      contributions: [
        contribution({
          observationId: 'obs_gdp_v2',
          knowableAt: MACRO_V2_KNOWABLE,
          numericValueMinor: 195n,
        }),
      ],
    });
    assert.equal(v1.ok, true);
    assert.equal(v2.ok, true);
    if (!v1.ok || !v2.ok) return;
    const rows = [v1.observation, v2.observation];
    const atBetween = selectFeatureRevisionAt(rows, BETWEEN_REVISIONS, definition.featureId);
    const atAfter = selectFeatureRevisionAt(rows, AFTER_V2, definition.featureId);
    assert.equal(atBetween?.revisionId, 'gdp_2026q1_v1');
    assert.equal(atAfter?.revisionId, 'gdp_2026q1_v2');
    assert.notEqual(atBetween?.featureObservationId, atAfter?.featureObservationId);
  });

  it('3 — feature using a future observation is rejected', () => {
    const definition = baseDefinition({ featureId: 'aaf02.future_guard' });
    const future = contribution({
      observationId: 'obs_future',
      knowableAt: LATE_EVAL,
      eventTime: MARKET_EVENT,
    });
    const rejected = computeFeatureObservation({
      definition,
      canonicalEntityId: 'entity.test',
      eventTime: MARKET_EVENT,
      computedAt: EARLY_EVAL,
      revisionId: 'rev_1',
      validFrom: EARLY_EVAL,
      contributions: [future],
      evaluationTimeForVisibility: EARLY_EVAL,
    });
    assert.equal(rejected.ok, false);
    if (rejected.ok) return;
    assert.equal(rejected.code, 'FUTURE_OBSERVATION');
  });

  it('4 — delayed market data preserves actual knowability', () => {
    const definition = baseDefinition({ featureId: 'aaf02.delayed_px' });
    const delayed = contribution({
      observationId: 'obs_delayed_quote',
      knowableAt: DELAYED_KNOWABLE,
      eventTime: MARKET_EVENT,
    });
    const computed = computeFeatureObservation({
      definition,
      canonicalEntityId: 'entity.test',
      canonicalInstrumentId: 'instr_aapl',
      eventTime: MARKET_EVENT,
      computedAt: DELAYED_KNOWABLE,
      revisionId: 'rev_delayed',
      validFrom: DELAYED_KNOWABLE,
      contributions: [delayed],
    });
    assert.equal(computed.ok, true);
    if (!computed.ok) return;
    assert.equal(computed.observation.knowableAt, DELAYED_KNOWABLE);
    assert.equal(isFeatureVisibleAt(EARLY_EVAL, computed.observation.knowableAt), false);
    assert.equal(isFeatureVisibleAt(LATE_EVAL, computed.observation.knowableAt), true);
  });

  it('5 — stale observations produce degraded features', () => {
    const definition = baseDefinition({ featureId: 'aaf02.stale' });
    const stale = contribution({
      observationId: 'obs_stale',
      knowableAt: NOW,
      qualityState: 'DEGRADED_STALE',
    });
    const computed = computeFeatureObservation({
      definition,
      canonicalEntityId: 'entity.test',
      eventTime: NOW,
      computedAt: NOW,
      revisionId: 'rev_stale',
      validFrom: NOW,
      contributions: [stale],
    });
    assert.equal(computed.ok, true);
    if (!computed.ok) return;
    assert.equal(computed.observation.qualityState, 'DEGRADED_STALE');
  });

  it('6 — restricted entitlements propagate to derived features', () => {
    const definition = baseDefinition({ featureId: 'aaf02.restricted' });
    const restricted = contribution({
      observationId: 'obs_restricted',
      knowableAt: NOW,
      entitlementClass: 'commercial_restricted',
      commercialUseStatus: 'restricted',
    });
    const computed = computeFeatureObservation({
      definition,
      canonicalEntityId: 'entity.test',
      eventTime: NOW,
      computedAt: NOW,
      revisionId: 'rev_restricted',
      validFrom: NOW,
      contributions: [restricted],
    });
    assert.equal(computed.ok, true);
    if (!computed.ok) return;
    assert.equal(computed.observation.entitlementState, 'RESTRICTED');
    assert.equal(
      availabilityAt(NOW, computed.observation.knowableAt, computed.observation.qualityState, computed.observation.entitlementState),
      'RESTRICTED',
    );
  });

  it('8 — recomputation with identical inputs/version is deterministic', () => {
    const definition = baseDefinition({ featureId: 'aaf02.deterministic' });
    const input = {
      definition,
      canonicalEntityId: 'entity.test',
      eventTime: NOW,
      computedAt: NOW,
      revisionId: 'rev_det',
      validFrom: NOW,
      contributions: [
        contribution({ observationId: 'obs_det', knowableAt: NOW, numericValueMinor: 42n }),
      ],
    };
    const first = computeFeatureObservation(input);
    const second = recomputeFeatureObservation(input, first.ok ? first.observation : ({} as never));
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) return;
    assert.equal(first.observation.lineage.contentFingerprint, second.observation.lineage.contentFingerprint);
    assert.equal(first.observation.featureObservationId, second.observation.featureObservationId);
  });

  it('9 — transformation-version changes create new feature lineage', () => {
    const definitionV1 = baseDefinition({
      featureId: 'aaf02.lineage',
      transformationVersion: '1',
    });
    const definitionV2 = baseDefinition({
      featureId: 'aaf02.lineage',
      transformationVersion: '2',
    });
    const shared = {
      canonicalEntityId: 'entity.test',
      eventTime: NOW,
      computedAt: NOW,
      revisionId: 'rev_lineage',
      validFrom: NOW,
      contributions: [contribution({ observationId: 'obs_lineage', knowableAt: NOW })],
    };
    const a = computeFeatureObservation({ ...shared, definition: definitionV1 });
    const b = computeFeatureObservation({ ...shared, definition: definitionV2 });
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    if (!a.ok || !b.ok) return;
    assert.ok(
      transformationVersionChangeCreatesNewLineage(a.observation.lineage, definitionV2.transformationVersion),
    );
    assert.notEqual(a.observation.lineage.lineageId, b.observation.lineage.lineageId);
  });

  it('10 — customer financial authority is never granted by feature creation', () => {
    const store = createHeliosFeatureFabricStore();
    const fabric = new HeliosFeatureFabric({ clock: new FrozenClock(NOW), store });
    const definition = baseDefinition({ featureId: 'aaf02.no_ea' });
    fabric.registerDefinition(definition);
    const computed = fabric.compute({
      definition,
      canonicalEntityId: 'entity.test',
      eventTime: NOW,
      computedAt: NOW,
      revisionId: 'rev_no_ea',
      validFrom: NOW,
      contributions: [contribution({ observationId: 'obs_no_ea', knowableAt: NOW })],
    });
    assert.equal(computed.ok, true);
    if (!computed.ok) return;
    assert.equal(computed.observation.grantsExecutionAuthority, false);
    assert.equal(definition.grantsExecutionAuthority, false);
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
  });

  it('qualification marker when all invariants hold', () => {
    const result = evaluateAaf02Qualification({
      q2FilingBlockedBeforePublication: true,
      macroRevisionPreservesHistory: true,
      futureObservationRejected: true,
      delayedMarketKnowabilityPreserved: true,
      staleProducesDegradedFeature: true,
      restrictedEntitlementPropagates: true,
      restartPreservesIdentity: true,
      recomputationDeterministic: true,
      transformationVersionNewLineage: true,
      noCustomerFinancialAuthority: true,
    });
    assert.equal(result.marker, HELIOS_AAF02_EVIDENCE_TIME_FEATURE_FABRIC_QUALIFIED);
    assert.equal(result.qualified, true);
  });
});

describePersistence('HELIOS AAF02 persistence', () => {
  it('7 — restart preserves feature identity and manifests', async () => {
    const env = await preparePersistence();
    const durable = await createDurableRuntime(env);
    const pool = durable.session.pools.customer;
    const store = createHeliosFeatureFabricStore();
    const fabric = new HeliosFeatureFabric({ clock: new FrozenClock(NOW), store });
    const definition = baseDefinition({ featureId: 'aaf02.persist' });
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
      sourceDatasets: ['fixture_market'],
      universeDefinition: 'entity.persist',
      missingValuePolicy: 'omit',
      codeVersion: 'aaf02-test',
      modelVersion: null,
    });
    await persistHeliosFeatureFabricState(pool, store.snapshot());
    const loaded = await loadHeliosFeatureFabricState(pool);
    const restored = createHeliosFeatureFabricStore();
    restored.restore(loaded);
    const restoredObs = restored.getObservation(computed.observation.featureObservationId);
    assert.ok(restoredObs);
    assert.equal(restoredObs!.featureId, 'aaf02.persist');
    assert.equal(restoredObs!.revisionId, 'rev_persist');
    const restoredManifest = restored.getManifest(manifest.manifestId);
    assert.ok(restoredManifest);
    assert.equal(restoredManifest!.pointInTimeRule, 'knowable_at_lte_evaluation_time');
  });
});
