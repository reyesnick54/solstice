import {
  FORBIDDEN_AUTOMATIC_RESEARCH_ACTIONS,
  FORWARD_DEMOTION_TRIGGERS,
  HELIOS_ALPHA23_AUTOMATIC_DEMOTION_BLOCKED,
  HELIOS_ALPHA23_AUTOMATIC_DEMOTION_QUALIFIED,
} from './taxonomy.ts';
import { REQUIRED_CHANGE_DETECTORS as ALPHA11_DETECTORS } from '../alpha11/taxonomy.ts';
import { defaultForwardDemotionPolicy } from './forward-demotion-policy.ts';
import { evaluateResearchKillDecision } from './research-kill-decision.ts';
import { computeForwardStrategyHealth } from './forward-strategy-health.ts';
import type { ForwardStrategyHealthInput } from './types.ts';
import { asUtcInstant } from '@solstice/domain';

export type Alpha23QualificationResult = {
  readonly qualified: boolean;
  readonly marker:
    | typeof HELIOS_ALPHA23_AUTOMATIC_DEMOTION_QUALIFIED
    | typeof HELIOS_ALPHA23_AUTOMATIC_DEMOTION_BLOCKED;
  readonly blockers: readonly string[];
  readonly grantsFinancialAuthority: false;
  readonly permitsRiskIncrease: false;
};

export function evaluateAlpha23Qualification(): Alpha23QualificationResult {
  const blockers: string[] = [];
  const policy = defaultForwardDemotionPolicy();

  if (policy.permitsRiskIncrease !== false) blockers.push('policy_must_not_permit_risk_increase');
  if (policy.forbiddenAutomaticActions.length !== FORBIDDEN_AUTOMATIC_RESEARCH_ACTIONS.length) {
    blockers.push('forbidden_automatic_actions_incomplete');
  }
  if (FORWARD_DEMOTION_TRIGGERS.length < 10) blockers.push('demotion_triggers_incomplete');
  if (ALPHA11_DETECTORS.length < 3) {
    blockers.push('alpha11_detector_bridge_missing');
  }

  const sampleInput: ForwardStrategyHealthInput = Object.freeze({
    strategyId: 'str_alpha23_qualify',
    evaluatedAt: asUtcInstant('2026-06-01T00:00:00.000Z'),
    posture: 'PAPER',
    drawdownBps: 2_000,
    alphaConfidenceBps: 3_000,
  });
  const health = computeForwardStrategyHealth(sampleInput, policy);
  const decision = evaluateResearchKillDecision(health, policy);
  if (!decision.killRequired || decision.transition !== 'PAPER_TO_SHADOW') {
    blockers.push('paper_demotion_path_not_fail_closed');
  }
  if (!decision.failedEvidenceRetained) blockers.push('failed_evidence_not_retained');

  const qualified = blockers.length === 0;
  return Object.freeze({
    qualified,
    marker: qualified
      ? HELIOS_ALPHA23_AUTOMATIC_DEMOTION_QUALIFIED
      : HELIOS_ALPHA23_AUTOMATIC_DEMOTION_BLOCKED,
    blockers: Object.freeze(blockers),
    grantsFinancialAuthority: false,
    permitsRiskIncrease: false,
  });
}
