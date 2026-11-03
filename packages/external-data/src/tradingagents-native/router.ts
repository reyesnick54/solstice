/**
 * Provider routing with explicit fallback chains (simulation fixtures only).
 */

import { asUtcInstant } from '../../../domain/src/time.ts';
import {
  filterKnowableObservations,
  runSecEdgarAsFiledDataflow,
  type SecEdgarSubmissionRecord,
} from '../sec-fundamentals/edgar-dataflow.ts';
import { asOf, evaluationInstantFromTradeDate, isHistoricalRun, withholdLiveProfile } from './date-window.ts';
import { routeMacroIndicators } from './macro-routing.ts';
import { normalizeSymbol } from './symbols.ts';
import type { Wave2AdapterContext } from '../adapters.ts';
import type {
  DataflowOutcome,
  DataflowRequest,
  SimulationVendorId,
  TradingAgentsDataCategory,
  TradingAgentsDataMethod,
  TradingAgentsNativeRouterConfig,
} from './types.ts';

const METHOD_CATEGORY: Record<TradingAgentsDataMethod, TradingAgentsDataCategory> = Object.freeze({
  get_stock_data: 'core_stock_apis',
  get_indicators: 'technical_indicators',
  get_fundamentals: 'fundamental_data',
  get_balance_sheet: 'fundamental_data',
  get_cashflow: 'fundamental_data',
  get_income_statement: 'fundamental_data',
  get_news: 'news_data',
  get_macro_indicators: 'macro_data',
});

const DEFAULT_CHAINS: Record<TradingAgentsDataMethod, readonly SimulationVendorId[]> = Object.freeze({
  get_stock_data: Object.freeze(['yfinance']),
  get_indicators: Object.freeze(['yfinance']),
  get_fundamentals: Object.freeze(['sec_edgar', 'yfinance']),
  get_balance_sheet: Object.freeze(['sec_edgar', 'yfinance']),
  get_cashflow: Object.freeze(['sec_edgar', 'yfinance']),
  get_income_statement: Object.freeze(['sec_edgar', 'yfinance']),
  get_news: Object.freeze(['yfinance']),
  get_macro_indicators: Object.freeze(['fred']),
});

export type TradingAgentsNativeRouterPorts = {
  readonly ctx: Wave2AdapterContext;
  readonly secSubmissions?: readonly SecEdgarSubmissionRecord[];
  readonly yfinancePayload?: (input: { readonly symbol: string; readonly method: TradingAgentsDataMethod }) => string | null;
};

function vendorChain(
  method: TradingAgentsDataMethod,
  config: TradingAgentsNativeRouterConfig | undefined,
): readonly SimulationVendorId[] {
  const category = METHOD_CATEGORY[method];
  const toolOverride = config?.toolVendors?.[method];
  const categoryOverride = config?.dataVendors?.[category];
  const raw = toolOverride ?? categoryOverride;
  if (raw) {
    return Object.freeze(
      raw.split(',').map((v) => v.trim() as SimulationVendorId).filter(Boolean),
    );
  }
  return DEFAULT_CHAINS[method];
}

function serveSecEdgarStatement(
  method: TradingAgentsDataMethod,
  symbol: string,
  tradeDate: string,
  submissions: readonly SecEdgarSubmissionRecord[],
): DataflowOutcome {
  const evalTime = evaluationInstantFromTradeDate(tradeDate);
  const observations = filterKnowableObservations(runSecEdgarAsFiledDataflow(submissions), evalTime);
  const role =
    method === 'get_balance_sheet' ? 'balance' : method === 'get_cashflow' ? 'cash_flow' : 'income';
  const facts = observations.filter((o) => o.observationKind === 'financial_fact');
  if (facts.length === 0) {
    return Object.freeze({ kind: 'unavailable', reason: `NO_DATA: no SEC facts knowable for ${symbol} at ${tradeDate}` });
  }
  const lines = facts.slice(0, 8).map((f) => `- ${f.concept}: ${f.valueMinor ?? f.numericValue} (${f.periodEnd})`);
  const knowableAt = facts.reduce(
    (max, f) => (Date.parse(f.knowableAt) > Date.parse(max) ? f.knowableAt : max),
    facts[0]!.knowableAt,
  );
  return Object.freeze({
    kind: 'payload',
    vendorId: 'sec_edgar',
    knowableAt,
    body: `# ${role} statement (SEC as-filed simulation)\n# ${symbol} as-of ${tradeDate}\n\n${lines.join('\n')}`,
  });
}

export function routeTradingAgentsDataflow(
  request: DataflowRequest,
  ports: TradingAgentsNativeRouterPorts,
  config?: TradingAgentsNativeRouterConfig,
): DataflowOutcome {
  const symbol = normalizeSymbol(request.symbol);
  const tradeDate = request.tradeDate;
  const asOfDate = asOf(request.asOfDate ?? tradeDate, tradeDate) ?? tradeDate;
  const nowUtc = asUtcInstant(ports.ctx.nowUtc);
  const chain = vendorChain(request.method, config);

  if (request.method === 'get_macro_indicators') {
    return routeMacroIndicators({ ctx: ports.ctx, tradeDate, requestedAsOf: asOfDate });
  }

  let lastUnavailable: string | null = null;
  for (const vendor of chain) {
    if (vendor === 'yfinance' && isHistoricalRun(tradeDate, nowUtc)) {
      const withheld = withholdLiveProfile(asOfDate, symbol, nowUtc);
      if (withheld) {
        lastUnavailable = withheld;
        continue;
      }
    }
    if (vendor === 'sec_edgar') {
      const subs = ports.secSubmissions ?? [];
      if (subs.length === 0) {
        lastUnavailable = 'sec_edgar: no fixture submissions bound';
        continue;
      }
      return serveSecEdgarStatement(request.method, symbol, tradeDate, subs);
    }
    if (vendor === 'yfinance') {
      const body = ports.yfinancePayload?.({ symbol, method: request.method });
      if (body == null) {
        lastUnavailable = `yfinance: no simulation payload for ${request.method}`;
        continue;
      }
      return Object.freeze({
        kind: 'payload',
        vendorId: 'yfinance',
        knowableAt: evaluationInstantFromTradeDate(tradeDate),
        body,
      });
    }
  }

  return Object.freeze({
    kind: 'unavailable',
    reason: lastUnavailable ?? `DATA_UNAVAILABLE: no vendor served ${request.method}`,
  });
}

export function vendorUnavailableMessage(method: string, detail: string): string {
  return (
    `DATA_UNAVAILABLE: no configured vendor could serve ${method} right now (${detail}). ` +
    `Report data as unavailable; do not estimate values.`
  );
}
