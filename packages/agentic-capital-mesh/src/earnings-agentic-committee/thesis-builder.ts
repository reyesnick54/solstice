import { createHash } from 'node:crypto';

import type { UtcInstant } from '../imports.ts';
import type { EarningsTimeHorizon } from './taxonomy.ts';
import type {
  AgentDisagreementMetric,
  EarningsInvestmentThesis,
  EarningsSpecialistArtifact,
  FrozenEarningsEvidencePack,
  ProbabilisticEarningsState,
} from './types.ts';

function disagreementMetric(artifacts: readonly EarningsSpecialistArtifact[]): AgentDisagreementMetric {
  const bull = artifacts.find((row) => row.role === 'BULL_EARNINGS');
  const bear = artifacts.find((row) => row.role === 'BEAR_EARNINGS');
  const pairs: string[] = [];
  if (bull && bear) {
    pairs.push('BULL_EARNINGS vs BEAR_EARNINGS');
  }
  const confSpread =
    artifacts.length > 1
      ? Math.max(...artifacts.map((row) => row.confidence)) -
        Math.min(...artifacts.map((row) => row.confidence))
      : 0;
  const score = Math.min(1, confSpread + pairs.length * 0.15);
  const unresolved = artifacts
    .flatMap((row) => row.contradictingEvidence)
    .slice(0, 5)
    .map((line) => line.slice(0, 120));
  return Object.freeze({
    score,
    opposingPairs: Object.freeze([...pairs]),
    unresolvedTopics: Object.freeze(unresolved),
  });
}

export function buildEarningsInvestmentThesis(input: {
  readonly workOrderId: string;
  readonly entity: string;
  readonly event: string;
  readonly timeHorizon: EarningsTimeHorizon;
  readonly informationTime: UtcInstant;
  readonly expirationTime: UtcInstant;
  readonly pack: FrozenEarningsEvidencePack;
  readonly probabilisticState: ProbabilisticEarningsState;
  readonly artifacts: readonly EarningsSpecialistArtifact[];
  readonly assignedCoverage: readonly string[];
}): EarningsInvestmentThesis {
  const bull = input.artifacts.find((row) => row.role === 'BULL_EARNINGS');
  const bear = input.artifacts.find((row) => row.role === 'BEAR_EARNINGS');
  const synthesis = input.artifacts.find((row) => row.role === 'EARNINGS_SYNTHESIS');
  const risk = input.artifacts.find((row) => row.role === 'RISK_EARNINGS');
  const forensic = input.artifacts.find((row) => row.role === 'FORENSIC_ACCOUNTING');

  const baseSummary =
    synthesis?.thesis ??
    `Base case for ${input.entity} ${input.event} from probabilistic state ${input.probabilisticState.stateId}.`;

  const keyDrivers = input.artifacts
    .filter((row) =>
      ['HARD_FINANCIALS', 'ANALYST_EXPECTATIONS', 'EARNINGS_QUALITY', 'PEER_READ_THROUGH'].includes(row.role),
    )
    .map((row) => row.thesis.slice(0, 140));

  const keyRisks = [
    ...(risk ? [risk.thesis.slice(0, 140)] : []),
    ...(forensic ? [forensic.thesis.slice(0, 140)] : []),
  ];

  const contradicting = input.artifacts.flatMap((row) => row.contradictingEvidence).slice(0, 12);
  const challenges = input.artifacts.flatMap((row) => row.challengesIssued).slice(0, 8);
  const unresolved = [...new Set([...contradicting, ...challenges])].slice(0, 10);

  const avgConfidence =
    input.artifacts.length > 0
      ? input.artifacts.reduce((sum, row) => sum + row.confidence, 0) / input.artifacts.length
      : 0.5;

  const thesisId = `eit_${createHash('sha256')
    .update(`${input.workOrderId}:${input.pack.contentHash}`)
    .digest('hex')
    .slice(0, 18)}`;

  return Object.freeze({
    thesisId,
    entity: input.entity,
    event: input.event,
    timeHorizon: input.timeHorizon,
    baseCase: Object.freeze({
      summary: baseSummary,
      keyPoints: Object.freeze(keyDrivers.slice(0, 4)),
      confidence: synthesis?.confidence ?? avgConfidence,
    }),
    bullCase: Object.freeze({
      summary: bull?.thesis ?? `No bull artifact; default neutral-positive framing for ${input.event}.`,
      keyPoints: Object.freeze(bull?.supportingEvidence.slice(0, 4) ?? []),
      confidence: bull?.confidence ?? 0.5,
    }),
    bearCase: Object.freeze({
      summary: bear?.thesis ?? `No bear artifact; downside path not fully articulated.`,
      keyPoints: Object.freeze(bear?.supportingEvidence.slice(0, 4) ?? []),
      confidence: bear?.confidence ?? 0.5,
    }),
    beatProbabilities: input.probabilisticState.beatProbabilities,
    guidanceProbabilities: input.probabilisticState.guidanceProbabilities,
    keyDrivers: Object.freeze(keyDrivers),
    keyRisks: Object.freeze(keyRisks),
    contradictingEvidence: Object.freeze(contradicting),
    unresolvedQuestions: Object.freeze(unresolved),
    agentDisagreement: disagreementMetric(input.artifacts),
    dataCoverage: Object.freeze([...input.assignedCoverage]),
    AAFQualification: Object.freeze({
      pointInTimeFrozen: true,
      simulationOnly: true as const,
      futureLeakRejected: true,
      note: 'Evidence pack hash frozen at committee start; simulation ENVIRONMENT only.',
    }),
    evidenceRefs: Object.freeze(input.pack.evidence.map((row) => row.evidenceId)),
    confidence: avgConfidence,
    uncertainty: `Committee uncertainty score ${input.probabilisticState.uncertaintyScore.toFixed(2)}; outputs are research intelligence only.`,
    expirationTime: input.expirationTime,
    grantsFinancialAuthority: false as const,
    issuesOrders: false as const,
  });
}
