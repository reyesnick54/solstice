import { Money } from '../../../money/src/money.ts';
import type { SerializedMoney } from '../../../personal-economic-graph/src/taxonomy.ts';
import { savingsOpportunityIdFor } from './ids.ts';
import type {
  DuplicationEvidence,
  RecurringObligation,
  SavingsOpportunity,
  UsageSignal,
} from './models.ts';
import type { ActionCapabilityLevel, SavingsOpportunityType, SubscriptionActionType } from './taxonomy.ts';

function monthlyEquivalent(amount: SerializedMoney, frequency: RecurringObligation['frequency']): Money {
  const base = Money.fromMinorUnitsString(amount.minorUnits, amount.currency);
  switch (frequency) {
    case 'WEEKLY':
      return base.allocate(52n, 12n);
    case 'BIWEEKLY':
      return base.allocate(26n, 12n);
    case 'MONTHLY':
    case 'VARIABLE':
      return base;
    case 'QUARTERLY':
      return base.allocate(1n, 3n);
    case 'YEARLY':
      return base.allocate(1n, 12n);
  }
}

function annualFromMonthly(monthly: Money): Money {
  return monthly.allocate(12n, 1n);
}

function opportunityFor(
  obligation: RecurringObligation,
  opportunityType: SavingsOpportunityType,
  recommendedAction: SubscriptionActionType,
  providerCapability: ActionCapabilityLevel,
  evidence: readonly string[],
  estimatedNewCost: SerializedMoney | null,
): SavingsOpportunity {
  const monthly = monthlyEquivalent(obligation.amount, obligation.frequency);
  const estimatedNew = estimatedNewCost
    ? monthlyEquivalent(estimatedNewCost, obligation.frequency)
    : Money.zero(obligation.currency);
  const savings = estimatedNewCost ? monthly.minus(estimatedNew) : monthly;
  const annual = annualFromMonthly(savings.isNegative() ? Money.zero(obligation.currency) : savings);

  return Object.freeze({
    opportunityId: savingsOpportunityIdFor(obligation.id, opportunityType),
    recurringObligationId: obligation.id,
    opportunityType,
    currentCost: monthly.toJSON(),
    estimatedNewCost: estimatedNewCost,
    estimatedMonthlySavings: savings.isNegative() ? null : savings.toJSON(),
    estimatedAnnualSavings: savings.isNegative() ? null : annual.toJSON(),
    confidence: obligation.confidence,
    evidence: Object.freeze(evidence),
    recommendedAction,
    providerCapability,
    userApprovalRequired: true,
    savingsKind: 'ESTIMATED',
  });
}

/**
 * Build savings opportunities from obligations, duplicates, and usage signals.
 * Estimated savings are never presented as verified.
 */
export function buildSavingsOpportunities(input: {
  readonly obligations: readonly RecurringObligation[];
  readonly duplicates: readonly DuplicationEvidence[];
  readonly usageSignals?: readonly UsageSignal[];
}): readonly SavingsOpportunity[] {
  const opportunities: SavingsOpportunity[] = [];
  const usageByObligation = new Map(
    (input.usageSignals ?? []).map((signal) => [signal.obligationId, signal]),
  );

  for (const obligation of input.obligations) {
    if (obligation.status !== 'ACTIVE') {
      continue;
    }

    const usage = usageByObligation.get(obligation.id);
    if (usage && (usage.usageLevel === 'NONE' || usage.usageLevel === 'LOW')) {
      opportunities.push(
        opportunityFor(
          obligation,
          'CANCEL_UNUSED',
          'CANCEL',
          obligation.actionCapabilities.cancel,
          Object.freeze([
            `Usage signal: ${usage.usageLevel}`,
            `Recurring cost: ${obligation.amount.minorUnits} ${obligation.amount.currency}`,
          ]),
          null,
        ),
      );
    }

    if (obligation.priceChange && obligation.priceChange.percentageChangeBps >= 500) {
      opportunities.push(
        opportunityFor(
          obligation,
          'REVIEW_PRICE_INCREASE',
          'REVIEW',
          'ADVISORY_ONLY',
          Object.freeze([
            `Price increased from ${obligation.priceChange.previousAmount.minorUnits} to ${obligation.priceChange.currentAmount.minorUnits}`,
            `Change: ${obligation.priceChange.percentageChangeBps} bps`,
          ]),
          obligation.priceChange.previousAmount,
        ),
      );
    }

    if (!obligation.cancellable && obligation.category === 'TELECOMMUNICATIONS') {
      opportunities.push(
        opportunityFor(
          obligation,
          'RENEGOTIATE_BILL',
          'RENEGOTIATE',
          obligation.actionCapabilities.renegotiate,
          Object.freeze(['Telecommunications bill may be negotiable']),
          null,
        ),
      );
    }
  }

  for (const duplicate of input.duplicates) {
    const first = input.obligations.find((item) => item.id === duplicate.obligationIds[0]);
    if (!first) {
      continue;
    }
    opportunities.push(
      opportunityFor(
        first,
        'REVIEW_DUPLICATE',
        'REVIEW',
        'ADVISORY_ONLY',
        duplicate.evidence,
        null,
      ),
    );
  }

  return Object.freeze(opportunities);
}
