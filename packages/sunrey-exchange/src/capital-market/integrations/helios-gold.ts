/**
 * HELIOS M07 — Gold market intelligence integration route.
 *
 * Provider-neutral boundary for Gold ETF, reference, and futures identities.
 */

import { asUtcInstant, type UtcInstant } from '../../../../domain/src/time.ts';
import type { CapitalMarketObservation } from '../types.ts';
import {
  createGoldMarketIntelligenceService,
  GoldMarketIntelligenceService,
  type GoldMarketIntelligenceOptions,
} from '../gold/service.ts';
import type { GoldBarHistoryResult, GoldBarInterval, GoldMarketState } from '../gold/types.ts';
import type { GoldCanonicalIdentity } from '../gold/types.ts';

export type HeliosGoldMarketRouteSnapshot = {
  readonly routeId: 'helios.gold-market.intelligence';
  readonly evaluatedAt: UtcInstant;
  readonly identityCount: number;
};

export type HeliosGoldQuoteResult =
  | { readonly ok: true; readonly observation: CapitalMarketObservation; readonly identity: GoldCanonicalIdentity }
  | { readonly ok: false; readonly code: string; readonly message: string; readonly identityId: string };

export class HeliosGoldMarketRoute {
  readonly #service: GoldMarketIntelligenceService;

  constructor(options: GoldMarketIntelligenceOptions = {}) {
    this.#service = createGoldMarketIntelligenceService(options);
  }

  get service(): GoldMarketIntelligenceService {
    return this.#service;
  }

  status(nowUtc: UtcInstant): HeliosGoldMarketRouteSnapshot {
    return Object.freeze({
      routeId: 'helios.gold-market.intelligence',
      evaluatedAt: nowUtc,
      identityCount: this.#service.resolveIdentity('SECURITY:US:GLD:ARCX') ? 5 : 0,
    });
  }

  async fetchQuote(identityId: string, nowUtc: UtcInstant): Promise<HeliosGoldQuoteResult> {
    const identity = this.#service.resolveIdentity(identityId);
    if (!identity) {
      return Object.freeze({ ok: false, code: 'UNKNOWN_IDENTITY', message: `unknown gold identity ${identityId}`, identityId });
    }
    const result = await this.#service.getQuote(identityId, nowUtc);
    if (!result.ok) {
      return Object.freeze({ ok: false, code: result.code, message: result.message, identityId });
    }
    return Object.freeze({ ok: true, observation: result.value, identity });
  }

  async fetchMarketState(identityId: string, nowUtc: UtcInstant) {
    return this.#service.getMarketState(identityId, nowUtc);
  }

  async fetchBarHistory(
    identityId: string,
    interval: GoldBarInterval,
    range: { readonly from: UtcInstant; readonly to: UtcInstant },
    nowUtc: UtcInstant,
  ): Promise<GoldBarHistoryResult> {
    return this.#service.getBarHistory(identityId, interval, range, nowUtc);
  }

  async fetch4hTrendHistory(
    identityId: string,
    range: { readonly from: UtcInstant; readonly to: UtcInstant },
    nowUtc: UtcInstant,
  ) {
    return this.#service.get4hTrendHistory(identityId, range, nowUtc);
  }

  isExecutable(identityId: string): boolean {
    return this.#service.isExecutable(identityId);
  }
}

export function createHeliosGoldMarketRoute(options?: GoldMarketIntelligenceOptions): HeliosGoldMarketRoute {
  return new HeliosGoldMarketRoute(options);
}

export function heliosGoldMarketNowUtc(): UtcInstant {
  return asUtcInstant(new Date().toISOString());
}
