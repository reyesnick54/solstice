import { createHash } from 'node:crypto';

import type { UtcInstant } from '../../../../domain/src/time.ts';
import { suitabilitySnapshotIdFor, type FinancialProposalId } from './ids.ts';
import type { GrowRiskProfile, SuitabilityDecision } from './taxonomy.ts';
import type { GrowMoneyAmount, GrowthProductActor, SuitabilitySnapshot } from './types.ts';

export function circumstanceHash(input: {
  readonly riskProfile: GrowRiskProfile;
  readonly timeHorizonMonths: number;
  readonly liquidityMinorUnits?: string;
  readonly jurisdiction: string;
  readonly verification: string;
  readonly restricted: boolean;
}): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        riskProfile: input.riskProfile,
        timeHorizonMonths: input.timeHorizonMonths,
        liquidityMinorUnits: input.liquidityMinorUnits ?? null,
        jurisdiction: input.jurisdiction,
        verification: input.verification,
        restricted: input.restricted,
      }),
    )
    .digest('hex');
}

export function freezeSuitability(input: {
  readonly proposalId: FinancialProposalId;
  readonly now: UtcInstant;
  readonly actor: GrowthProductActor;
  readonly riskProfile: GrowRiskProfile;
  readonly timeHorizonMonths: number;
  readonly liquidity?: GrowMoneyAmount;
  readonly denyUnsuitable?: boolean;
}): SuitabilitySnapshot {
  const hash = circumstanceHash({
    riskProfile: input.riskProfile,
    timeHorizonMonths: input.timeHorizonMonths,
    ...(input.liquidity ? { liquidityMinorUnits: input.liquidity.minorUnits } : {}),
    jurisdiction: input.actor.jurisdiction,
    verification: input.actor.verification,
    restricted: input.actor.restricted,
  });
  const decision = decide(input.actor, input.denyUnsuitable === true);
  return Object.freeze({
    snapshotId: suitabilitySnapshotIdFor(input.proposalId),
    frozenAt: input.now,
    riskProfile: input.riskProfile,
    timeHorizonMonths: input.timeHorizonMonths,
    ...(input.liquidity ? { liquidityRequirement: input.liquidity } : {}),
    jurisdiction: input.actor.jurisdiction,
    verification: input.actor.verification,
    restricted: input.actor.restricted,
    circumstanceHash: hash,
    decision,
    notes: Object.freeze(notesFor(decision, input.actor)),
  });
}

export function currentCircumstanceHash(
  actor: GrowthProductActor,
  snapshot: SuitabilitySnapshot,
): string {
  return circumstanceHash({
    riskProfile: snapshot.riskProfile,
    timeHorizonMonths: snapshot.timeHorizonMonths,
    ...(snapshot.liquidityRequirement ? { liquidityMinorUnits: snapshot.liquidityRequirement.minorUnits } : {}),
    jurisdiction: actor.jurisdiction,
    verification: actor.verification,
    restricted: actor.restricted,
  });
}

function decide(actor: GrowthProductActor, denyUnsuitable: boolean): SuitabilityDecision {
  if (denyUnsuitable || actor.restricted) {
    return 'UNSUITABLE';
  }
  if (actor.verification !== 'VERIFIED' && actor.verification !== 'ACTIVE') {
    return 'INSUFFICIENT_DATA';
  }
  return 'SUITABLE_SIMULATION';
}

function notesFor(decision: SuitabilityDecision, actor: GrowthProductActor): readonly string[] {
  if (decision === 'UNSUITABLE') {
    return actor.restricted
      ? ['Restricted actor cannot receive an investment allocation proposal.']
      : ['Policy marked this profile unsuitable for the proposed action.'];
  }
  if (decision === 'INSUFFICIENT_DATA') {
    return ['Verification is not complete. Suitability cannot be confirmed.'];
  }
  return ['Simulation suitability snapshot only. Not an investor-suitability determination for live markets.'];
}
