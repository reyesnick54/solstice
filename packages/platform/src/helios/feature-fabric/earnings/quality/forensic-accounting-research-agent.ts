import type { UtcInstant } from '@solstice/domain';
import { FORENSIC_ACCOUNTING_RESEARCH_AGENT_NAME } from './taxonomy.ts';
import type {
  EarningsQualityScorecard,
  ForensicAccountingResearchBrief,
  ForensicAccountingResearchChallenge,
  ForensicChangeDetectorResult,
  ForensicHypothesis,
} from './types.ts';

export type ForensicAccountingResearchAgentInput = {
  readonly workOrderId: string;
  readonly subjectId: string;
  readonly evaluationTime: UtcInstant;
  readonly scorecard: EarningsQualityScorecard;
  readonly forensic: ForensicChangeDetectorResult;
  readonly bullishCase?: string | null;
  readonly bearishCase?: string | null;
};

function challengeForHypothesis(
  target: ForensicAccountingResearchChallenge['target'],
  hyp: ForensicHypothesis,
  caseText: string | null | undefined,
): ForensicAccountingResearchChallenge {
  const stance = target === 'BULLISH' ? 'bullish' : 'bearish';
  return Object.freeze({
    target,
    prompt: caseText
      ? `Given the ${stance} case ("${caseText.slice(0, 240)}"), explain why "${hyp.summary}" does or does not undermine the thesis. Cite filing evidence; avoid conclusory language.`
      : `Stress-test the ${stance} case against: ${hyp.summary} (${hyp.signalClass}).`,
    linkedHypothesisIds: Object.freeze([hyp.hypothesisId]),
  });
}

function unfavorableDimensions(scorecard: EarningsQualityScorecard): readonly string[] {
  return Object.freeze(
    scorecard.dimensions.filter((d) => d.interpretation === 'UNFAVORABLE').map((d) => d.label),
  );
}

export function runForensicAccountingResearchAgent(
  input: ForensicAccountingResearchAgentInput,
): ForensicAccountingResearchBrief {
  const hypotheses = input.forensic.hypotheses;
  const challenges: ForensicAccountingResearchChallenge[] = [];

  for (const hyp of hypotheses) {
    challenges.push(challengeForHypothesis('BULLISH', hyp, input.bullishCase));
    challenges.push(challengeForHypothesis('BEARISH', hyp, input.bearishCase));
  }

  const weakDims = unfavorableDimensions(input.scorecard);
  if (weakDims.length > 0) {
    challenges.push(
      Object.freeze({
        target: 'BULLISH',
        prompt: `Bull case must address unfavorable scorecard dimensions: ${weakDims.join(', ')}.`,
        linkedHypothesisIds: Object.freeze([]),
      }),
    );
    challenges.push(
      Object.freeze({
        target: 'BEARISH',
        prompt: `Bear case should not over-weight dimensions already flagged favorable without new evidence. Review: ${weakDims.join(', ')}.`,
        linkedHypothesisIds: Object.freeze([]),
      }),
    );
  }

  if (challenges.length === 0) {
    challenges.push(
      Object.freeze({
        target: 'BULLISH',
        prompt: 'No forensic hypotheses fired — bull case still requires cash conversion and accrual quality support from filings.',
        linkedHypothesisIds: Object.freeze([]),
      }),
      Object.freeze({
        target: 'BEARISH',
        prompt: 'No forensic hypotheses fired — bear case must identify independent risks beyond absence of detected divergences.',
        linkedHypothesisIds: Object.freeze([]),
      }),
    );
  }

  const openResearchQuestions = Object.freeze([
    ...hypotheses.filter((h) => h.signalClass === 'REQUIRES_RESEARCH').map((h) => h.detail),
    ...hypotheses.filter((h) => h.signalClass === 'DIVERGENCE').map((h) => `Reconcile divergence: ${h.summary}`),
    ...hypotheses.filter((h) => h.signalClass === 'ANOMALY').map((h) => `Validate anomaly drivers: ${h.summary}`),
  ]);

  return Object.freeze({
    agentName: FORENSIC_ACCOUNTING_RESEARCH_AGENT_NAME,
    workOrderId: input.workOrderId,
    subjectId: input.subjectId,
    evaluationTime: input.evaluationTime,
    scorecardPeriod: input.scorecard.fiscalPeriod,
    challenges: Object.freeze(challenges),
    openResearchQuestions,
    grantsExecutionAuthority: false,
    issuesOrders: false,
  });
}

export { FORENSIC_ACCOUNTING_RESEARCH_AGENT_NAME };
