export type { Brand } from './brand.ts';
export { brandAs } from './brand.ts';

export type { Err, Ok, Result } from './result.ts';
export { err, isErr, isOk, ok } from './result.ts';

export type { UtcInstant } from './time.ts';
export { addUtcMillis, asUtcInstant, isUtcInstant } from './time.ts';

export type {
  CurrencyCode,
  ForbiddenReturnMetricKeys,
  MoneyHasNoReturnMetrics,
  RationalShare,
  RoundingMode as RoundingModeName,
} from './money.ts';
export {
  formatMoney,
  minorUnitsScale,
  Money,
  RoundingMode,
  roundQuotient,
} from './money.ts';

export type {
  AccountId,
  AgentId,
  CustomerId,
  EventId,
  GrowthEntryId,
  MandateClauseId,
  MandateId,
  MerchantId,
  OpportunityId,
  ProposalId,
  SponsorId,
  TokenId,
} from './ids.ts';
export {
  asAccountId,
  asAgentId,
  asCustomerId,
  asEventId,
  asGrowthEntryId,
  asMandateClauseId,
  asMandateId,
  asMerchantId,
  asOpportunityId,
  asProposalId,
  asSponsorId,
  asTokenId,
} from './ids.ts';

export type { ProductAccountClass, RiskCeiling } from './account-class.ts';
export {
  isProductAccountClass,
  isRiskCeiling,
  PRODUCT_ACCOUNT_CLASSES,
  RISK_CEILINGS,
  riskRank,
} from './account-class.ts';

export type {
  DataCategory,
  ForbiddenAction,
  ProposalActionType,
  ReasonCode,
} from './proposal-types.ts';
export {
  DATA_CATEGORIES,
  FORBIDDEN_ACTIONS,
  isProposalActionType,
  PROPOSAL_ACTION_TYPES,
  REASON_CODES,
} from './proposal-types.ts';

export type {
  CompiledMandate,
  InvestSurplusConstraint,
  KeepLiquidConstraint,
  MandateCompileFailure,
  MandateConstraint,
  MandateKind,
  ReinvestRealizedGainsConstraint,
  ResearchPayFloorConstraint,
  ReserveMonthsConstraint,
  RiskCeilingConstraint,
  WeeklyGainsToSavingsConstraint,
} from './mandate-types.ts';
export { KNOWN_MANDATE_TEMPLATES, MANDATE_KINDS } from './mandate-types.ts';

export type { CapabilityTokenClaims } from './capability-claims.ts';
export { tokenIsExpired, tokenIsRevoked } from './capability-claims.ts';

export type {
  GrowthPeriod,
  GrowthSource,
  RealizationClass,
} from './growth-catalog.ts';
export {
  CANONICAL_REALIZATION,
  COST_AVOIDED_SOURCES,
  GROWTH_SOURCE_COUNT,
  GROWTH_SOURCES,
  isCostAvoided,
  isGrowthSource,
  isRealizationClass,
  isUnrealized,
  REALIZATION_CLASS_COUNT,
  REALIZATION_CLASSES,
  SETTLED_CASH_SOURCES,
} from './growth-catalog.ts';

export type { CatalogEventName } from './events-catalog.ts';
export { EVENT_CATALOG, isCatalogEventName } from './events-catalog.ts';

export type {
  ContextAccount,
  ContextTransaction,
  DepositInvestmentAgreement,
  FinancialContextHasNoReturnMetrics,
  FinancialContextSnapshot,
  HighCostDebt,
  NearTermObligation,
  RecurringPattern,
  UserGoal,
} from './financial-context.ts';

export type { RecordedFactor } from './recorded-factor.ts';

export type { AgentProposal, AgentProposalHasNoAuthority } from './proposal.ts';
