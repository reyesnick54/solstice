import type { UtcInstant } from '../../domain/src/time.ts';
import type { ComplianceCase } from '../../kernel/src/compliance/cases.ts';
import type { SurveillanceAlertKind } from './taxonomy.ts';

export type ObservedOrder = {
  readonly orderId: string;
  readonly accountId: string;
  readonly beneficialParticipantId: string;
  readonly marketId: string;
  readonly side: 'BUY' | 'SELL';
  readonly quantity: bigint;
  readonly remaining: bigint;
  readonly status: string;
  readonly createdAt: UtcInstant;
  readonly cancelledAt?: UtcInstant;
};

export type ObservedTrade = {
  readonly tradeId: string;
  readonly marketId: string;
  readonly makerOrderId: string;
  readonly takerOrderId: string;
  readonly makerAccountId: string;
  readonly takerAccountId: string;
  readonly makerParticipantId: string;
  readonly takerParticipantId: string;
  readonly quantity: bigint;
  readonly priceUnits: bigint;
  readonly matchedAt: UtcInstant;
};

export type MarketSnapshot = {
  readonly marketId: string;
  readonly orders: readonly ObservedOrder[];
  readonly trades: readonly ObservedTrade[];
  readonly linkedAccounts?: Readonly<Record<string, string>>;
};

export type SurveillanceAlert = {
  readonly alertId: string;
  readonly kind: SurveillanceAlertKind;
  readonly marketId: string;
  readonly subjectRefs: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly outputClass: 'CANDIDATE_ALERT';
  readonly legalConclusion: false;
  readonly createdAt: UtcInstant;
};

export type RestrictionProposal = {
  readonly proposalId: string;
  readonly alertId: string;
  readonly accountId: string;
  readonly proposedStatus: 'RESTRICTED' | 'SUSPENDED';
  readonly applied: false;
  readonly createdAt: UtcInstant;
};
export type OpenedSurveillanceCase = ComplianceCase;
