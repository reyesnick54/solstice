// @ts-nocheck
import { Money } from '../../../money/src/money.ts';
import type { SerializedMoney } from '../../../personal-economic-graph/src/taxonomy.ts';
import type { RecurringObligation, SavingsOpportunity, SubscriptionActionProposal, VerifiedSavings } from './models.ts';
import type { SavingsKind } from './taxonomy.ts';

export function estimatedSavingsFromOpportunity(opportunity: SavingsOpportunity): {
  readonly kind: 'ESTIMATED';
  readonly monthly: SerializedMoney | null;
  readonly annual: SerializedMoney | null;
} {
  return Object.freeze({
    kind: 'ESTIMATED',
    monthly: opportunity.estimatedMonthlySavings,
    annual: opportunity.estimatedAnnualSavings,
  });
}

export function expectedSavingsFromOpportunity(opportunity: SavingsOpportunity): {
  readonly kind: 'EXPECTED';
  readonly monthly: SerializedMoney | null;
  readonly annual: SerializedMoney | null;
} {
  return Object.freeze({
    kind: 'EXPECTED',
    monthly: opportunity.estimatedMonthlySavings,
    annual: opportunity.estimatedAnnualSavings,
  });
}

/**
 * Verified savings require confirmed action with provider evidence.
 */
export function attributeVerifiedSavings(input: {
  readonly obligation: RecurringObligation;
  readonly opportunity: SavingsOpportunity;
  readonly action: SubscriptionActionProposal;
  readonly verifiedAt: string;
}): VerifiedSavings | null {
  if (!input.action.actionConfirmed || !input.action.providerEvidenceRef) {
    return null;
  }
  const monthly = input.opportunity.estimatedMonthlySavings;
  if (!monthly) {
    return null;
  }
  const monthlyMoney = Money.fromMinorUnitsString(monthly.minorUnits, monthly.currency);
  const annualMoney = monthlyMoney.allocate(12n, 1n);
  return Object.freeze({
    obligationId: input.obligation.id,
    actionId: input.action.actionId,
    kind: 'VERIFIED' satisfies SavingsKind,
    monthlyAmount: monthlyMoney.toJSON(),
    annualAmount: annualMoney.toJSON(),
    verifiedAt: input.verifiedAt,
    providerEvidenceRef: input.action.providerEvidenceRef,
  });
}

export function savingsMustNotBePresentedAsVerified(kind: SavingsKind): boolean {
  return kind === 'ESTIMATED' || kind === 'EXPECTED';
}
