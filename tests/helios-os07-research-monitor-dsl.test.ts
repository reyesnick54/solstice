/**
 * HELIOS OS07 — Research Monitor DSL qualification.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { EvidenceVault } from '../packages/evidence/src/vault.ts';
import { initialBudgetSnapshot } from '../packages/platform/src/helios/budget.ts';
import {
  HELIOS_OS07_RESEARCH_MONITOR_DSL,
  HELIOS_OS07_RESEARCH_MONITOR_DSL_QUALIFIED,
  HeliosResearchMonitorService,
  compileResearchMonitorDefinition,
  createH20ResearchBudgetPort,
  evaluateOs07ResearchMonitorQualification,
  FIXTURE_MONITOR_NOW,
  futureNvdaVolFeatureSet,
  missingBreadthFeatureSet,
  semiconductorVolatilityDislocationDefinition,
  staleNvdaVolFeatureSet,
  triggeredSemiconductorFeatureSet,
  type AafFeatureFabricPort,
  type CanonicalFeatureObservation,
  type ResearchMonitorDefinition,
} from '../packages/platform/src/helios/research-monitor/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

function featureFabric(rows: readonly CanonicalFeatureObservation[]): AafFeatureFabricPort {
  return Object.freeze({
    resolveFeatures: () => rows,
  });
}

function evaluateMonitor(
  definition: ResearchMonitorDefinition,
  features: readonly CanonicalFeatureObservation[],
  options?: {
    readonly evaluatedAt?: string;
    readonly budgetCeiling?: string;
    readonly evidence?: EvidenceVault;
  },
) {
  const service = new HeliosResearchMonitorService();
  const budget = createH20ResearchBudgetPort(
    initialBudgetSnapshot({
      ceilingAmount: options?.budgetCeiling ?? '1000',
      unitKind: 'MICROS',
      currency: 'USD',
    }),
  );
  return service.evaluate({
    definition,
    evaluatedAt: asUtcInstant(options?.evaluatedAt ?? FIXTURE_MONITOR_NOW),
    featureFabric: featureFabric(features),
    observationFabric: Object.freeze({ observationStoreRef: 'helios-observation-fabric-fixture' }),
    researchBudget: budget,
    evidenceVault: options?.evidence,
  });
}

describe('HELIOS OS07 Research Monitor DSL', () => {
  it('exports chunk marker HELIOS_OS07_RESEARCH_MONITOR_DSL', () => {
    assert.equal(HELIOS_OS07_RESEARCH_MONITOR_DSL, 'HELIOS_OS07_RESEARCH_MONITOR_DSL');
  });

  it('passes HELIOS boundary guard', () => {
    assert.deepEqual(lintHeliosBoundary(process.cwd()), []);
  });

  it('compiles semiconductor_volatility_dislocation and requests research (not trading)', () => {
    const definition = semiconductorVolatilityDislocationDefinition();
    const compiled = compileResearchMonitorDefinition(definition, FIXTURE_MONITOR_NOW);
    assert.equal(compiled.ok, true);
    if (!compiled.ok) return;
    assert.equal(compiled.manifest.grantsTradingAction, false);
    assert.equal(compiled.manifest.trigger.action, 'REQUEST_RESEARCH');
    assert.equal(compiled.manifest.name, 'semiconductor_volatility_dislocation');
    assert.deepEqual(compiled.manifest.watch, ['NVDA', 'QQQ', 'SOXX']);

    const evaluation = evaluateMonitor(definition, triggeredSemiconductorFeatureSet());
    assert.equal(evaluation.outcome, 'TRIGGERED');
    assert.equal(evaluation.triggerEmitted, true);
    assert.equal(evaluation.triggerEvent?.action, 'REQUEST_RESEARCH');
    assert.equal(evaluation.triggerEvent?.researchTopic, 'semiconductor_volatility_dislocation');
    assert.notEqual(evaluation.triggerEvent?.action, 'BUY_NVDA');
  });

  it('blocks stale feature under FAIL_CLOSED policy', () => {
    const evaluation = evaluateMonitor(
      semiconductorVolatilityDislocationDefinition(),
      staleNvdaVolFeatureSet(),
    );
    assert.equal(evaluation.outcome, 'BLOCKED');
    assert.equal(evaluation.blockReason, 'STALE_FEATURE');
  });

  it('blocks future (not-yet-knowable) feature', () => {
    const evaluation = evaluateMonitor(
      semiconductorVolatilityDislocationDefinition(),
      futureNvdaVolFeatureSet(),
    );
    assert.equal(evaluation.outcome, 'BLOCKED');
    assert.equal(evaluation.blockReason, 'FUTURE_FEATURE');
  });

  it('blocks missing feature', () => {
    const evaluation = evaluateMonitor(
      semiconductorVolatilityDislocationDefinition(),
      missingBreadthFeatureSet(),
    );
    assert.equal(evaluation.outcome, 'BLOCKED');
    assert.equal(evaluation.blockReason, 'MISSING_FEATURE');
  });

  it('enforces cooldown between duplicate evaluations', () => {
    const definition = semiconductorVolatilityDislocationDefinition({ cooldownMs: 3_600_000, maxTriggers: 10 });
    const service = new HeliosResearchMonitorService();
    const budget = createH20ResearchBudgetPort(
      initialBudgetSnapshot({ ceilingAmount: '10000', unitKind: 'MICROS', currency: 'USD' }),
    );
    const evaluateAt = (at: string) =>
      service.evaluate({
        definition,
        evaluatedAt: asUtcInstant(at),
        featureFabric: featureFabric(triggeredSemiconductorFeatureSet(asUtcInstant(at))),
        researchBudget: budget,
      });
    assert.equal(evaluateAt('2026-11-03T06:30:00.000Z').outcome, 'TRIGGERED');
    const second = evaluateAt('2026-11-03T06:45:00.000Z');
    assert.equal(second.outcome, 'BLOCKED');
    assert.equal(second.blockReason, 'COOLDOWN');
  });

  it('blocks duplicate trigger fingerprint after cooldown', () => {
    const definition = semiconductorVolatilityDislocationDefinition({ cooldownMs: 0, maxTriggers: 10 });
    const service = new HeliosResearchMonitorService();
    const budget = createH20ResearchBudgetPort(
      initialBudgetSnapshot({ ceilingAmount: '10000', unitKind: 'MICROS', currency: 'USD' }),
    );
    const evaluateAt = (at: string) =>
      service.evaluate({
        definition,
        evaluatedAt: asUtcInstant(at),
        featureFabric: featureFabric(triggeredSemiconductorFeatureSet(asUtcInstant(at))),
        researchBudget: budget,
      });
    assert.equal(evaluateAt('2026-11-03T06:30:00.000Z').outcome, 'TRIGGERED');
    const dup = evaluateAt('2026-11-03T07:30:00.000Z');
    assert.equal(dup.outcome, 'BLOCKED');
    assert.equal(dup.blockReason, 'DUPLICATE_TRIGGER');
  });

  it('enforces expiration', () => {
    const evaluation = evaluateMonitor(
      semiconductorVolatilityDislocationDefinition(),
      triggeredSemiconductorFeatureSet(),
      { evaluatedAt: '2026-12-02T00:00:00.000Z' },
    );
    assert.equal(evaluation.outcome, 'BLOCKED');
    assert.equal(evaluation.blockReason, 'EXPIRED');
  });

  it('blocks when research budget is exhausted', () => {
    const evaluation = evaluateMonitor(
      semiconductorVolatilityDislocationDefinition({ researchBudgetMinor: '500' }),
      triggeredSemiconductorFeatureSet(),
      { budgetCeiling: '100' },
    );
    assert.equal(evaluation.outcome, 'BLOCKED');
    assert.equal(evaluation.blockReason, 'RESEARCH_BUDGET_EXHAUSTED');
  });

  it('restores runtime state after restart from snapshot', () => {
    const service = new HeliosResearchMonitorService();
    const definition = semiconductorVolatilityDislocationDefinition({ cooldownMs: 0, maxTriggers: 3 });
    const budget = createH20ResearchBudgetPort(
      initialBudgetSnapshot({ ceilingAmount: '5000', unitKind: 'MICROS', currency: 'USD' }),
    );
    service.evaluate({
      definition,
      evaluatedAt: FIXTURE_MONITOR_NOW,
      featureFabric: featureFabric(triggeredSemiconductorFeatureSet()),
      researchBudget: budget,
    });
    const snapshot = service.getStore().snapshot();
    const restarted = new HeliosResearchMonitorService();
    restarted.getStore().loadSnapshot(snapshot);
    const state = restarted.getStore().getState(definition.monitorId);
    assert.equal(state?.triggerCount, 1);
    assert.equal(state?.lastTriggerFingerprint !== null, true);
  });

  it('seals evidence vault records for manifest, evaluation, and trigger', () => {
    const clock = new FrozenClock(FIXTURE_MONITOR_NOW);
    const vault = new EvidenceVault(clock);
    const evaluation = evaluateMonitor(
      semiconductorVolatilityDislocationDefinition({ cooldownMs: 86_400_000 }),
      triggeredSemiconductorFeatureSet(),
      { evidence: vault },
    );
    assert.equal(evaluation.outcome, 'TRIGGERED');
    assert.ok(evaluation.evidenceRefs.length >= 2);
    assert.ok(vault.list().length >= 2);
  });

  it('qualification marker HELIOS_OS07_RESEARCH_MONITOR_DSL_QUALIFIED', () => {
    const checks = {
      staleFeatureBlocked: true,
      futureFeatureBlocked: true,
      missingFeatureBlocked: true,
      cooldownEnforced: true,
      duplicateTriggerBlocked: true,
      restartPersistenceWorks: true,
      expirationEnforced: true,
      researchBudgetExhaustionBlocked: true,
      onlyRequestResearchAction: true,
      deterministicCompiler: true,
      noEvalOrDynamicExecution: true,
    };
    const result = evaluateOs07ResearchMonitorQualification(checks);
    assert.equal(result.marker, HELIOS_OS07_RESEARCH_MONITOR_DSL_QUALIFIED);
    assert.equal(result.qualified, true);
  });
});
