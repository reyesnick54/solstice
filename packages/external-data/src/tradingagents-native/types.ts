import type { UtcInstant } from '../../../domain/src/time.ts';

export const TRADINGAGENTS_NATIVE_DATAFLOW_SCHEMA = 'sunrey.external-data.tradingagents-native.v1' as const;

export type TradingAgentsDataCategory =
  | 'core_stock_apis'
  | 'technical_indicators'
  | 'fundamental_data'
  | 'news_data'
  | 'macro_data'
  | 'prediction_markets';

export type TradingAgentsDataMethod =
  | 'get_stock_data'
  | 'get_indicators'
  | 'get_fundamentals'
  | 'get_balance_sheet'
  | 'get_cashflow'
  | 'get_income_statement'
  | 'get_news'
  | 'get_macro_indicators';

export type SimulationVendorId = 'sec_edgar' | 'yfinance' | 'alpha_vantage' | 'fred';

export type DataflowRequest = {
  readonly method: TradingAgentsDataMethod;
  readonly symbol: string;
  readonly tradeDate: string;
  readonly asOfDate?: string | null;
  readonly startDate?: string | null;
  readonly endDate?: string | null;
};

export type DataflowOutcome =
  | { readonly kind: 'payload'; readonly vendorId: SimulationVendorId; readonly body: string; readonly knowableAt: UtcInstant }
  | { readonly kind: 'withheld'; readonly reason: string; readonly knowableAt: UtcInstant }
  | { readonly kind: 'unavailable'; readonly reason: string };

export type NormalizedStatementLine = {
  readonly label: string;
  readonly conceptTags: readonly string[];
  readonly valueMinor: bigint | null;
  readonly periodEnd: string;
  readonly filingId: string;
  readonly knowableAt: UtcInstant;
};

export type TradingAgentsNativeRouterConfig = {
  readonly dataVendors?: Partial<Record<TradingAgentsDataCategory, string>>;
  readonly toolVendors?: Partial<Record<TradingAgentsDataMethod, string>>;
};
