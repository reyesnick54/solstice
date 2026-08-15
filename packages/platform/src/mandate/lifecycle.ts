import { err, ok, type Result } from '../../../domain/src/result.ts';
import { MANDATE_STATES, type MandateState } from './taxonomy.ts';

const ALLOWED: Readonly<Record<MandateState, readonly MandateState[]>> = {
  DRAFT: ['AWAITING_CONFIRMATION', 'REVOKED'],
  AWAITING_CONFIRMATION: ['ACTIVE', 'DRAFT', 'REVOKED'],
  ACTIVE: ['PAUSED', 'REVOKED', 'SUPERSEDED', 'EXPIRED'],
  PAUSED: ['ACTIVE', 'REVOKED', 'SUPERSEDED'],
  SUPERSEDED: [],
  REVOKED: [],
  EXPIRED: [],
};

export type MandateTransitionFailure = {
  readonly code: 'INVALID_MANDATE_TRANSITION';
  readonly message: string;
  readonly from: MandateState;
  readonly to: MandateState;
};

export function canTransitionMandate(from: MandateState, to: MandateState): boolean {
  return ALLOWED[from].includes(to);
}

export function transitionMandate(
  from: MandateState,
  to: MandateState,
): Result<MandateState, MandateTransitionFailure> {
  if (!canTransitionMandate(from, to)) {
    return err({
      code: 'INVALID_MANDATE_TRANSITION',
      message: `mandate cannot move from ${from} to ${to}`,
      from,
      to,
    });
  }
  return ok(to);
}

export function isActiveMandate(state: MandateState): boolean {
  return state === 'ACTIVE';
}

export function isTerminalMandate(state: MandateState): boolean {
  return state === 'SUPERSEDED' || state === 'REVOKED' || state === 'EXPIRED';
}

export function isMandateState(value: string): value is MandateState {
  return (MANDATE_STATES as readonly string[]).includes(value);
}
