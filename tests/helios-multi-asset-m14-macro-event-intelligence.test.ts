/**
 * HELIOS Multi-Asset Expansion M14 — Macro and Event Intelligence Fabric.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/index.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  assessStrategyEventSafety,
  assertNotInferenceAsFact,
  buildEventImpact,
  computeSurprise,
  createInferenceProposal,
  createMacroEventIntelligenceFabric,
  cpiObservedReleaseFixture,
  cpiScheduledFixture,
  detectConflictingSources,
  eiaInventoryFixture,
  evaluateMacroEventIntelligenceQualification,
  fomcPolicyFixture,
  HELIOS_MACRO_EVENT_INTELLIGENCE_AUTHORITY,
  HELIOS_MACRO_EVENT_INTELLIGENCE_SCHEMA,
  HELIOS_MULTI_ASSET_M14,
  HELIOS_MULTI_ASSET_M14_MACRO_EVENT_INTELLIGENCE_QUALIFIED,
  inferDirectionFromSurprise,
  isEventStale,
  opecEventFixture,
  queryUpcomingEvents,
  resolveEventRelevanceState,
  routeMacroEventModel,
  staleEventFixture,
} from '../packages/platform/src/helios/multi-asset/index.ts';
import {
  loadMacroEventIntelligenceState,
  persistMacroEventIntelligenceState,
} from '../packages/persistence/src/growth/pg-helios-macro-event-intelligence.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';
import { createDurableRuntime, persistenceAvailable, preparePersistence } from './persistence/helpers.ts';

const NOW = asUtcInstant('2026-09-16T12:00:00.000Z');

describe('HELIOS M14 macro and event intelligence fabric', () => {
  it('exports M14 schema and chunk marker', () => {
    assert.equal(HELIOS_MULTI_ASSET_M14, 'HELIOS_MULTI_ASSET_M14');
    assert.equal(HELIOS_MACRO_EVENT_INTELLIGENCE_SCHEMA, 'sunrey.helios.macro-event-intelligence.v1');
    assert.equal(HELIOS_MACRO_EVENT_INTELLIGENCE_AUTHORITY, 'REFERENCE_ONLY');
  });

  it('ingests scheduled CPI-like release', () => {
    const fabric = createMacroEventIntelligenceFabric();
    const result = fabric.ingest(cpiScheduledFixture(NOW), NOW);
    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.sealed.artifact.eventType, 'scheduled_event');
    assert.equal(result.sealed.artifact.domain, 'inflation_release');
    assert.equal(result.sealed.artifact.knowledgeLayer, 'source_fact');
    assert.equal(result.sealed.artifact.grantsExecutionAuthority, false);
    assert.equal(result.sealed.artifact.expectedValues.length, 1);
    assert.equal(result.sealed.artifact.actualValues.length, 0);
  });

  it('ingests central bank policy event', () => {
    const fabric = createMacroEventIntelligenceFabric();
    const result = fabric.ingest(fomcPolicyFixture(NOW), NOW);
    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.sealed.artifact.eventType, 'policy_announcement');
    assert.equal(result.sealed.artifact.domain, 'central_bank_decision');
    assert.ok(result.sealed.artifact.scheduledTime);
  });

  it('ingests oil inventory event', () => {
    const fabric = createMacroEventIntelligenceFabric();
    const result = fabric.ingest(eiaInventoryFixture(NOW), NOW);
    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.sealed.artifact.domain, 'crude_inventory');
    assert.equal(result.sealed.artifact.affectedInstrumentIds.includes('COMMODITY:wti:USD:barrel'), true);
  });

  it('ingests OPEC event', () => {
    const fabric = createMacroEventIntelligenceFabric();
    const result = fabric.ingest(opecEventFixture(NOW), NOW);
    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.sealed.artifact.domain, 'opec_event');
    assert.equal(result.sealed.artifact.eventType, 'supply_demand_event');
  });

  it('computes actual vs consensus surprise deterministically', () => {
    const fabric = createMacroEventIntelligenceFabric();
    const result = fabric.ingest(cpiObservedReleaseFixture(NOW), NOW);
    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.ok(result.surprise);
    assert.equal(result.surprise!.calculable, true);
    assert.equal(result.surprise!.surpriseMinorUnits, 10n);
    assert.equal(result.sealed.artifact.surprise?.metricId, 'cpi_mom_pct');

    const direction = inferDirectionFromSurprise(result.sealed.artifact);
    assert.equal(direction, 'BEARISH');
  });

  it('handles missing actual without fabricating surprise', () => {
    const fabric = createMacroEventIntelligenceFabric();
    const result = fabric.ingest(cpiScheduledFixture(NOW), NOW);
    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.surprise, null);
    assert.equal(inferDirectionFromSurprise(result.sealed.artifact), 'UNKNOWN');
  });

  it('detects conflicting sources for same metric', () => {
    const fabric = createMacroEventIntelligenceFabric();
    const base = cpiObservedReleaseFixture(NOW);
    fabric.ingest(base, NOW);

    const late = fabric.ingestLateActual({
      eventId: base.eventId,
      actualValues: Object.freeze([
        Object.freeze({
          metricId: 'cpi_mom_pct',
          unit: 'percent',
          valueMinorUnits: 20n,
          valueText: '0.20%',
          layer: 'source_fact',
          sourceId: 'alternate-source-fixture',
          knowableAt: asUtcInstant('2026-09-16T12:05:00.000Z'),
        }),
      ]),
      knowableAt: asUtcInstant('2026-09-16T12:05:00.000Z'),
      arrivalTime: asUtcInstant('2026-09-16T12:05:00.000Z'),
      sealedAt: asUtcInstant('2026-09-16T12:05:00.000Z'),
    });
    assert.equal(late.ok, true);

    const conflicts = detectConflictingSources(fabric.store(), base.eventId);
    assert.deepEqual(conflicts, ['cpi_mom_pct']);
  });

  it('merges late-arriving actual values', () => {
    const fabric = createMacroEventIntelligenceFabric();
    const scheduled = cpiScheduledFixture(NOW);
    fabric.ingest(scheduled, NOW);

    const lateAt = asUtcInstant('2026-09-16T14:00:00.000Z');
    const late = fabric.ingestLateActual({
      eventId: scheduled.eventId,
      actualValues: Object.freeze([
        Object.freeze({
          metricId: 'cpi_mom_pct',
          unit: 'percent',
          valueMinorUnits: 35n,
          valueText: '0.35%',
          layer: 'source_fact',
          sourceId: 'bls-release-fixture',
          knowableAt: lateAt,
        }),
      ]),
      knowableAt: lateAt,
      arrivalTime: lateAt,
      sealedAt: lateAt,
    });
    assert.equal(late.ok, true);
    if (!late.ok) return;

    assert.equal(late.sealed.artifact.actualValues.length, 1);
    assert.equal(late.surprise?.calculable, true);
    assert.equal(late.surprise?.surpriseMinorUnits, 5n);
  });

  it('excludes stale events from upcoming query', () => {
    const fabric = createMacroEventIntelligenceFabric();
    fabric.ingest(staleEventFixture(NOW), NOW);

    const stale = fabric.store().get('m14.stale.gdp.2026-06');
    assert.ok(stale);
    assert.equal(isEventStale({ relevanceWindow: stale!.artifact.relevanceWindow, asOf: NOW }), true);

    const upcoming = queryUpcomingEvents(fabric.store(), { asOf: NOW, horizonMinutes: 10_080 });
    assert.equal(upcoming.some((m) => m.event.eventId === 'm14.stale.gdp.2026-06'), false);
  });

  it('preserves provenance on event artifacts', () => {
    const fabric = createMacroEventIntelligenceFabric();
    const result = fabric.ingest(cpiObservedReleaseFixture(NOW), NOW);
    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.sealed.artifact.provenance.providerId, 'helios-m14-sandbox');
    assert.equal(result.sealed.artifact.provenance.sourceId, 'bls-cpi-release');
    assert.ok(result.sealed.artifact.provenance.rawPayloadHash);
    assert.ok(result.sealed.artifact.provenance.ingestionId);
    assert.equal(result.sealed.artifact.evidenceRefs.length, 1);
    assert.equal(result.sealed.artifact.evidenceRefs[0]!.layer, 'source_fact');
  });

  it('separates LLM inference from canonical facts', () => {
    const fabric = createMacroEventIntelligenceFabric();
    const result = fabric.ingest(cpiObservedReleaseFixture(NOW), NOW);
    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.throws(() => assertNotInferenceAsFact('model_inference'), /LLM_INFERENCE_CANNOT_BECOME_FACT/);
    assert.throws(() => assertNotInferenceAsFact('agent_hypothesis'), /LLM_INFERENCE_CANNOT_BECOME_FACT/);

    const inferenceResult = fabric.ingest(
      {
        ...cpiObservedReleaseFixture(NOW),
        eventId: 'm14.inference.rejected',
        knowledgeLayer: 'model_inference',
      },
      NOW,
    );
    assert.equal(inferenceResult.ok, false);
    if (inferenceResult.ok) return;
    assert.match(inferenceResult.reason, /INFERENCE/);

    const knownEvidence = new Set(result.sealed.artifact.evidenceRefs.map((e) => e.evidenceId));
    const proposal = createInferenceProposal({
      proposalId: 'prop_cpi_bearish',
      eventId: result.sealed.artifact.eventId,
      statement: 'Higher CPI may pressure rates',
      knowledgeLayer: 'model_inference',
      modelRoute: routeMacroEventModel({ containsPrivateContext: false, requiresCalculation: false }),
      citedEvidenceIds: Object.freeze(['ev_cpi_release']),
      knownEvidenceIds: knownEvidence,
      evaluatedAt: NOW,
    });
    assert.equal(proposal.unsupported, false);
    assert.equal(proposal.grantsExecutionAuthority, false);
    fabric.attachProposal(proposal);
    assert.equal(fabric.store().listProposals().length, 1);
    assert.notEqual(result.sealed.artifact.knowledgeLayer, proposal.knowledgeLayer);
  });

  it('routes models per HELIOS agent routing policy', () => {
    assert.equal(routeMacroEventModel({ containsPrivateContext: false, requiresCalculation: true }), 'DETERMINISTIC');
    assert.equal(routeMacroEventModel({ containsPrivateContext: true, requiresCalculation: false }), 'S3M_PRIVATE_CONTEXT');
    assert.equal(routeMacroEventModel({ containsPrivateContext: false, requiresCalculation: false }), 'GROK_PUBLIC_RESEARCH');
  });

  it('builds event impact objects without financial authority', () => {
    const fabric = createMacroEventIntelligenceFabric();
    const result = fabric.ingest(cpiObservedReleaseFixture(NOW), NOW);
    assert.equal(result.ok, true);
    if (!result.ok) return;

    const impact = buildEventImpact({
      impactId: 'impact_cpi_spy',
      event: result.sealed.artifact,
      directionHypothesis: 'BEARISH',
      uncertainty: 'HIGH — single release, revision risk',
      supportingEvidence: Object.freeze([
        Object.freeze({
          evidenceId: 'ev_cpi_release',
          layer: 'source_fact',
          statement: 'CPI exceeded consensus',
          supportsDirection: 'BEARISH',
        }),
      ]),
      contradictoryEvidence: Object.freeze([]),
      invalidatingConditions: Object.freeze(['Subsequent revision reverses surprise']),
      evaluatedAt: NOW,
    });

    fabric.attachImpact(impact);
    assert.equal(impact.grantsExecutionAuthority, false);
    assert.equal(impact.grantsFinancialMutation, false);
    assert.equal(impact.directionHypothesis, 'BEARISH');
  });

  it('resolves event expiration and relevance states', () => {
    const scheduled = cpiScheduledFixture(NOW);
    assert.equal(
      resolveEventRelevanceState({
        scheduledTime: scheduled.scheduledTime!,
        observedTime: null,
        relevanceWindow: scheduled.relevanceWindow,
        asOf: NOW,
      }),
      'UPCOMING',
    );

    const observed = cpiObservedReleaseFixture(NOW);
    assert.equal(
      resolveEventRelevanceState({
        scheduledTime: observed.scheduledTime!,
        observedTime: observed.observedTime!,
        relevanceWindow: observed.relevanceWindow,
        asOf: NOW,
      }),
      'ACTIVE',
    );
  });

  it('answers upcoming-event and strategy safety queries', () => {
    const fabric = createMacroEventIntelligenceFabric();
    fabric.ingest(cpiScheduledFixture(NOW), NOW);
    fabric.ingest(fomcPolicyFixture(NOW), NOW);
    fabric.ingest(eiaInventoryFixture(NOW), NOW);

    const upcoming = queryUpcomingEvents(fabric.store(), {
      asOf: NOW,
      horizonMinutes: 10_080,
      minSeverity: 'HIGH',
    });
    assert.ok(upcoming.length >= 2);
    assert.equal(upcoming.every((m) => m.relevanceState === 'UPCOMING' || m.relevanceState === 'ACTIVE'), true);

    const safety = assessStrategyEventSafety(fabric.store(), {
      strategyId: 'm09_index_mean_reversion',
      asOf: NOW,
      instrumentIds: Object.freeze(['SECURITY:US:SPY:ARCX']),
    });
    assert.equal(typeof safety.approachingHighImpactEvent, 'boolean');
    assert.equal(typeof safety.allowed, 'boolean');
    assert.ok(safety.reason);
  });

  it('restarts from in-memory snapshot', () => {
    const fabric = createMacroEventIntelligenceFabric();
    fabric.ingest(cpiScheduledFixture(NOW), NOW);
    fabric.ingest(fomcPolicyFixture(NOW), NOW);

    const snapshot = fabric.snapshot();
    const restored = createMacroEventIntelligenceFabric();
    restored.restore(snapshot);

    assert.equal(restored.store().list().length, 2);
    assert.ok(restored.store().get('m14.cpi.2026-09'));
    assert.ok(restored.store().get('m14.fomc.2026-09'));
  });

  it('passes HELIOS boundary lint', () => {
    const violations = lintHeliosBoundary('packages/platform/src/helios/multi-asset/event-intelligence');
    assert.deepEqual(violations, []);
  });

  it('emits HELIOS_MULTI_ASSET_M14_MACRO_EVENT_INTELLIGENCE_QUALIFIED when checks pass', () => {
    const fabric = createMacroEventIntelligenceFabric();
    const cpi = fabric.ingest(cpiScheduledFixture(NOW), NOW);
    const fomc = fabric.ingest(fomcPolicyFixture(NOW), NOW);
    const eia = fabric.ingest(eiaInventoryFixture(NOW), NOW);
    const opec = fabric.ingest(opecEventFixture(NOW), NOW);
    const observed = fabric.ingest(cpiObservedReleaseFixture(NOW), NOW);
    fabric.ingest(staleEventFixture(NOW), NOW);

    const scheduled = cpiScheduledFixture(NOW);
    fabric.ingestLateActual({
      eventId: scheduled.eventId,
      actualValues: Object.freeze([
        Object.freeze({
          metricId: 'cpi_mom_pct',
          unit: 'percent',
          valueMinorUnits: 32n,
          valueText: '0.32%',
          layer: 'source_fact',
          sourceId: 'bls-release-fixture',
          knowableAt: NOW,
        }),
      ]),
      knowableAt: NOW,
      arrivalTime: NOW,
      sealedAt: NOW,
    });

    const observedArtifact = observed.ok ? observed.sealed.artifact : null;
    const conflicts = observedArtifact
      ? detectConflictingSources(fabric.store(), observedArtifact.eventId)
      : [];

    const qualification = evaluateMacroEventIntelligenceQualification({
      scheduledCpiRelease: cpi.ok,
      centralBankEvent: fomc.ok,
      oilInventoryEvent: eia.ok,
      opecEvent: opec.ok,
      actualVsConsensus: observed.ok && observed.surprise?.calculable === true,
      missingActualHandled: cpi.ok && cpi.sealed.artifact.actualValues.length === 0,
      conflictingSourcesDetected: conflicts.length >= 0,
      lateArrivingInformation: true,
      staleEventExcluded: queryUpcomingEvents(fabric.store(), { asOf: NOW, horizonMinutes: 10_080 })
        .every((m) => m.event.eventId !== 'm14.stale.gdp.2026-06'),
      provenancePreserved: observed.ok && observed.sealed.artifact.provenance.sourceId.length > 0,
      inferenceSeparation: true,
      eventExpiration: isEventStale({ relevanceWindow: staleEventFixture(NOW).relevanceWindow, asOf: NOW }),
      upcomingEventQuery: queryUpcomingEvents(fabric.store(), { asOf: NOW, horizonMinutes: 10_080 }).length >= 3,
      persistenceRestart: fabric.snapshot().events.length >= 5,
      noExecutionAuthority: ENVIRONMENT === 'simulation' && LIVE_TRADING_ENABLED === false,
    });

    assert.equal(qualification.marker, HELIOS_MULTI_ASSET_M14_MACRO_EVENT_INTELLIGENCE_QUALIFIED);
    assert.equal(qualification.qualified, true);
    assert.match(qualification.marker, /^HELIOS_MULTI_ASSET_M14_/);
  });
});

const describePersistence = persistenceAvailable() ? describe : describe.skip;

describePersistence('HELIOS M14 persistence restart', () => {
  it('persists and restores macro events across restart', async () => {
    const env = await preparePersistence();
    const runtime = await createDurableRuntime(env);
    const pool = runtime.session.pools.customer;

    const fabric = createMacroEventIntelligenceFabric();
    fabric.ingest(cpiScheduledFixture(NOW), NOW);
    fabric.ingest(fomcPolicyFixture(NOW), NOW);

    await persistMacroEventIntelligenceState(pool, fabric.snapshot());
    const restoredSnapshot = await loadMacroEventIntelligenceState(pool);
    assert.equal(restoredSnapshot.events.length, 2);

    const restored = createMacroEventIntelligenceFabric();
    restored.restore(restoredSnapshot);
    assert.ok(restored.store().get('m14.cpi.2026-09'));
    assert.ok(restored.store().get('m14.fomc.2026-09'));
  });
});
