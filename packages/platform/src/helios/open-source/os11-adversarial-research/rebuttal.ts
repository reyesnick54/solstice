import { MAX_REBUTTAL_ROUNDS } from './taxonomy.ts';
import type {
  BearCase,
  BullCase,
  CounterEvidenceChallenge,
  FrozenEvidencePack,
  RiskCase,
  StructuredResearchClaim,
} from './types.ts';

function topClaim(claims: readonly StructuredResearchClaim[]): StructuredResearchClaim | undefined {
  return [...claims].sort((a, b) => b.confidenceBps - a.confidenceBps)[0];
}

function challenge(
  prefix: string,
  target: StructuredResearchClaim,
  fromParticipant: CounterEvidenceChallenge['fromParticipant'],
  pack: FrozenEvidencePack,
  round: number,
  counterStatement: string,
  evidenceIds: readonly string[],
): CounterEvidenceChallenge {
  return Object.freeze({
    challengeId: `${prefix}_${target.claimId}`,
    targetClaimId: target.claimId,
    counterStatement,
    evidenceIds: Object.freeze([...evidenceIds]),
    fromParticipant,
    round,
  });
}

/**
 * One rebuttal round: each side responds to the strongest opposing claim using frozen evidence only.
 */
export function runRebuttalRound(input: {
  readonly pack: FrozenEvidencePack;
  readonly bullCase: BullCase;
  readonly bearCase: BearCase;
  readonly riskCase: RiskCase;
}): readonly CounterEvidenceChallenge[] {
  const round = MAX_REBUTTAL_ROUNDS;
  const rebuttals: CounterEvidenceChallenge[] = [];
  const bearTarget = topClaim(input.bullCase.claims);
  const bullTarget = topClaim(input.bearCase.claims);
  const fallbackEvidence = input.pack.evidence[0]?.evidenceId;

  if (bearTarget && bullTarget) {
    rebuttals.push(
      challenge(
        'bear_rebuttal',
        bullTarget,
        'BEAR_RESEARCH',
        input.pack,
        round,
        `Bear rebuttal: ${bullTarget.statement} overweights upside without invalidation checks.`,
        bullTarget.evidenceIds.length > 0 ? bullTarget.evidenceIds : fallbackEvidence ? [fallbackEvidence] : [],
      ),
    );
    rebuttals.push(
      challenge(
        'bull_rebuttal',
        bearTarget,
        'BULL_RESEARCH',
        input.pack,
        round,
        `Bull rebuttal: ${bearTarget.statement} may overstate downside if fresh inputs remain admissible.`,
        bearTarget.evidenceIds.length > 0 ? bearTarget.evidenceIds : fallbackEvidence ? [fallbackEvidence] : [],
      ),
    );
  }

  const riskTarget = topClaim(input.riskCase.claims);
  if (riskTarget && bearTarget) {
    rebuttals.push(
      challenge(
        'risk_rebuttal',
        bearTarget,
        'RISK_EVALUATOR',
        input.pack,
        round,
        `Risk rebuttal: tail scenarios remain even if bear claims are partially mitigated.`,
        riskTarget.evidenceIds,
      ),
    );
  }

  return Object.freeze(rebuttals);
}
