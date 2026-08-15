import { err, ok, type Result } from '../../../domain/src/result.ts';
import { asAccountId } from '../../../domain/src/account.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { Money } from '../../../money/src/money.ts';
import {
  ACTION_TYPES,
  type InternalTransferIntent,
} from '../../../permissions/src/action-types.ts';
import { asIntentId, PURPOSE_CODES, type ActionIntent } from '../../../permissions/src/action-intent.ts';
import type { GrowthActionCandidate } from './types.ts';

export type MaterializeFailure = {
  readonly code:
    | 'UNSUPPORTED_ACTION'
    | 'INVESTMENT_NOT_IMPLEMENTED'
    | 'NOT_APPROVED'
    | 'MISSING_ACCOUNTS'
    | 'PROHIBITED'
    | 'DEPENDENCY_NOT_IMPLEMENTED';
  readonly message: string;
};

const MATERIALIZABLE = new Set([
  'ALLOCATE_TO_EMERGENCY_RESERVE',
  'MOVE_IDLE_CASH_BETWEEN_EXISTING_ELIGIBLE_ACCOUNTS',
]);

/**
 * Safe future bridge. Builds a canonical ActionIntent only.
 * Does not submit to the Kernel, post journals, or issue authority.
 */
export function materializeGrowthAction(input: {
  readonly candidate: GrowthActionCandidate;
  readonly approved: boolean;
  readonly actorId: string;
  readonly requestedAt: string;
}): Result<ActionIntent, MaterializeFailure> {
  const candidate = input.candidate;
  if (!input.approved) {
    return err({ code: 'NOT_APPROVED', message: 'ActionIntent materialization requires explicit approval' });
  }
  if (candidate.action === 'REVIEW_INVESTMENT_OPPORTUNITY_FUTURE') {
    return err({
      code: 'INVESTMENT_NOT_IMPLEMENTED',
      message: 'unsupported investment action cannot materialize an ActionIntent',
    });
  }
  if (
    candidate.executionCapability === 'DEPENDENCY_NOT_IMPLEMENTED' ||
    candidate.executionCapability === 'PROPOSAL_ONLY' ||
    candidate.executionCapability === 'INFORMATION_ONLY' ||
    candidate.executionCapability === 'HUMAN_REVIEW_REQUIRED' ||
    candidate.executionCapability === 'PROHIBITED'
  ) {
    return err({
      code: candidate.executionCapability === 'PROHIBITED' ? 'PROHIBITED' : 'UNSUPPORTED_ACTION',
      message: `execution capability ${candidate.executionCapability} cannot materialize an ActionIntent`,
    });
  }
  if (!MATERIALIZABLE.has(candidate.action)) {
    return err({ code: 'UNSUPPORTED_ACTION', message: `${candidate.action} cannot materialize an ActionIntent` });
  }
  if (!candidate.sourceAccountId || !candidate.destinationAccountId || !candidate.proposedAmount) {
    return err({ code: 'MISSING_ACCOUNTS', message: 'materialization requires two existing eligible accounts and an amount' });
  }
  const amount = Money.fromMinorUnitsString(
    candidate.proposedAmount.minorUnits,
    candidate.proposedAmount.currency,
  );
  const intent: InternalTransferIntent = {
    id: asIntentId(`I-growth-${candidate.actionId}`),
    actionType: ACTION_TYPES.INTERNAL_TRANSFER,
    payload: {
      sourceAccountId: asAccountId(candidate.sourceAccountId),
      destinationAccountId: asAccountId(candidate.destinationAccountId),
      amount,
    },
    idempotencyKey: `growth:${candidate.actionId}`,
    actorId: input.actorId,
    requestedAt: asUtcInstant(input.requestedAt),
    purpose: PURPOSE_CODES[3],
  };
  return ok(intent);
}
