/**
 * Simulation FX adapter that implements the production FX contract.
 * Wraps SimulationFxProvider so simulation and production share one port.
 */

import { asUtcInstant } from '../../../../domain/src/time.ts';
import { Money } from '../../../../money/src/money.ts';
import {
  SimulationFxProvider,
  type ExecuteQuoteRequest,
  type FxProviderResult,
  type QuoteRequest,
  type ReferenceRateRequest,
} from '../../fx-provider.ts';
import type { FxQuote } from '../../fx-quote.ts';
import type { FxRate } from '../../fx-rate.ts';
import type { FxTrade } from '../../fx-execution.ts';
import type { Clock } from '../../../../config/src/clock.ts';
import type { AdapterHealth } from '../types.ts';
import type { FxPricingMode, FxProviderBalance, FxSettlementRecord, ProductionFxAdapter } from './port.ts';

export class SimulatedProductionFxAdapter implements ProductionFxAdapter {
  readonly providerId = 'SIMULATED_FX_LIQUIDITY';
  readonly lifecycle = 'SIMULATED' as const;
  readonly pricingMode: FxPricingMode = 'SUNREY_PRICES_CUSTOMER';
  readonly canPostLedger = false as const;
  readonly canIssueExecutionAuthority = false as const;
  readonly canRedefineCustomerPricing = false;
  private readonly inner: SimulationFxProvider;
  private readonly clock: Clock;

  constructor(clock: Clock, inner?: SimulationFxProvider) {
    this.clock = clock;
    this.inner = inner ?? new SimulationFxProvider(clock);
  }

  get innerProvider(): SimulationFxProvider {
    return this.inner;
  }

  getReferenceRate(request: ReferenceRateRequest): FxProviderResult<FxRate> {
    return this.inner.getReferenceRate(request);
  }

  getQuote(request: QuoteRequest): FxProviderResult<FxQuote> {
    return this.inner.getQuote(request);
  }

  quote(request: QuoteRequest): FxQuote {
    return this.inner.quote(request);
  }

  executeQuote(request: ExecuteQuoteRequest): FxProviderResult<FxTrade> {
    return this.inner.executeQuote(request);
  }

  getTradeStatus(tradeId: string): FxProviderResult<FxTrade> {
    return this.inner.getTradeStatus(tradeId);
  }

  cancel(tradeId: string): FxProviderResult<FxTrade> {
    return this.inner.cancel(tradeId);
  }

  retrieveSettlement(tradeId: string): FxProviderResult<FxSettlementRecord> {
    const trade = this.inner.getTradeStatus(tradeId);
    if (!trade.ok) {
      return trade;
    }
    return {
      ok: true,
      value: Object.freeze({
        tradeId: trade.value.tradeId,
        quoteId: trade.value.quoteId,
        settlementRef: trade.value.reconciliationRef ?? `fxset_${trade.value.tradeId}`,
        status: trade.value.status,
        settledAt: trade.value.status === 'SETTLED' ? trade.value.updatedAt : null,
      }),
    };
  }

  retrieveProviderBalance(currency: string): FxProviderResult<FxProviderBalance> {
    return {
      ok: true,
      value: Object.freeze({
        providerId: this.providerId,
        currency,
        amount: Money.fromMinorUnits(0n, currency),
        asOf: this.clock.now(),
        isCustomerLedgerBalance: false,
      }),
    };
  }

  productionHealth(): AdapterHealth {
    return Object.freeze({
      providerId: this.providerId,
      domain: 'FX_LIQUIDITY',
      lifecycle: this.lifecycle,
      healthy: true,
      connectivity: 'SIMULATION',
      checkedAt: asUtcInstant(this.clock.now()),
      live: false,
    });
  }
}
