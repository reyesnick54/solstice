import { createHash } from 'node:crypto';

import type { UtcInstant } from '../imports.ts';
import {
  COUNTERFACTUAL_CF13_QUESTIONS,
  COUNTERFACTUAL_CF13_SCHEMA,
  type CounterfactualCf13Artifact,
  type CounterfactualResearchThesis,
  type SupportDiagnostic,
  type CausalSupportClassification,
} from './types.ts';
import { thesisPassesLanguageGuard } from './artifact-validation.ts';

function hashSegment(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 12);
}

function mergeStrings(primary: string | undefined, fallback: string): string {
  const t = (primary ?? '').trim();
  return t.length > 0 ? t : fallback;
}

function mergeDiagnostics(artifacts: readonly CounterfactualCf13Artifact[]): readonly SupportDiagnostic[] {
  const out: SupportDiagnostic[] = [];
  for (const art of artifacts) {
    const rows = art.extraction?.supportDiagnostics;
    if (rows) out.push(...rows);
  }
  if (out.length > 0) return Object.freeze([...out]);
  return Object.freeze([
    { topic: 'evidence.coverage', status: 'WARN' as const, detail: 'Fixture-only reads; external validation not performed.' },
  ]);
}

function mergeContradictions(artifacts: readonly CounterfactualCf13Artifact[]): readonly string[] {
  const set = new Set<string>();
  for (const art of artifacts) {
    for (const c of art.extraction?.contradictions ?? []) {
      if (c.trim()) set.add(c.trim());
    }
  }
  return Object.freeze([...set]);
}

function dominantCausalClass(
  artifacts: readonly CounterfactualCf13Artifact[],
): CausalSupportClassification {
  const causal = artifacts.find((a) => a.role === 'CAUSAL_INFERENCE');
  if (causal?.extraction?.causalSupportClassification) {
    return causal.extraction.causalSupportClassification;
  }
  return 'AMBIGUOUS';
}

export function buildCounterfactualResearchThesis(input: {
  readonly workOrderId: string;
  readonly subjectId: string;
  readonly objective: string;
  readonly informationTime: UtcInstant;
  readonly artifacts: readonly CounterfactualCf13Artifact[];
}): CounterfactualResearchThesis {
  const skeptic = input.artifacts.find((a) => a.role === 'SKEPTIC');
  const synthesis = input.artifacts.find((a) => a.role === 'COUNTERFACTUAL_SYNTHESIS');

  const alternatives =
    synthesis?.extraction?.alternatives?.length
      ? synthesis.extraction.alternatives
      : input.artifacts.flatMap((a) => a.extraction?.alternatives ?? []).filter((row, i, arr) => arr.findIndex((x) => x.id === row.id) === i);

  const estimatorResults = synthesis?.extraction?.estimatorRows?.length
    ? synthesis.extraction.estimatorRows
    : input.artifacts.flatMap((a) => a.extraction?.estimatorRows ?? []);

  const distributionalResults = synthesis?.extraction?.distributionalRows?.length
    ? synthesis.extraction.distributionalRows
    : input.artifacts.flatMap((a) => a.extraction?.distributionalRows ?? []);

  const executionResults = synthesis?.extraction?.executionRows?.length
    ? synthesis.extraction.executionRows
    : input.artifacts.flatMap((a) => a.extraction?.executionRows ?? []);

  const factualOutcome = mergeStrings(
    synthesis?.extraction?.factualOutcomeFragment,
    `Factual path for "${input.objective}" is described only from approved HELIOS observation envelopes and mesh tool reads; no claim that a different policy would have produced a known dollar outcome.`,
  );

  const uncertainty = mergeStrings(
    synthesis?.extraction?.uncertaintyFragment ?? skeptic?.extraction?.uncertaintyFragment,
    'High — counterfactuals are not replayable histories; overlap, calibration, and regime stability are uncertain in simulation.',
  );

  const conclusion = mergeStrings(
    synthesis?.extraction?.conclusionFragment,
    'The committee does not certify a single counterfactual outcome. Compare alternatives under explicit assumptions, prioritize diagnostics, and treat any point estimate as a scenario label, not a promise.',
  );

  const thesisBody = [
    factualOutcome,
    ...alternatives.map((a) => a.label),
    ...estimatorResults.map((e) => e.estimatorFamily),
    conclusion,
  ].join('|');

  if (!thesisPassesLanguageGuard(thesisBody)) {
    throw new Error('LANGUAGE_GUARD_VIOLATION: thesis body failed definite-earnings guard');
  }

  const thesisId = `cf13_th_${hashSegment(`${input.workOrderId}:${input.subjectId}:${input.informationTime}`)}`;

  return Object.freeze({
    thesisId,
    schema: COUNTERFACTUAL_CF13_SCHEMA,
    workOrderId: input.workOrderId,
    subjectId: input.subjectId,
    factualOutcome,
    candidateAlternatives: Object.freeze([...alternatives]),
    estimatorResults: Object.freeze([...estimatorResults]),
    distributionalResults: Object.freeze([...distributionalResults]),
    executionResults: Object.freeze([...executionResults]),
    causalSupportClassification: dominantCausalClass(input.artifacts),
    uncertainty,
    contradictions: mergeContradictions(input.artifacts),
    supportDiagnostics: mergeDiagnostics(input.artifacts),
    conclusion,
    languageGuard: Object.freeze({
      forbidsDefiniteCounterfactualEarnings: true as const,
      note: 'Prohibited phrasing: any sentence that asserts HELIOS would, with certainty, have realized a specific profit under a counterfactual (see CF13 guard regex in artifact-validation).',
    }),
    grantsFinancialAuthority: false as const,
    issuesOrders: false as const,
  });
}

export function defaultCf13QuestionsCovered(): readonly (typeof COUNTERFACTUAL_CF13_QUESTIONS)[number][] {
  return Object.freeze([...COUNTERFACTUAL_CF13_QUESTIONS]);
}
