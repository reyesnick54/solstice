import type { UtcInstant } from '../../domain/src/time.ts';
import type { EconomicGraphId, EconomicNodeId } from './ids.ts';
import type { DataQualityState, FactConfidence, Provenance } from './provenance.ts';
import type {
  AssetKind,
  CanonicalRef,
  DebtKind,
  EconomicNodeKind,
  GoalKind,
  GoalStatus,
  HoldingKind,
  IncomeKind,
  LiabilityKind,
  OpportunityKind,
  RecurringCadence,
  SerializedMoney,
} from './taxonomy.ts';

export type PersonNodeAttributes = {
  readonly kind: 'PERSON';
  readonly subjectId: string;
  readonly customerId?: string;
};

export type AccountNodeAttributes = {
  readonly kind: 'ACCOUNT';
  readonly canonicalRef: CanonicalRef;
  readonly currency: string;
  readonly accountClass?: string;
};

export type IncomeSourceAttributes = {
  readonly kind: 'INCOME_SOURCE';
  readonly incomeKind: IncomeKind;
  readonly label: string;
  readonly estimatedAmount?: SerializedMoney;
  readonly cadence?: RecurringCadence;
};

export type ExpenseAttributes = {
  readonly kind: 'EXPENSE';
  readonly expenseKind: 'RENT' | 'VARIABLE' | 'OTHER';
  readonly label: string;
  readonly estimatedAmount?: SerializedMoney;
};

export type MerchantAttributes = {
  readonly kind: 'MERCHANT';
  readonly merchantRef: string;
};

export type SubscriptionAttributes = {
  readonly kind: 'SUBSCRIPTION';
  readonly merchantRef: string;
  readonly estimatedAmount: SerializedMoney;
  readonly cadence: RecurringCadence;
  readonly lastObserved: UtcInstant;
  readonly nextExpected: UtcInstant | null;
  readonly cancellationCapability: 'NOT_IMPLEMENTED';
};

export type DebtAttributes = {
  readonly kind: 'DEBT';
  readonly debtKind: DebtKind;
  readonly holdingKind: HoldingKind;
  readonly label: string;
  readonly estimatedBalance?: SerializedMoney;
};

export type AssetAttributes = {
  readonly kind: 'ASSET';
  readonly assetKind: AssetKind;
  readonly holdingKind: HoldingKind;
  readonly label: string;
  readonly estimatedValue?: SerializedMoney;
};

export type LiabilityAttributes = {
  readonly kind: 'LIABILITY';
  readonly liabilityKind: LiabilityKind;
  readonly holdingKind: HoldingKind;
  readonly label: string;
  readonly estimatedBalance?: SerializedMoney;
};

export type InvestmentAttributes = {
  readonly kind: 'INVESTMENT';
  readonly holdingKind: HoldingKind;
  readonly label: string;
};

export type InsuranceAttributes = {
  readonly kind: 'INSURANCE';
  readonly label: string;
  readonly estimatedPremium?: SerializedMoney;
  readonly cadence?: RecurringCadence;
};

export type TaxObligationAttributes = {
  readonly kind: 'TAX_OBLIGATION';
  readonly label: string;
};

export type RewardAttributes = {
  readonly kind: 'REWARD';
  readonly label: string;
};

export type GoalAttributes = {
  readonly kind: 'GOAL';
  readonly goalKind: GoalKind;
  readonly label: string;
  readonly target: SerializedMoney;
  readonly targetDate: UtcInstant | null;
  readonly priority: number;
  readonly status: GoalStatus;
};

export type BenefitAttributes = {
  readonly kind: 'BENEFIT';
  readonly label: string;
};

export type CashFlowAttributes = {
  readonly kind: 'CASH_FLOW';
  readonly windowFrom: UtcInstant;
  readonly windowTo: UtcInstant;
};

export type DataAssetAttributes = {
  readonly kind: 'DATA_ASSET';
  readonly label: string;
};

export type OpportunityAttributes = {
  readonly kind: 'ECONOMIC_OPPORTUNITY';
  readonly opportunityKind: OpportunityKind;
  readonly executable: false;
};

export type EconomicNodeAttributes =
  | PersonNodeAttributes
  | AccountNodeAttributes
  | IncomeSourceAttributes
  | ExpenseAttributes
  | MerchantAttributes
  | SubscriptionAttributes
  | DebtAttributes
  | AssetAttributes
  | LiabilityAttributes
  | InvestmentAttributes
  | InsuranceAttributes
  | TaxObligationAttributes
  | RewardAttributes
  | GoalAttributes
  | BenefitAttributes
  | CashFlowAttributes
  | DataAssetAttributes
  | OpportunityAttributes;

export type EconomicNode = {
  readonly nodeId: EconomicNodeId;
  readonly graphId: EconomicGraphId;
  readonly kind: EconomicNodeKind;
  readonly attributes: EconomicNodeAttributes;
  readonly canonicalRef?: CanonicalRef;
  readonly quality: DataQualityState;
  readonly confidence: FactConfidence;
  readonly provenance: Provenance;
  readonly createdAt: UtcInstant;
  readonly survivesRebuild: boolean;
};

export function freezeNode(node: EconomicNode): EconomicNode {
  return Object.freeze({
    ...node,
    attributes: Object.freeze({ ...node.attributes }) as EconomicNodeAttributes,
    provenance: Object.freeze({ ...node.provenance }),
    ...(node.canonicalRef ? { canonicalRef: Object.freeze({ ...node.canonicalRef }) } : {}),
  });
}
