import { assertEvidencePackUnchanged, freezeEvidencePack } from './evidence-pack.ts';
import { computeResearchDisagreementMetric } from './calibration.ts';
import { buildResearchConsensus } from './consensus.ts';
import {
  buildBearCase,
  buildBullCase,
  buildRiskCase,
  defaultDebateParticipants,
} from './participants.ts';
import { runRebuttalRound } from './rebuttal.ts';
import { synthesizeResearchDebate } from './synthesis.ts';
import type { ResearchDebate, ResearchDebateInput } from './types.ts';

/**
 * Native HELIOS adversarial research process (TradingAgents bull/bear/risk pattern, deterministic simulation).
 */
export function runResearchDebate(input: ResearchDebateInput): ResearchDebate {
  const frozenEvidencePack = freezeEvidencePack({
    packId: `evpack_${input.debateId}`,
    evidence: input.evidence,
    frozenAt: input.now,
  });

  const bullCase = buildBullCase(frozenEvidencePack, input.objective);
  const bearCase = buildBearCase(frozenEvidencePack, input.objective);
  const riskCase = buildRiskCase(frozenEvidencePack, input.objective);

  assertEvidencePackUnchanged(frozenEvidencePack, input.evidence);

  const rebuttals = runRebuttalRound({ pack: frozenEvidencePack, bullCase, bearCase, riskCase });
  const synthesis = synthesizeResearchDebate({ bullCase, bearCase, riskCase, rebuttals });
  const disagreementMetric = computeResearchDisagreementMetric({ bullCase, bearCase, riskCase });
  const consensus = buildResearchConsensus({
    pack: frozenEvidencePack,
    bullCase,
    bearCase,
    riskCase,
    synthesis,
    metric: disagreementMetric,
  });

  return Object.freeze({
    debateId: input.debateId,
    workOrderId: input.workOrderId,
    subjectId: input.subjectId,
    objective: input.objective,
    schema: consensus.schema,
    phase: 'COMPLETED',
    frozenEvidencePack,
    participants: defaultDebateParticipants(),
    bullCase,
    bearCase,
    riskCase,
    rebuttals,
    synthesis,
    disagreementMetric,
    consensus,
    completedAt: input.now,
    grantsFinancialAuthority: false as const,
  });
}
