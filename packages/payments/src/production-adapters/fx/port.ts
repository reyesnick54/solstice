/**
 * Production FX / liquidity adapter contract.
 *
 * Extends the canonical FxLiquidityProvider. Vendor rates map into the
 * Phase C FX model. Adapters do not redefine customer pricing unless
 * explicitly configured as a provider-rate input.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { Money } from '../../../../money/src/money.ts';
import type {
  ExecuteQuoteRequest,
  FxLiquidityProvider,
  FxProviderResult,
  QuoteRequest,
  ReferenceRateRequest,
} from '../../fx-provider.ts';
import type { FxQuote } from '../../fx-quote.ts';
import type { FxRate } from '../../fx-rate.ts';
import type { FxTrade } from '../../fx-execution.ts';
import type { AdapterHealth, ProviderLifecycleState } from '../types.ts';

export type FxPricingMode = 'SUNREY_PRICES_CUSTOMER' | 'PROVIDER_RATE_INPUT';

export type FxProviderBalance = {
  readonly providerId: string;
  readonly currency: string;
  readonly amount: Money;
  readonly asOf: UtcInstant;
  readonly isCustomerLedgerBalance: false;
};

export type FxSettlementRecord = {
  readonly tradeId: string;
  readonly quoteId: string;
  readonly settlementRef: string;
  readonly status: FxTrade['status'];
  readonly settledAt: UtcInstant | null;
};

export type ProductionFxAdapter = FxLiquidityProvider & {
  readonly providerId: string;
  readonly lifecycle: ProviderLifecycleState;
  readonly pricingMode: FxPricingMode;
  readonly canPostLedger: false;
  readonly canIssueExecutionAuthority: false;
  readonly canRedefineCustomerPricing: boolean;
  retrieveSettlement(tradeId: string): FxProviderResult<FxSettlementRecord>;
  retrieveProviderBalance(currency: string): FxProviderResult<FxProviderBalance>;
  productionHealth(): AdapterHealth;
};

export type ProductionFxSurface = {
  readonly getReferenceRate: (request: ReferenceRateRequest) => FxProviderResult<FxRate>;
  readonly getQuote: (request: QuoteRequest) => FxProviderResult<FxQuote>;
  readonly executeQuote: (request: ExecuteQuoteRequest) => FxProviderResult<FxTrade>;
  readonly getTradeStatus: (tradeId: string) => FxProviderResult<FxTrade>;
  readonly cancel: (tradeId: string) => FxProviderResult<FxTrade>;
  readonly retrieveSettlement: (tradeId: string) => FxProviderResult<FxSettlementRecord>;
  readonly retrieveProviderBalance: (currency: string) => FxProviderResult<FxProviderBalance>;
};
