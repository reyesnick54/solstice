/**
 * Bounded deterministic scenario sweeps. Keep CI runtime small.
 */

import { MoonReyEconomicShadowEvaluator } from './evaluator.ts';
import { representativeScenario } from './scenarios.ts';
import type { MoonReyShadowScenario, MoonReyValuePathComparison } from './types.ts';

export type StressSweepReport = {
  readonly cases: number;
  readonly valuedV2: number;
  readonly unvaluedV2: number;
  readonly supplyMutated: false;
  readonly comparisons: readonly MoonReyValuePathComparison[];
};

export function runBoundedStressSweep(): StressSweepReport {
  const evaluator = new MoonReyEconomicShadowEvaluator();
  const cases = stressCases();
  const comparisons = evaluator.evaluateMany(cases);
  return Object.freeze({
    cases: cases.length,
    valuedV2: comparisons.filter((row) => row.v2Valued).length,
    unvaluedV2: comparisons.filter((row) => !row.v2Valued).length,
    supplyMutated: false,
    comparisons,
  });
}

export function stressCases(): readonly MoonReyShadowScenario[] {
  const base = representativeScenario('solar-energy');
  const cases: MoonReyShadowScenario[] = [
    { ...base, scenarioId: 'stress.high-quantity', eventId: 'event.stress.high', contributionId: 'c.stress.high', canonicalQuantity: 9_000_000_000_000n },
    { ...base, scenarioId: 'stress.tiny-quantity', eventId: 'event.stress.tiny', contributionId: 'c.stress.tiny', canonicalQuantity: 1n },
    { ...base, scenarioId: 'stress.max-quality', eventId: 'event.stress.maxq', contributionId: 'c.stress.maxq', evidence: { ...base.evidence, quality: 1_000_000n } },
    { ...base, scenarioId: 'stress.min-quality', eventId: 'event.stress.minq', contributionId: 'c.stress.minq', evidence: { ...base.evidence, quality: 0n } },
    { ...base, scenarioId: 'stress.zero-attribution', eventId: 'event.stress.zero-attr', contributionId: 'c.stress.zero-attr', attributionShare: { numerator: 0n, denominator: 1_000_000n } },
    { ...base, scenarioId: 'stress.partial-attribution', eventId: 'event.stress.partial-attr', contributionId: 'c.stress.partial-attr', attributionShare: { numerator: 250_000n, denominator: 1_000_000n } },
    { ...base, scenarioId: 'stress.full-attribution', eventId: 'event.stress.full-attr', contributionId: 'c.stress.full-attr', attributionShare: { numerator: 1_000_000n, denominator: 1_000_000n } },
    { ...base, scenarioId: 'stress.strict-cap', eventId: 'event.stress.cap', contributionId: 'c.stress.cap', conversionCap: 100n, v1MaximumIssuance: 100n },
    { ...base, scenarioId: 'stress.multi-controller-a', eventId: 'event.stress.ctl.a', contributionId: 'c.stress.ctl.a', controllerId: 'ctl.a', objectId: 'obj.a' },
    { ...base, scenarioId: 'stress.multi-controller-b', eventId: 'event.stress.ctl.b', contributionId: 'c.stress.ctl.b', controllerId: 'ctl.b', objectId: 'obj.b' },
    { ...base, scenarioId: 'stress.multi-provider', eventId: 'event.stress.providers', contributionId: 'c.stress.providers', providerIds: ['p.1', 'p.2', 'p.3'] },
    { ...base, scenarioId: 'stress.conflict-group', eventId: 'event.stress.conflict', contributionId: 'c.stress.conflict', poison: { conflictingReferenceFacts: true } },
    { ...base, scenarioId: 'stress.stale', eventId: 'event.stress.stale', contributionId: 'c.stress.stale', evidence: { ...base.evidence, freshnessAgeEpochs: 7n }, poison: { staleReference: true } },
    { ...base, scenarioId: 'stress.batch-lineage', eventId: 'event.stress.batch', contributionId: 'c.stress.batch', batchLineage: ['batch.1', 'batch.2', 'batch.3', 'batch.4'] },
  ];
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    cases.push({
      ...base,
      scenarioId: `stress.replay.${String(attempt)}`,
      eventId: 'event.stress.replay-same',
      contributionId: `c.stress.replay.${String(attempt)}`,
      replayAttempt: attempt,
    });
  }
  return Object.freeze(cases);
}
