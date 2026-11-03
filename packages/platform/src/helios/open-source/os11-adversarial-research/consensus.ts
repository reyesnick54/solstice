import { RESEARCH_DEBATE_SCHEMA } from './taxonomy.ts';
import type {
  BearCase,
  BullCase,
  FrozenEvidencePack,
  ResearchConsensus,
  ResearchDisagreementMetric,
  ResearchSynthesis,
  RiskCase,
} from './types.ts';

export function buildResearchConsensus(input: {
  readonly pack: FrozenEvidencePack;
  readonly bullCase: BullCase;
  readonly bearCase: BearCase;
  readonly riskCase: RiskCase;
  readonly synthesis: ResearchSynthesis;
  readonly metric: ResearchDisagreementMetric;
}): ResearchConsensus {
  const fresh = input.pack.evidence.filter((row) => row.freshnessOk && row.entitlementOk);
  const stressed = input.pack.evidence.filter((row) => !row.freshnessOk || !row.entitlementOk);

  const bullClaims = input.bullCase.claims;
  const bearClaims = input.bearCase.claims;
  const lowConf = Math.min(
    ...[...bullClaims, ...bearClaims, ...input.riskCase.claims].map((row) => row.confidenceBps),
  );
  const highConf = Math.max(
    ...[...bullClaims, ...bearClaims, ...input.riskCase.claims].map((row) => row.confidenceBps),
  );

  const informationGaps = [
    ...input.riskCase.tailScenarios,
    ...input.bearCase.claims.filter((row) => row.evidenceIds.length === 0).map((row) => row.statement),
  ];

  const nextSteps: string[] = [];
  if (input.metric.informationValueHint === 'HIGH') {
    nextSteps.push('Commission targeted research on unresolved bull/bear claim pairs.');
    nextSteps.push('Refresh stale evidence before capital coordination.');
  } else if (input.metric.informationValueHint === 'MEDIUM') {
    nextSteps.push('Validate execution liquidity and mandate compatibility before sizing.');
  } else if (input.metric.lowValueDisagreement) {
    nextSteps.push('Do not run additional adversarial model rounds; disagreement is low-value.');
  } else {
    nextSteps.push('Monitor; no incremental research justified from disagreement alone.');
  }

  const keyUnknowns = Object.freeze([
    'Which invalidation path dominates under stress?',
    'Will admissible evidence remain fresh through the action window?',
  ]);

  return Object.freeze({
    schema: RESEARCH_DEBATE_SCHEMA,
    bullishEvidence: Object.freeze([...fresh]),
    bearishEvidence: Object.freeze([...stressed, ...input.pack.evidence.filter((row) => row.sourceKind === 'RISK_SIGNAL')]),
    keyUnknowns,
    disagreementScore: input.metric.disagreementScore,
    confidenceRange: Object.freeze({ lowBps: lowConf, highBps: highConf }),
    dominantRiskFactors: Object.freeze([...input.riskCase.dominantRiskFactors]),
    informationGaps: Object.freeze(informationGaps),
    suggestedResearchNextSteps: Object.freeze(nextSteps),
    evidenceRefs: Object.freeze([...input.pack.evidence]),
    pointsOfAgreement: Object.freeze([...input.synthesis.pointsOfAgreement]),
    pointsOfDisagreement: Object.freeze([...input.synthesis.pointsOfDisagreement]),
    consensusIsNotTruth: true as const,
  });
}
