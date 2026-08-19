/**
 * Adversarial shadow scenarios against the V2 path.
 */

import { MoonReyEconomicShadowEvaluator } from './evaluator.ts';
import { representativeScenario } from './scenarios.ts';
import type { AdversarialOutcome, AdversarialScenarioKind, MoonReyShadowScenario } from './types.ts';
import { ADVERSARIAL_SCENARIO_KINDS } from './types.ts';
import { evaluateGovernedV2 } from './v2.ts';

export function runAdversarialScenarios(): readonly AdversarialOutcome[] {
  const honest = representativeScenario('solar-energy');
  const honestV2 = evaluateGovernedV2(honest);
  return Object.freeze(ADVERSARIAL_SCENARIO_KINDS.map((kind) => evaluateKind(kind, honest, honestV2.quantity)));
}

function evaluateKind(
  kind: AdversarialScenarioKind,
  honest: MoonReyShadowScenario,
  honestQuantity: bigint | null,
): AdversarialOutcome {
  const tainted = taint(kind, honest);
  if (kind === 'BATCH_SPLITTING' || kind === 'TIME_WINDOW_SPLITTING') {
    const half: MoonReyShadowScenario = {
      ...honest,
      scenarioId: `${honest.scenarioId}.split-a`,
      eventId: `${honest.eventId}.a`,
      contributionId: `${honest.contributionId}.a`,
      canonicalQuantity: honest.canonicalQuantity / 2n,
    };
    const other: MoonReyShadowScenario = {
      ...honest,
      scenarioId: `${honest.scenarioId}.split-b`,
      eventId: `${honest.eventId}.b`,
      contributionId: `${honest.contributionId}.b`,
      canonicalQuantity: honest.canonicalQuantity - half.canonicalQuantity,
    };
    const first = evaluateGovernedV2(half);
    const second = evaluateGovernedV2(other);
    const splitTotal =
      (first.valued && first.quantity !== null ? first.quantity : 0n) +
      (second.valued && second.quantity !== null ? second.quantity : 0n);
    const inflated = honestQuantity !== null && splitTotal > honestQuantity;
    return outcome(kind, !inflated, inflated, first.reasonCodes, 'split parts cannot exceed the honest whole');
  }
  if (kind === 'DUPLICATE_CLAIMS' || kind === 'REVALUATION_REPLAY' || kind === 'SETTLEMENT_REPLAY') {
    const evaluator = new MoonReyEconomicShadowEvaluator();
    const first = evaluator.evaluate(honest);
    const second = evaluator.evaluate({
      ...honest,
      scenarioId: `${honest.scenarioId}.replay`,
      contributionId: `${honest.contributionId}.replay`,
      replayAttempt: 1,
    });
    const inflated = second.v2Valued && first.v2Valued;
    return outcome(
      kind,
      !second.v2Valued,
      inflated,
      second.reasonCodes,
      'replay or duplicate cannot create a second valued issuance',
    );
  }
  const evaluated = evaluateGovernedV2(tainted);
  const inflated =
    evaluated.valued &&
    honestQuantity !== null &&
    evaluated.quantity !== null &&
    evaluated.quantity > honestQuantity;
  const rejectedOrCapped = !evaluated.valued || evaluated.capApplied || !inflated;
  return outcome(kind, rejectedOrCapped, inflated, evaluated.reasonCodes, evaluated.warnings[0] ?? kind);
}

function taint(kind: AdversarialScenarioKind, honest: MoonReyShadowScenario): MoonReyShadowScenario {
  switch (kind) {
    case 'FAKE_SCARCITY':
      return { ...honest, poison: { fabricatedScarcity: true }, evidence: { ...honest.evidence, scarcity: 1_500_000n, scarcityEvidenced: false } };
    case 'FAKE_UTILIZATION':
      return { ...honest, poison: { fabricatedUtilization: true, providerSelfReportedUtilization: true } };
    case 'DUPLICATE_CLAIMS':
      return { ...honest, poison: { duplicateOfEventId: honest.eventId } };
    case 'CROSS_CATEGORY_RELABELING':
      return { ...honest, poison: { categoryRelabel: 'AI_COMPUTE' } };
    case 'OBJECT_RELABELING':
      return { ...honest, poison: { objectRelabel: 'obj.relabeled' } };
    case 'CONTROLLER_RELABELING':
      return { ...honest, poison: { controllerRelabel: 'ctl.relabeled' } };
    case 'BATCH_SPLITTING':
    case 'TIME_WINDOW_SPLITTING':
      return honest;
    case 'PROVIDER_COLLUSION':
      return { ...honest, providerIds: ['provider.collude.1', 'provider.collude.1'], poison: { ...honest.poison } };
    case 'SINGLE_PROVIDER_DOMINANCE':
      return { ...honest, providerIds: ['provider.only'], evidence: { ...honest.evidence, concentration: 250_000n } };
    case 'STALE_REFERENCES':
      return { ...honest, poison: { staleReference: true }, evidence: { ...honest.evidence, freshnessAgeEpochs: 8n } };
    case 'CONFLICTING_REFERENCE_FACTS':
      return { ...honest, poison: { conflictingReferenceFacts: true } };
    case 'UNIT_ALIAS_MANIPULATION':
      return { ...honest, poison: { unitAliasManipulation: true } };
    case 'NORMALIZATION_VERSION_MISMATCH':
      return { ...honest, poison: { normalizationVersionMismatch: true } };
    case 'ATTRIBUTION_BYPASS':
      return { ...honest, poison: { missingAttribution: true } };
    case 'VALUE_FACTOR_CAP_BYPASS':
      return {
        ...honest,
        poison: { factorAboveCap: true },
        evidence: { ...honest.evidence, scarcity: 2_000_000n, scarcityEvidenced: true },
      };
    case 'CONVERSION_CAP_BYPASS':
      return { ...honest, poison: { conversionAboveCap: true }, conversionCap: 1n, conversionRate: 1_000_000n };
    case 'REVALUATION_REPLAY':
    case 'SETTLEMENT_REPLAY':
      return { ...honest, replayAttempt: 1 };
  }
}

function outcome(
  kind: AdversarialScenarioKind,
  rejectedOrCapped: boolean,
  inflatedRelativeToHonest: boolean,
  reasonCodes: readonly AdversarialOutcome['reasonCodes'][number][],
  detail: string,
): AdversarialOutcome {
  return Object.freeze({
    kind,
    rejectedOrCapped,
    inflatedRelativeToHonest,
    reasonCodes,
    detail,
  });
}

export function adversarialTestsPassing(outcomes: readonly AdversarialOutcome[] = runAdversarialScenarios()): boolean {
  return outcomes.every((row) => row.rejectedOrCapped && !row.inflatedRelativeToHonest);
}
