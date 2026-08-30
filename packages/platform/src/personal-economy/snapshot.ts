import type { UtcInstant } from '../../../domain/src/time.ts';
import type { SerializedMoney } from '../mandate/types.ts';
import type { PersonalEconomySnapshotId } from './ids.ts';

export type TokenHoldingSummary = {
  readonly assetId: 'SUNREY_COIN' | 'MOONREY_COIN';
  readonly label: string;
  readonly quantityMinorUnits: string;
  readonly valuationCurrency: string | null;
  readonly estimatedValueMinorUnits: string | null;
  readonly authoritativeBalance: false;
  readonly simulationOnly: true;
};

export type AccessEntitlementSummary = {
  readonly category: string;
  readonly label: string;
  readonly remainingUnits: number;
  readonly expiresAt: UtcInstant | null;
  readonly reservationRef: string | null;
};

export type AccessDemandSummary = {
  readonly category: string;
  readonly label: string;
  readonly plannedUnits: number;
  readonly targetWindow: string;
  readonly premiumTopUpRequiredMinorUnits: string | null;
  readonly currency: string | null;
};

export type ContributionOpportunitySummary = {
  readonly opportunityId: string;
  readonly kind: 'HUMAN_DATA' | 'PRODUCTIVE_CAPACITY';
  readonly title: string;
  readonly category: string;
  readonly executable: false;
  readonly rationale: string;
};

export type CashFlowSummary = {
  readonly currency: string;
  readonly monthlyIncomeMinorUnits: string;
  readonly monthlyRecurringExpensesMinorUnits: string;
  readonly estimatedSurplusMinorUnits: string;
  readonly derived: true;
};

/**
 * Unified personal economy read model. A projection only — not a ledger.
 */
export type PersonalEconomySnapshot = {
  readonly snapshotId: PersonalEconomySnapshotId;
  readonly subjectId: string;
  readonly generatedAt: UtcInstant;
  readonly cash: readonly SerializedMoney[];
  readonly liquidity: readonly SerializedMoney[];
  readonly investments: readonly {
    readonly label: string;
    readonly estimatedValue: SerializedMoney;
    readonly source: string;
  }[];
  readonly liabilities: readonly {
    readonly label: string;
    readonly estimatedBalance: SerializedMoney;
  }[];
  readonly cashFlowSummary: readonly CashFlowSummary[];
  readonly sunReyHoldings: TokenHoldingSummary | null;
  readonly moonReyHoldings: TokenHoldingSummary | null;
  readonly accessEntitlements: readonly AccessEntitlementSummary[];
  readonly upcomingAccessExpirations: readonly AccessEntitlementSummary[];
  readonly plannedAccessDemand: readonly AccessDemandSummary[];
  readonly humanContributionOpportunities: readonly ContributionOpportunitySummary[];
  readonly productiveContributionOpportunities: readonly ContributionOpportunitySummary[];
  readonly authoritativeBalance: false;
  readonly ledgerWins: true;
  readonly guaranteedOutcome: false;
  readonly projectionIsCertainty: false;
};

export function freezePersonalEconomySnapshot(snapshot: PersonalEconomySnapshot): PersonalEconomySnapshot {
  return Object.freeze({
    ...snapshot,
    cash: Object.freeze([...snapshot.cash]),
    liquidity: Object.freeze([...snapshot.liquidity]),
    investments: Object.freeze(snapshot.investments.map((row) => Object.freeze({ ...row }))),
    liabilities: Object.freeze(snapshot.liabilities.map((row) => Object.freeze({ ...row }))),
    cashFlowSummary: Object.freeze(snapshot.cashFlowSummary.map((row) => Object.freeze({ ...row }))),
    accessEntitlements: Object.freeze(snapshot.accessEntitlements.map((row) => Object.freeze({ ...row }))),
    upcomingAccessExpirations: Object.freeze(snapshot.upcomingAccessExpirations.map((row) => Object.freeze({ ...row }))),
    plannedAccessDemand: Object.freeze(snapshot.plannedAccessDemand.map((row) => Object.freeze({ ...row }))),
    humanContributionOpportunities: Object.freeze(
      snapshot.humanContributionOpportunities.map((row) => Object.freeze({ ...row })),
    ),
    productiveContributionOpportunities: Object.freeze(
      snapshot.productiveContributionOpportunities.map((row) => Object.freeze({ ...row })),
    ),
    authoritativeBalance: false,
    ledgerWins: true,
    guaranteedOutcome: false,
    projectionIsCertainty: false,
  });
}
