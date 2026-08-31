/**
 * Product integration bridges — World, Grow, Agent, Exchange, MoonRey.
 */

import type { ExternalDataPlane } from './plane.ts';
import { filingAvailableEvent, fiscalReleaseEvent, macroUpdatedEvent } from './events.ts';

export type WorldEconomySnapshot = {
  readonly schema: 'sunrey.world.economy.v1';
  readonly macroIndicators: readonly { readonly seriesId: string; readonly value: number; readonly unit: string }[];
  readonly treasuryYields: readonly { readonly maturity: string; readonly yieldPercent: string }[];
  readonly fiscal: readonly { readonly period: string; readonly balanceMinor: string }[];
  readonly availability: 'AVAILABLE_SIMULATION';
};

export type GrowContextSnapshot = {
  readonly schema: 'sunrey.grow.external-context.v1';
  readonly fundamentalsAvailable: boolean;
  readonly latestFilings: readonly { readonly formType: string; readonly companyName: string; readonly filingDate: string }[];
  readonly macroContext: readonly { readonly seriesId: string; readonly value: number }[];
  readonly marketContext: readonly { readonly symbol: string; readonly priceMinor: string }[];
};

export type AgentEvidenceSnapshot = {
  readonly schema: 'sunrey.agent.external-evidence.v1';
  readonly evidenceCount: number;
  readonly grantsExecutionAuthority: false;
};

export type ExchangeReferenceSnapshot = {
  readonly schema: 'sunrey.exchange.reference.v1';
  readonly quotes: readonly { readonly symbol: string; readonly indicativePriceMinor: string }[];
  readonly fxRates: readonly { readonly pair: string; readonly rate: string }[];
  readonly executionAuthority: false;
};

export type MoonReyResourceContext = {
  readonly schema: 'sunrey.moonrey.resource-context.v1';
  readonly commodities: readonly { readonly commodityId: string; readonly priceMinor: string; readonly unit: string }[];
  readonly issuanceAuthority: false;
};

export function worldEconomySnapshot(plane: ExternalDataPlane): WorldEconomySnapshot {
  const macro = plane.macro.getIndicators();
  const treasury = plane.macro.getTreasuryYields();
  const fiscal = plane.macro.getFiscalBalances();
  return Object.freeze({
    schema: 'sunrey.world.economy.v1',
    macroIndicators: Object.freeze(
      macro.observations.map((o) => ({
        seriesId: o.data.seriesId,
        value: o.data.value,
        unit: o.data.unit,
      })),
    ),
    treasuryYields: Object.freeze(
      treasury.observations.map((o) => ({
        maturity: o.data.maturity,
        yieldPercent: o.data.yieldPercent,
      })),
    ),
    fiscal: Object.freeze(
      fiscal.observations.map((o) => ({
        period: o.data.period,
        balanceMinor: o.data.balanceMinor?.toString() ?? '0',
      })),
    ),
    availability: 'AVAILABLE_SIMULATION',
  });
}

export function growContextSnapshot(plane: ExternalDataPlane): GrowContextSnapshot {
  const filings = plane.company.getLatestFilings(5);
  const macro = plane.macro.getIndicators();
  const markets = plane.markets.getQuotes();
  return Object.freeze({
    schema: 'sunrey.grow.external-context.v1',
    fundamentalsAvailable: filings.observations.length > 0,
    latestFilings: Object.freeze(
      filings.observations.map((o) => ({
        formType: o.data.formType,
        companyName: o.data.companyName,
        filingDate: o.data.filingDate,
      })),
    ),
    macroContext: Object.freeze(
      macro.observations.map((o) => ({ seriesId: o.data.seriesId, value: o.data.value })),
    ),
    marketContext: Object.freeze(
      markets.observations.map((o) => ({
        symbol: o.data.symbol,
        priceMinor: o.data.priceMinor.toString(),
      })),
    ),
  });
}

export function agentEvidenceSnapshot(plane: ExternalDataPlane): AgentEvidenceSnapshot {
  const bundle = plane.agentEvidenceBundle();
  return Object.freeze({
    schema: 'sunrey.agent.external-evidence.v1',
    evidenceCount: bundle.refs.length,
    grantsExecutionAuthority: false,
  });
}

export function exchangeReferenceSnapshot(plane: ExternalDataPlane): ExchangeReferenceSnapshot {
  const quotes = plane.markets.getQuotes();
  const fx = plane.fx.getRates();
  return Object.freeze({
    schema: 'sunrey.exchange.reference.v1',
    quotes: Object.freeze(
      quotes.observations.map((o) => ({
        symbol: o.data.symbol,
        indicativePriceMinor: o.data.priceMinor.toString(),
      })),
    ),
    fxRates: Object.freeze(
      fx.observations.map((o) => ({
        pair: `${o.data.baseCurrency}/${o.data.quoteCurrency}`,
        rate: o.data.rate,
      })),
    ),
    executionAuthority: false,
  });
}

export function moonReyResourceContext(plane: ExternalDataPlane): MoonReyResourceContext {
  const commodities = plane.markets.getCommodities();
  return Object.freeze({
    schema: 'sunrey.moonrey.resource-context.v1',
    commodities: Object.freeze(
      commodities.observations.map((o) => ({
        commodityId: o.data.commodityId,
        priceMinor: o.data.priceMinor.toString(),
        unit: o.data.unit,
      })),
    ),
    issuanceAuthority: false,
  });
}

export function sampleActionCenterEvents(plane: ExternalDataPlane) {
  const filing = plane.company.getLatestFilings(1).observations[0];
  const macro = plane.macro.getIndicators().observations[0];
  const fiscal = plane.macro.getFiscalBalances().observations[0];
  const events = [];
  if (filing) {
    events.push(
      filingAvailableEvent({
        accessionNumber: filing.data.accessionNumber,
        companyName: filing.data.companyName,
        formType: filing.data.formType,
        occurredAt: filing.data.filingDate,
      }),
    );
  }
  if (macro) {
    events.push(
      macroUpdatedEvent({ seriesId: macro.data.seriesId, occurredAt: macro.data.observationDate }),
    );
  }
  if (fiscal) {
    events.push(fiscalReleaseEvent({ period: fiscal.data.period, occurredAt: plane.adapterContext().nowUtc }));
  }
  return Object.freeze(events);
}
