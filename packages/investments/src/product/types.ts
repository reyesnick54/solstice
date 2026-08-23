/**
 * Phase E Prompt 3 productization vocabulary.
 * Simulation only. Not a live brokerage license.
 */

export const PRODUCT_ASSET_CLASSES = [
  'CASH',
  'MONEY_MARKET',
  'EQUITY',
  'ETF',
  'FUND',
  'BOND',
  'FIXED_INCOME',
  'DIGITAL_ASSET',
  'OTHER_APPROVED_PRODUCT',
] as const;
export type ProductAssetClass = (typeof PRODUCT_ASSET_CLASSES)[number];

export const INSTRUMENT_PRODUCT_STATUSES = [
  'AVAILABLE_SIMULATION',
  'UNAVAILABLE',
  'RESEARCH_REQUIRED',
  'HALTED',
  'DELISTED',
] as const;
export type InstrumentProductStatus = (typeof INSTRUMENT_PRODUCT_STATUSES)[number];

export const INSTRUMENT_RISK_CATEGORIES = ['LOW', 'MODERATE', 'HIGH', 'UNKNOWN'] as const;
export type InstrumentRiskCategory = (typeof INSTRUMENT_RISK_CATEGORIES)[number];

export const INSTRUMENT_LIQUIDITY_CLASSES = ['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'] as const;
export type InstrumentLiquidityClass = (typeof INSTRUMENT_LIQUIDITY_CLASSES)[number];

export const PORTFOLIO_STATUSES = ['PENDING', 'ACTIVE', 'RESTRICTED', 'FROZEN', 'CLOSED'] as const;
export type PortfolioStatus = (typeof PORTFOLIO_STATUSES)[number];

export const INVESTMENT_ORDER_SIDES = ['BUY', 'SELL'] as const;
export type InvestmentOrderSide = (typeof INVESTMENT_ORDER_SIDES)[number];

export const INVESTMENT_SIZING_MODES = ['QUANTITY', 'AMOUNT'] as const;
export type InvestmentSizingMode = (typeof INVESTMENT_SIZING_MODES)[number];

/**
 * Product order/proposal states. Distinct from paper-broker statuses.
 * A sandbox fill is never a live securities execution.
 */
export const INVESTMENT_ORDER_STATES = [
  'PROPOSED',
  'AWAITING_APPROVAL',
  'AUTHORIZED',
  'SUBMITTED',
  'PARTIALLY_FILLED',
  'FILLED',
  'CANCELLED',
  'REJECTED',
  'FAILED',
] as const;
export type InvestmentOrderState = (typeof INVESTMENT_ORDER_STATES)[number];

export const LEGAL_PRODUCT_ORDER_TRANSITIONS: Readonly<
  Record<InvestmentOrderState, readonly InvestmentOrderState[]>
> = Object.freeze({
  PROPOSED: Object.freeze(['AWAITING_APPROVAL', 'CANCELLED', 'REJECTED'] as const),
  AWAITING_APPROVAL: Object.freeze(['AUTHORIZED', 'REJECTED', 'CANCELLED'] as const),
  AUTHORIZED: Object.freeze(['SUBMITTED', 'CANCELLED', 'FAILED'] as const),
  SUBMITTED: Object.freeze(['PARTIALLY_FILLED', 'FILLED', 'CANCELLED', 'REJECTED', 'FAILED'] as const),
  PARTIALLY_FILLED: Object.freeze(['FILLED', 'CANCELLED', 'FAILED'] as const),
  FILLED: Object.freeze([] as const),
  CANCELLED: Object.freeze([] as const),
  REJECTED: Object.freeze([] as const),
  FAILED: Object.freeze([] as const),
});

export const CASH_FLOW_KINDS = ['DEPOSIT', 'WITHDRAWAL', 'INCOME', 'FEE'] as const;
export type CashFlowKind = (typeof CASH_FLOW_KINDS)[number];

export const RESERVATION_STATES = ['OVERLAY', 'LEDGER_POSTED', 'CAPTURED', 'RELEASED'] as const;
export type ReservationState = (typeof RESERVATION_STATES)[number];

export const SANDBOX_EXECUTION_SCENARIOS = [
  'FILLED',
  'PARTIAL_FILL',
  'REJECTED',
  'PENDING',
  'CANCELLED',
  'MARKET_UNAVAILABLE',
] as const;
export type SandboxExecutionScenario = (typeof SANDBOX_EXECUTION_SCENARIOS)[number];

export const SUITABILITY_STATUSES = [
  'ELIGIBLE_SIMULATION',
  'REVIEW',
  'NOT_SUPPORTED',
  'RESEARCH_REQUIRED',
] as const;
export type SuitabilityStatus = (typeof SUITABILITY_STATUSES)[number];

export const INVESTOR_CLASSIFICATIONS = [
  'RETAIL',
  'PROFESSIONAL',
  'ELIGIBLE_COUNTERPARTY',
  'UNSPECIFIED',
] as const;
export type InvestorClassification = (typeof INVESTOR_CLASSIFICATIONS)[number];

export const EXPERIENCE_LEVELS = ['NONE', 'LIMITED', 'EXPERIENCED', 'UNKNOWN'] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const PERFORMANCE_METHODS = ['TWR_LINKED_SUBPERIODS', 'MODIFIED_DIETZ'] as const;
export type PerformanceMethod = (typeof PERFORMANCE_METHODS)[number];

export const BPS_SCALE = 10_000n;

export const LIVE_SECURITIES_BROKERAGE = false as const;
export const LIVE_INVESTMENT_PROVIDER_CONNECTED = false as const;

export function canTransitionProductOrder(
  from: InvestmentOrderState,
  to: InvestmentOrderState,
): boolean {
  return LEGAL_PRODUCT_ORDER_TRANSITIONS[from].includes(to);
}
