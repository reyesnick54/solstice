import {
  HELIOS_EVOL08_FALSIFICATION_ENGINE_BLOCKED,
  HELIOS_EVOL08_FALSIFICATION_ENGINE_QUALIFIED,
  STRESS_CHALLENGER_KINDS,
} from './taxonomy.ts';
import type {
  FalsificationFinding,
  FalsificationGateResult,
  FalsificationQualificationResult,
  FragilityAssessment,
  StressCampaign,
} from './types.ts';

/** Shared floor for retained edge after stress (integer bps). */
export const MIN_EDGE_SURVIVAL_BPS = 5;

function campaignCoversAllChallengers(campaign: StressCampaign): FalsificationGateResult {
  const kinds = new Set(campaign.challenges.map((c) => c.kind));
  const expected = new Set(STRESS_CHALLENGER_KINDS);
  const missing = [...expected].filter((k) => !kinds.has(k));
  const extra = campaign.challenges.filter((c) => !expected.has(c.kind));
  if (missing.length === 0 && extra.length === 0 && campaign.challenges.length === STRESS_CHALLENGER_KINDS.length) {
    return {
      gateId: 'EVOL08_ALL_CHALLENGERS',
      passed: true,
      detail: 'Campaign includes exactly one challenge per required kind.',
    };
  }
  return {
    gateId: 'EVOL08_ALL_CHALLENGERS',
    passed: false,
    detail: `Missing kinds: ${missing.join(', ') || '(none)'}; unexpected entries: ${extra.map((e) => e.kind).join(', ') || '(none)'}.`,
  };
}

function noStressFalsification(findings: readonly FalsificationFinding[]): FalsificationGateResult {
  const failed = findings.filter((f) => f.falsified);
  if (failed.length === 0) {
    return {
      gateId: 'EVOL08_NO_STRESS_FALSIFICATION',
      passed: true,
      detail: 'No challenger drove retained edge below survival threshold.',
    };
  }
  return {
    gateId: 'EVOL08_NO_STRESS_FALSIFICATION',
    passed: false,
    detail: `Falsified by: ${failed.map((f) => f.kind).join(', ')}.`,
  };
}

function edgeSurvivalFloor(findings: readonly FalsificationFinding[]): FalsificationGateResult {
  const violated = findings.filter((f) => f.edgeRetainedBps < MIN_EDGE_SURVIVAL_BPS);
  if (violated.length === 0) {
    return {
      gateId: 'EVOL08_EDGE_SURVIVAL_FLOOR',
      passed: true,
      detail: `All challengers leave at least ${MIN_EDGE_SURVIVAL_BPS} bps retained edge.`,
    };
  }
  return {
    gateId: 'EVOL08_EDGE_SURVIVAL_FLOOR',
    passed: false,
    detail: `Below floor after: ${violated.map((f) => f.kind).join(', ')}.`,
  };
}

function structuralSoundness(fragility: FragilityAssessment): FalsificationGateResult {
  if (!fragility.structurallyFragile) {
    return {
      gateId: 'EVOL08_STRUCTURAL_SOUNDNESS',
      passed: true,
      detail: 'Concentration and threshold-perturbation checks did not indicate fragility.',
    };
  }
  return {
    gateId: 'EVOL08_STRUCTURAL_SOUNDNESS',
    passed: false,
    detail: 'Structural fragility detected (concentration or threshold sensitivity).',
  };
}

export function evaluateFalsificationQualification(input: {
  readonly campaign: StressCampaign;
  readonly findings: readonly FalsificationFinding[];
  readonly fragility: FragilityAssessment;
}): FalsificationQualificationResult {
  const gates: FalsificationGateResult[] = [
    campaignCoversAllChallengers(input.campaign),
    noStressFalsification(input.findings),
    edgeSurvivalFloor(input.findings),
    structuralSoundness(input.fragility),
  ];
  const structuralGatesOk = gates.every((g) => g.passed);
  const allStressChallengersTested = gates[0]?.passed ?? false;
  const marker = structuralGatesOk
    ? HELIOS_EVOL08_FALSIFICATION_ENGINE_QUALIFIED
    : HELIOS_EVOL08_FALSIFICATION_ENGINE_BLOCKED;

  return Object.freeze({
    marker,
    allStressChallengersTested,
    structuralGatesOk,
    gates: Object.freeze([...gates]),
  });
}
