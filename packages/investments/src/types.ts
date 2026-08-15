import { LIVE_TRADING_ENABLED } from '../../config/src/flags.ts';

/**
 * Simulation-only investment execution flag.
 * Live securities trading is not implemented. The Risk Engine gates paper orders.
 * This flag stays false; it is not a product experiment toggle.
 */
export const LIVE_INVESTMENT_EXECUTION = false as const;

export const INVESTMENT_PROFILE_STATUSES = [
  'PENDING',
  'ACTIVE',
  'RESTRICTED',
  'FROZEN',
  'CLOSED',
] as const;

export type InvestmentProfileStatus = (typeof INVESTMENT_PROFILE_STATUSES)[number];

export const INSTRUMENT_TYPES = ['EQUITY', 'ETF', 'BOND', 'FUND', 'CASH_EQUIVALENT'] as const;
export type InstrumentType = (typeof INSTRUMENT_TYPES)[number];

export const INSTRUMENT_STATUSES = ['ACTIVE', 'HALTED', 'DELISTED'] as const;
export type InstrumentStatus = (typeof INSTRUMENT_STATUSES)[number];

export const ORDER_SIDES = ['BUY', 'SELL'] as const;
export type OrderSide = (typeof ORDER_SIDES)[number];

export const FORBIDDEN_ORDER_SIDES = ['SHORT', 'SELL_SHORT', 'BORROW', 'LEVERAGED_BUY'] as const;

export const PAPER_ORDER_TYPES = ['MARKET_SIMULATION', 'LIMIT_SIMULATION'] as const;
export type PaperOrderType = (typeof PAPER_ORDER_TYPES)[number];

export const PAPER_ORDER_STATUSES = [
  'DRAFT',
  'PENDING_AUTHORIZATION',
  'ACCEPTED',
  'OPEN',
  'PARTIALLY_FILLED',
  'FILLED',
  'CANCELLED',
  'REJECTED',
  'EXPIRED',
] as const;
export type PaperOrderStatus = (typeof PAPER_ORDER_STATUSES)[number];

export const LEGAL_ORDER_TRANSITIONS: Readonly<Record<PaperOrderStatus, readonly PaperOrderStatus[]>> =
  Object.freeze({
    DRAFT: Object.freeze(['PENDING_AUTHORIZATION', 'CANCELLED', 'REJECTED'] as const),
    PENDING_AUTHORIZATION: Object.freeze(['ACCEPTED', 'REJECTED', 'CANCELLED'] as const),
    ACCEPTED: Object.freeze(['OPEN', 'FILLED', 'REJECTED', 'CANCELLED', 'EXPIRED'] as const),
    OPEN: Object.freeze(['PARTIALLY_FILLED', 'FILLED', 'CANCELLED', 'EXPIRED'] as const),
    PARTIALLY_FILLED: Object.freeze(['FILLED', 'CANCELLED', 'EXPIRED'] as const),
    FILLED: Object.freeze([] as const),
    CANCELLED: Object.freeze([] as const),
    REJECTED: Object.freeze([] as const),
    EXPIRED: Object.freeze([] as const),
  });

export const SETTLEMENT_STATES = ['TRADE_DATE', 'PENDING_SETTLEMENT', 'SETTLED'] as const;
export type SettlementState = (typeof SETTLEMENT_STATES)[number];

export const LOT_METHODS = ['FIFO_SIMULATION'] as const;
export type LotMethod = (typeof LOT_METHODS)[number];

export const RECONCILIATION_RESULTS = [
  'MATCHED',
  'PENDING',
  'POSITION_MISMATCH',
  'CASH_MISMATCH',
  'MISSING_FILL',
  'MISSING_INTERNAL',
  'INVESTIGATION_REQUIRED',
] as const;
export type ReconciliationResult = (typeof RECONCILIATION_RESULTS)[number];

export const CORPORATE_ACTION_KINDS = ['DIVIDEND', 'SPLIT'] as const;
export type CorporateActionKind = (typeof CORPORATE_ACTION_KINDS)[number];

export const MARKET_STATUSES = ['OPEN', 'CLOSED', 'HALTED'] as const;
export type MarketStatus = (typeof MARKET_STATUSES)[number];

export const RISK_CONTROL_STATUSES = [
  'PAPER_SIMULATION_ONLY',
  'RISK_ENGINE_NOT_IMPLEMENTED',
  'RISK_ENGINE_BLOCKED',
  'BLOCKED_LIVE_EXECUTION',
] as const;
export type RiskControlStatus = (typeof RISK_CONTROL_STATUSES)[number];

export const ELIGIBILITY_STATUSES = [
  'ELIGIBLE_SIMULATION',
  'RESEARCH_REQUIRED',
  'REVIEW',
  'NOT_SUPPORTED',
] as const;
export type EligibilityStatus = (typeof ELIGIBILITY_STATUSES)[number];

export const RDT_LEGAL_STATUSES = [
  'RESEARCH_REQUIRED',
  'COUNSEL_REVIEW_REQUIRED',
  'SIMULATION_ONLY',
] as const;
export type RdtLegalStatus = (typeof RDT_LEGAL_STATUSES)[number];

export function assertPaperOnly(): void {
  if (LIVE_INVESTMENT_EXECUTION !== false || LIVE_TRADING_ENABLED !== false) {
    throw new Error('live investment execution is forbidden');
  }
}

export function canTransitionOrder(from: PaperOrderStatus, to: PaperOrderStatus): boolean {
  return LEGAL_ORDER_TRANSITIONS[from].includes(to);
}
