import { Money, RoundingMode } from '../../../../money/src/money.ts';
import type { FinancialProposalActionType, GrowRiskProfile } from './taxonomy.ts';
import type { ProposalAlternative } from './types.ts';

export function buildAlternatives(input: {
  readonly actionType: FinancialProposalActionType;
  readonly amount: Money;
  readonly risk: GrowRiskProfile;
}): readonly ProposalAlternative[] {
  const items: ProposalAlternative[] = [
    Object.freeze({
      kind: 'KEEP_CASH',
      actionType: 'KEEP_CASH',
      label: 'Keep cash',
      amount: input.amount.toJSON(),
      risk: 'CONSERVATIVE',
      reason: 'Do not allocate. Cash remains available.',
    }),
    Object.freeze({
      kind: 'MOVE_PARTIAL',
      actionType: input.actionType === 'KEEP_CASH' ? 'ALLOCATE_TO_CASH_RESERVE' : input.actionType,
      label: 'Move only part',
      amount: input.amount.allocate(1n, 2n, RoundingMode.FLOOR).toJSON(),
      risk: input.risk,
      reason: 'Allocate half the proposed amount.',
    }),
    Object.freeze({
      kind: 'LOWER_RISK',
      actionType: input.actionType,
      label: 'Use a lower-risk option',
      amount: input.amount.toJSON(),
      risk: 'CONSERVATIVE',
      reason: 'Keep the amount but prefer the conservative sleeve.',
    }),
    Object.freeze({
      kind: 'DEFER',
      actionType: 'DEFER',
      label: 'Defer action',
      amount: Money.zero(input.amount.currency).toJSON(),
      risk: input.risk,
      reason: 'Take no action until the plan is reviewed again.',
    }),
  ];
  return Object.freeze(items);
}
