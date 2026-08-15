import type { UtcInstant } from '../../domain/src/time.ts';
import type { EconomicGraphId, EconomicSnapshotId } from './ids.ts';
import type { CurrencyCashFlow, ProvenancedAmount } from './cash-flow.ts';
import type { FactConfidence } from './provenance.ts';
import type { GoalKind, GoalStatus, OpportunityKind, SerializedMoney } from './taxonomy.ts';

export type SnapshotAccountSummary = {
  readonly nodeId: string;
  readonly accountRef: string;
  readonly currency: string;
  readonly accountClass?: string;
  readonly derivedPosition?: ProvenancedAmount;
  readonly confidence: FactConfidence;
  readonly ledgerWins: true;
};

export type SnapshotIncomeSummary = {
  readonly nodeId: string;
  readonly label: string;
  readonly incomeKind: string;
  readonly estimatedAmount?: SerializedMoney;
  readonly cadence?: string;
  readonly confidence: FactConfidence;
  readonly sourceRefs: readonly string[];
};

export type SnapshotObligation = {
  readonly nodeId: string;
  readonly kind: string;
  readonly label: string;
  readonly estimatedAmount: SerializedMoney;
  readonly cadence?: string;
  readonly confidence: FactConfidence;
  readonly sourceRefs: readonly string[];
};

export type SnapshotDebt = {
  readonly nodeId: string;
  readonly label: string;
  readonly holdingKind: string;
  readonly estimatedBalance?: SerializedMoney;
  readonly confidence: FactConfidence;
};

export type SnapshotInvestment = {
  readonly nodeId: string;
  readonly label: string;
  readonly holdingKind: string;
  readonly confidence: FactConfidence;
};

export type SnapshotGoal = {
  readonly nodeId: string;
  readonly goalKind: GoalKind;
  readonly label: string;
  readonly target: SerializedMoney;
  readonly targetDate: UtcInstant | null;
  readonly priority: number;
  readonly status: GoalStatus;
};

export type SnapshotOpportunity = {
  readonly opportunityId: string;
  readonly kind: OpportunityKind;
  readonly title: string;
  readonly executable: false;
  readonly status: 'PROPOSAL';
};

/**
 * Personal economic snapshot. There is no fake cross-currency total.
 * Derived positions are not a balance source of truth.
 */
export type PersonalEconomicSnapshot = {
  readonly snapshotId: EconomicSnapshotId;
  readonly graphId: EconomicGraphId;
  readonly subjectId: string;
  readonly generatedAt: UtcInstant;
  readonly liquidAssetsByCurrency: readonly ProvenancedAmount[];
  readonly income: readonly SnapshotIncomeSummary[];
  readonly knownRecurringObligations: readonly SnapshotObligation[];
  readonly debt: readonly SnapshotDebt[];
  readonly investments: readonly SnapshotInvestment[];
  readonly monthlyCashFlow: readonly CurrencyCashFlow[];
  readonly goals: readonly SnapshotGoal[];
  readonly economicOpportunities: readonly SnapshotOpportunity[];
  readonly valuationContext: null;
  readonly crossCurrencyTotal: null;
  readonly authoritativeBalance: false;
  readonly ledgerWins: true;
};

export function freezeSnapshot(snapshot: PersonalEconomicSnapshot): PersonalEconomicSnapshot {
  return Object.freeze({
    ...snapshot,
    liquidAssetsByCurrency: Object.freeze([...snapshot.liquidAssetsByCurrency]),
    income: Object.freeze([...snapshot.income]),
    knownRecurringObligations: Object.freeze([...snapshot.knownRecurringObligations]),
    debt: Object.freeze([...snapshot.debt]),
    investments: Object.freeze([...snapshot.investments]),
    monthlyCashFlow: Object.freeze([...snapshot.monthlyCashFlow]),
    goals: Object.freeze([...snapshot.goals]),
    economicOpportunities: Object.freeze([...snapshot.economicOpportunities]),
    valuationContext: null,
    crossCurrencyTotal: null,
    authoritativeBalance: false,
    ledgerWins: true,
  });
}
