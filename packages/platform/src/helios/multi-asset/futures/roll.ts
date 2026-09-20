/**
 * M03 — futures roll state and front-contract resolution.
 */

import { asUtcInstant, type UtcInstant } from '../../../../../domain/src/time.ts';
import type { FuturesContractIdentity, RollContext, RollState } from './types.ts';

const MS_PER_DAY = 86_400_000;

export type RollEvaluationInput = {
  readonly familyId: string;
  readonly contracts: readonly FuturesContractIdentity[];
  readonly nowUtc: UtcInstant;
  readonly rollDaysBeforeExpiration?: number;
};

function daysBetween(from: UtcInstant, to: UtcInstant): number {
  return Math.floor((Date.parse(to) - Date.parse(from)) / MS_PER_DAY);
}

function sortByExpiration(contracts: readonly FuturesContractIdentity[]): FuturesContractIdentity[] {
  return [...contracts].sort(
    (a, b) => Date.parse(a.metadata.expirationDate) - Date.parse(b.metadata.expirationDate),
  );
}

export function resolveFrontContract(
  contracts: readonly FuturesContractIdentity[],
  nowUtc: UtcInstant,
): FuturesContractIdentity | null {
  const active = sortByExpiration(contracts).filter(
    (contract) => Date.parse(contract.metadata.lastTradeDate) >= Date.parse(nowUtc),
  );
  return active[0] ?? null;
}

export function resolveBackContract(
  contracts: readonly FuturesContractIdentity[],
  front: FuturesContractIdentity,
): FuturesContractIdentity | null {
  const sorted = sortByExpiration(contracts);
  const frontIndex = sorted.findIndex((c) => c.contractId === front.contractId);
  if (frontIndex < 0 || frontIndex + 1 >= sorted.length) {
    return null;
  }
  return sorted[frontIndex + 1] ?? null;
}

export function evaluateRollState(input: RollEvaluationInput): RollContext {
  const rollDays = input.rollDaysBeforeExpiration ?? 5;
  const front = resolveFrontContract(input.contracts, input.nowUtc);
  if (!front) {
    return Object.freeze({
      familyId: input.familyId,
      rollState: 'POST_ROLL',
      frontContractId: '',
      backContractId: null,
      rollWindowStart: null,
      rollWindowEnd: null,
      evaluatedAt: input.nowUtc,
    });
  }

  const back = resolveBackContract(input.contracts, front);
  const daysToExpiration = daysBetween(input.nowUtc, front.metadata.expirationDate);

  let rollState: RollState = 'FRONT';
  let rollWindowStart: UtcInstant | null = null;
  let rollWindowEnd: UtcInstant | null = null;

  if (daysToExpiration <= rollDays && back) {
    rollState = 'ROLLING';
    rollWindowStart = asUtcInstant(
      new Date(Date.parse(front.metadata.expirationDate) - rollDays * MS_PER_DAY).toISOString(),
    );
    rollWindowEnd = front.metadata.expirationDate;
  } else if (daysToExpiration <= 0) {
    rollState = back ? 'POST_ROLL' : 'POST_ROLL';
  } else if (back && daysToExpiration <= rollDays * 2) {
    rollState = 'BACK';
  }

  return Object.freeze({
    familyId: input.familyId,
    rollState,
    frontContractId: front.contractId,
    backContractId: back?.contractId ?? null,
    rollWindowStart,
    rollWindowEnd,
    evaluatedAt: input.nowUtc,
  });
}

export function resolveExecutableContract(
  rollContext: RollContext,
  requestedContractId?: string,
): { readonly ok: true; readonly contractId: string } | { readonly ok: false; readonly code: string; readonly message: string } {
  if (requestedContractId) {
    if (requestedContractId.includes(':CONTINUOUS')) {
      return Object.freeze({
        ok: false,
        code: 'CONTINUOUS_SERIES_NON_EXECUTABLE',
        message: 'synthetic continuous futures series cannot receive Execution Authority',
      });
    }
    return Object.freeze({ ok: true, contractId: requestedContractId });
  }
  if (!rollContext.frontContractId) {
    return Object.freeze({
      ok: false,
      code: 'NO_FRONT_CONTRACT',
      message: 'no active front contract available for execution resolution',
    });
  }
  return Object.freeze({ ok: true, contractId: rollContext.frontContractId });
}
