import type { Money, RationalShare } from './money.ts';
import type { RiskCeiling } from './account-class.ts';
import type { MandateClauseId, MandateId } from './ids.ts';
import type { UtcInstant } from './time.ts';
import type { ProposalActionType } from './proposal-types.ts';

/**
 * Compiled, typed, deterministic mandate constraints.
 * Human-readable text is compiled once. Evaluation never re-interprets
 * free-form language with a model.
 */
export const MANDATE_KINDS = [
  'KEEP_LIQUID',
  'RESERVE_MONTHS',
  'INVEST_SURPLUS',
  'RISK_CEILING',
  'REINVEST_REALIZED_GAINS',
  'WEEKLY_GAINS_TO_SAVINGS',
  'RESEARCH_PAY_FLOOR',
] as const;

export type MandateKind = (typeof MANDATE_KINDS)[number];

export type KeepLiquidConstraint = {
  readonly kind: 'KEEP_LIQUID';
  readonly amount: Money;
};

export type ReserveMonthsConstraint = {
  readonly kind: 'RESERVE_MONTHS';
  readonly months: bigint;
};

export type InvestSurplusConstraint = {
  readonly kind: 'INVEST_SURPLUS';
};

export type RiskCeilingConstraint = {
  readonly kind: 'RISK_CEILING';
  readonly max: RiskCeiling;
};

export type ReinvestRealizedGainsConstraint = {
  readonly kind: 'REINVEST_REALIZED_GAINS';
  readonly share: RationalShare;
};

export type WeeklyGainsToSavingsConstraint = {
  readonly kind: 'WEEKLY_GAINS_TO_SAVINGS';
  readonly share: RationalShare;
};

export type ResearchPayFloorConstraint = {
  readonly kind: 'RESEARCH_PAY_FLOOR';
  readonly minCompensation: Money;
};

export type MandateConstraint =
  | KeepLiquidConstraint
  | ReserveMonthsConstraint
  | InvestSurplusConstraint
  | RiskCeilingConstraint
  | ReinvestRealizedGainsConstraint
  | WeeklyGainsToSavingsConstraint
  | ResearchPayFloorConstraint;

export type CompiledMandate = {
  readonly id: MandateId;
  readonly customerId: string;
  readonly version: number;
  readonly sourceText: string;
  readonly clauseId: MandateClauseId;
  readonly constraint: MandateConstraint;
  readonly requiredProposalTypes: readonly ProposalActionType[];
  readonly compiledAt: UtcInstant;
};

export type MandateCompileFailure = {
  readonly code: 'MANDATE_UNCOMPILABLE' | 'MANDATE_WIDENS_TOKEN';
  readonly sourceText: string;
  readonly explanation: string;
};

export const KNOWN_MANDATE_TEMPLATES = [
  'keep $<amount> liquid',
  'maintain <n> months of expenses as reserves',
  'invest surplus cash',
  'never exceed <Conservative|Moderate|Aggressive> risk',
  'reinvest <n>% of realized gains',
  'move <n>% of realized gains to savings weekly',
  'show me research opportunities paying more than $<amount>',
] as const;
