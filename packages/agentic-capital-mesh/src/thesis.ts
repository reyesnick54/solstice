import { createHash } from 'node:crypto';

import type { UtcInstant } from '../../domain/src/time.ts';
import { asCapitalScenarioId, asCapitalThesisId } from './ids.ts';
import { FORBIDDEN_OUTCOME_SEMANTICS, type CapitalScenario, type CapitalThesis, type ModelRef } from './types.ts';

export function createScenarios(input: {
  readonly downside: string;
  readonly base: string;
  readonly upside: string;
}): readonly CapitalScenario[] {
  return Object.freeze([
    Object.freeze({
      scenarioId: asCapitalScenarioId('cmsc_downside'),
      kind: 'DOWNSIDE' as const,
      narrative: input.downside,
      guaranteed: false as const,
    }),
    Object.freeze({
      scenarioId: asCapitalScenarioId('cmsc_base'),
      kind: 'BASE' as const,
      narrative: input.base,
      guaranteed: false as const,
    }),
    Object.freeze({
      scenarioId: asCapitalScenarioId('cmsc_upside'),
      kind: 'UPSIDE' as const,
      narrative: input.upside,
      guaranteed: false as const,
    }),
  ]);
}

export function createThesis(input: {
  readonly subjectId: string;
  readonly objective: string;
  readonly instrumentRefs: readonly string[];
  readonly horizon: string;
  readonly rationale: string;
  readonly sourceFacts: readonly string[];
  readonly assumptions: readonly string[];
  readonly expectedMechanism: string;
  readonly supportingEvidence: readonly string[];
  readonly contradictingEvidence: readonly string[];
  readonly riskFactors: readonly string[];
  readonly invalidationConditions: readonly string[];
  readonly scenarios: readonly CapitalScenario[];
  readonly modelRefs: readonly ModelRef[];
  readonly createdAt: UtcInstant;
}): CapitalThesis {
  for (const scenario of input.scenarios) {
    if ((FORBIDDEN_OUTCOME_SEMANTICS as readonly string[]).includes(scenario.kind)) {
      throw new Error('guaranteed outcome semantics are not valid');
    }
    if (scenario.guaranteed !== false) {
      throw new Error('scenario outcomes cannot be guaranteed');
    }
  }
  const id = asCapitalThesisId(
    `cmth_${createHash('sha256').update(`${input.subjectId}:${input.objective}:${input.createdAt}`).digest('hex').slice(0, 24)}`,
  );
  return Object.freeze({
    thesisId: id,
    subjectId: input.subjectId,
    objective: input.objective,
    instrumentRefs: Object.freeze([...input.instrumentRefs]),
    horizon: input.horizon,
    rationale: input.rationale,
    sourceFacts: Object.freeze([...input.sourceFacts]),
    assumptions: Object.freeze([...input.assumptions]),
    expectedMechanism: input.expectedMechanism,
    supportingEvidence: Object.freeze([...input.supportingEvidence]),
    contradictingEvidence: Object.freeze([...input.contradictingEvidence]),
    riskFactors: Object.freeze([...input.riskFactors]),
    invalidationConditions: Object.freeze([...input.invalidationConditions]),
    scenarioOutcomes: Object.freeze([...input.scenarios]),
    modelRefs: Object.freeze(input.modelRefs.map((ref) => Object.freeze({ ...ref }))),
    createdAt: input.createdAt,
    isTrade: false,
    guaranteedReturn: false,
  });
}
