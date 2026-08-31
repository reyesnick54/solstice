/**
 * Consumer BFF surface for market reference data.
 *
 * Reference/research only. Does not expose execution quotes or mutate Exchange state.
 */

import { asUtcInstant } from '../../../../packages/domain/src/time.ts';
import {
  COMMODITY_CODES,
  DEFAULT_MARKET_REFERENCE_NOW,
  buildSandboxAssetMetadata,
  buildSandboxCommodityObservation,
  buildSandboxHistory,
  buildSandboxQuote,
  resolveMarketAsset,
  syncExecutionSeparationProof,
} from '../../../../packages/sunrey-exchange/src/market-reference/index.ts';
import type { CommodityCode, HistoryInterval } from '../../../../packages/sunrey-exchange/src/market-reference/types.ts';
import { bffError, type BffErrorEnvelope } from './errors.ts';
import type { BffPrincipal } from './ports.ts';

const DEFAULT_ASSETS = Object.freeze(['SIM-ETF-1', 'COMMODITY:gold:USD:troy_oz', 'COMMODITY:silver:USD:troy_oz', 'COMMODITY:copper:USD:lb']);

export type MarketReferenceBffSurface = {
  reference(principal: BffPrincipal, requestId: string): unknown | BffErrorEnvelope;
  asset(principal: BffPrincipal, assetId: string, requestId: string): unknown | BffErrorEnvelope;
  history(
    principal: BffPrincipal,
    assetId: string,
    query: Readonly<Record<string, string>>,
    requestId: string,
  ): unknown | BffErrorEnvelope;
  worldResources(principal: BffPrincipal, requestId: string): unknown | BffErrorEnvelope;
  worldResource(principal: BffPrincipal, resource: string, requestId: string): unknown | BffErrorEnvelope;
};

export function createMarketReferenceBffSurface(): MarketReferenceBffSurface {
  const nowUtc = DEFAULT_MARKET_REFERENCE_NOW;

  return Object.freeze({
    reference(principal: BffPrincipal, requestId: string) {
      void principal;
      return {
        schema: 'sunrey.bff.market-reference.v1',
        requestId,
        referenceOnly: true,
        executionAuthorized: false,
        environment: 'simulation',
        catalogPopulationStatus: 'awaiting_master_list',
        catalogProviderCount: 0,
        simulationFallback: true,
        separation: syncExecutionSeparationProof(),
      };
    },

    asset(principal: BffPrincipal, assetId: string, requestId: string) {
      void principal;
      if (!resolveMarketAsset(assetId)) {
        return bffError({
          errorCode: 'NOT_FOUND',
          category: 'NOT_FOUND',
          message: `unknown asset ${assetId}`,
          retryable: false,
          requestId,
        });
      }
      const metadata = buildSandboxAssetMetadata(assetId, nowUtc);
      const quote = buildSandboxQuote(resolveMarketAsset(assetId)!, nowUtc);
      return {
        schema: 'sunrey.bff.market-asset.v1',
        requestId,
        referenceOnly: true,
        metadata,
        quote: {
          priceMinorUnits: quote.priceMinorUnits.toString(),
          currency: quote.currency,
          freshness: quote.freshness.status,
          providerId: quote.providerId,
          observationId: quote.provenance.observationId,
          fromCache: false,
        },
      };
    },

    history(principal: BffPrincipal, assetId: string, query: Readonly<Record<string, string>>, requestId: string) {
      void principal;
      if (!resolveMarketAsset(assetId)) {
        return bffError({
          errorCode: 'NOT_FOUND',
          category: 'NOT_FOUND',
          message: `unknown asset ${assetId}`,
          retryable: false,
          requestId,
        });
      }
      const interval = (query.interval ?? '1d') as HistoryInterval;
      const from = asUtcInstant(query.from ?? '2026-01-01T00:00:00.000Z');
      const to = asUtcInstant(query.to ?? nowUtc);
      const candles = buildSandboxHistory(assetId, interval, from, to, nowUtc);
      return {
        schema: 'sunrey.bff.market-history.v1',
        requestId,
        referenceOnly: true,
        assetId,
        interval,
        candles: candles.map((candle) => ({
          openMinorUnits: candle.openMinorUnits.toString(),
          highMinorUnits: candle.highMinorUnits.toString(),
          lowMinorUnits: candle.lowMinorUnits.toString(),
          closeMinorUnits: candle.closeMinorUnits.toString(),
          volumeUnits: candle.volumeUnits?.toString() ?? null,
          currency: candle.currency,
          adjustmentStatus: candle.adjustmentStatus,
          periodStart: candle.periodStart,
          periodEnd: candle.periodEnd,
          providerId: candle.providerId,
        })),
        fromCache: false,
      };
    },

    worldResources(principal: BffPrincipal, requestId: string) {
      void principal;
      const markets = DEFAULT_ASSETS.map((assetId) => {
        const quote = buildSandboxQuote(resolveMarketAsset(assetId)!, nowUtc);
        return {
          assetId: quote.assetId,
          symbol: quote.symbol,
          venue: quote.venue?.displayName ?? null,
          priceMinorUnits: quote.priceMinorUnits.toString(),
          currency: quote.currency,
          providerId: quote.providerId,
        };
      });
      const resources = COMMODITY_CODES.map((commodity) => {
        const row = buildSandboxCommodityObservation(commodity, nowUtc);
        return {
          commodity,
          priceMinorUnits: row.priceMinorUnits.toString(),
          currency: row.currency,
          unit: row.unit.symbol,
          providerId: row.providerId,
        };
      });
      return {
        schema: 'sunrey.bff.world.resources.v1',
        requestId,
        referenceOnly: true,
        generatedAt: nowUtc,
        markets,
        resources,
        commodities: COMMODITY_CODES,
      };
    },

    worldResource(principal: BffPrincipal, resource: string, requestId: string) {
      void principal;
      const normalized = resource.toLowerCase();
      const unavailableResources = new Set(['lithium', 'water', 'hydrogen', 'energy']);
      if (unavailableResources.has(normalized)) {
        return {
          schema: 'sunrey.bff.world.resource.v1',
          requestId,
          referenceOnly: true,
          commodity: normalized,
          dataState: 'UNAVAILABLE',
          priceMinorUnits: null,
          currency: null,
          unit: null,
          normalizedUnit: null,
          marketReference: null,
          observationId: null,
          issuanceAuthority: false,
          reason: 'no eligible live source for this resource',
        };
      }
      if (!(COMMODITY_CODES as readonly string[]).includes(resource)) {
        return bffError({
          errorCode: 'NOT_FOUND',
          category: 'NOT_FOUND',
          message: `unknown resource ${resource}`,
          retryable: false,
          requestId,
        });
      }
      const result = buildSandboxCommodityObservation(resource as CommodityCode, nowUtc);
      return {
        schema: 'sunrey.bff.world.resource.v1',
        requestId,
        referenceOnly: true,
        commodity: result.commodity,
        priceMinorUnits: result.priceMinorUnits.toString(),
        currency: result.currency,
        unit: result.unit.symbol,
        normalizedUnit: result.normalizedUnit?.symbol ?? null,
        marketReference: result.marketReference,
        providerId: result.providerId,
        observationId: result.provenance.observationId,
        issuanceAuthority: false,
      };
    },
  });
}
