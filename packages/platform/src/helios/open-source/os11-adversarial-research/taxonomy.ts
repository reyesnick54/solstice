/**
 * HELIOS OS11 — TradingAgents-inspired adversarial research debate (simulation only).
 * Bull/bear/risk debate reduces confirmation bias; consensus is not truth.
 */

export const RESEARCH_DEBATE_SCHEMA = 'sunrey.helios.open-source.os11-research-debate.v1' as const;

export const HELIOS_OS11_ADVERSARIAL_RESEARCH_QUALIFIED =
  'HELIOS_OS11_ADVERSARIAL_RESEARCH_QUALIFIED' as const;

export const RESEARCH_DEBATE_PARTICIPANT_ROLES = [
  'BULL_RESEARCH',
  'BEAR_RESEARCH',
  'RISK_EVALUATOR',
  'SYNTHESIS',
] as const;

export type ResearchDebateParticipantRole = (typeof RESEARCH_DEBATE_PARTICIPANT_ROLES)[number];

export const RESEARCH_DEBATE_PHASES = [
  'EVIDENCE_FROZEN',
  'INITIAL_CASES',
  'CLAIM_EXCHANGE',
  'REBUTTAL',
  'SYNTHESIS',
  'CALIBRATED',
  'COMPLETED',
] as const;

export type ResearchDebatePhase = (typeof RESEARCH_DEBATE_PHASES)[number];

export const DEBATE_INFORMATION_VALUE_HINTS = ['HIGH', 'MEDIUM', 'LOW', 'NONE'] as const;
export type DebateInformationValueHint = (typeof DEBATE_INFORMATION_VALUE_HINTS)[number];

/** Maximum adversarial rebuttal rounds (process allows exactly one). */
export const MAX_REBUTTAL_ROUNDS = 1 as const;
