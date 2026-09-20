/**
 * M08 — sandbox WTI energy data provider (simulation only, no live network).
 */

import { asUtcInstant, type UtcInstant } from '../../../../../../domain/src/time.ts';
import type { BarInterval, OhlcvBar } from '../../types.ts';
import {
  WTI_COMMODITY_REFERENCE_ID,
  WTI_CONTINUOUS_SERIES,
  WTI_FUTURES_FAMILY,
  WTI_OIL_ETF_PROXY_ID,
  WTI_REGISTERED_CONTRACTS,
  buildWtiContract,
} from './identities.ts';
import type { WtiBarsRequest, WtiDataResult, WtiMarketObservation, WtiProviderHealth } from './types.ts';
import { HELIOS_MULTI_ASSET_AUTHORITY, HELIOS_MULTI_ASSET_SCHEMA } from './types.ts';

export const WTI_SANDBOX_PROVIDER_ID = 'helios-wti-sandbox' as const;
export const WTI_SANDBOX_CREDENTIAL_ENV = 'HELIOS_WTI_SANDBOX_ENABLED' as const;

const BASE_WTI_PRICE = 7850n;
const PRICE_SCALE = 2;

function barSequence(basePrice: bigint, count: number, interval: BarInterval, endTime: UtcInstant): OhlcvBar[] {
  const intervalMs = interval === '1h' ? 3_600_000 : interval === '4h' ? 14_400_000 : 86_400_000;
  const bars: OhlcvBar[] = [];
  const endMs = Date.parse(endTime);

  for (let i = count - 1; i >= 0; i -= 1) {
    const closeMs = endMs - i * intervalMs;
    const openMs = closeMs - intervalMs;
    const drift = BigInt((count - i) * 3);
    const open = basePrice + drift;
    const close = basePrice + drift + 5n;
    const high = close + 10n;
    const low = open - 8n;
    bars.push(
      Object.freeze({
        interval,
        openMinorUnits: open,
        highMinorUnits: high,
        lowMinorUnits: low,
        closeMinorUnits: close,
        volumeUnits: 12500n + BigInt(i * 100),
        barOpenTime: new Date(openMs).toISOString(),
        barCloseTime: new Date(closeMs).toISOString(),
        priceScale: PRICE_SCALE,
        currency: 'USD',
      }),
    );
  }
  return bars;
}

function latestBar(bars: readonly OhlcvBar[]): OhlcvBar {
  return bars[bars.length - 1]!;
}

export type WtiSandboxProviderOptions = {
  readonly simulateFailure?: boolean;
  readonly simulateStale?: boolean;
  readonly simulateEntitlementDenied?: boolean;
  readonly staleAgeMs?: number;
};

export class WtiSandboxProvider {
  readonly #options: WtiSandboxProviderOptions;

  constructor(options: WtiSandboxProviderOptions = {}) {
    this.#options = options;
  }

  get providerId(): string {
    return WTI_SANDBOX_PROVIDER_ID;
  }

  credentialConfigured(): boolean {
    return process.env[WTI_SANDBOX_CREDENTIAL_ENV] === '1' || this.#options.simulateFailure !== true;
  }

  health(nowUtc: UtcInstant): WtiProviderHealth {
    if (this.#options.simulateFailure) {
      return Object.freeze({
        providerId: this.providerId,
        status: 'unavailable',
        credentialConfigured: false,
        message: 'provider failure simulated',
      });
    }
    if (this.#options.simulateEntitlementDenied) {
      return Object.freeze({
        providerId: this.providerId,
        status: 'degraded',
        credentialConfigured: true,
        message: 'entitlement denied for requested feed',
      });
    }
    return Object.freeze({
      providerId: this.providerId,
      status: this.#options.simulateStale ? 'degraded' : 'healthy',
      credentialConfigured: true,
      message: this.#options.simulateStale ? 'data stale beyond policy threshold' : null,
    });
  }

  async getObservation(instrumentId: string, nowUtc: UtcInstant): Promise<WtiDataResult<WtiMarketObservation>> {
    const health = this.health(nowUtc);
    if (this.#options.simulateFailure) {
      return Object.freeze({
        ok: false,
        code: 'PROVIDER_UNAVAILABLE',
        message: health.message ?? 'provider unavailable',
        routeStatus: 'UNAVAILABLE',
      });
    }
    if (this.#options.simulateEntitlementDenied) {
      return Object.freeze({
        ok: false,
        code: 'ENTITLEMENT_DENIED',
        message: 'feed entitlement not granted',
        routeStatus: 'ENTITLEMENT_DENIED',
      });
    }

    const staleOffset = this.#options.simulateStale ? (this.#options.staleAgeMs ?? 7_200_000) : 0;
    const sourceTimestamp = asUtcInstant(new Date(Date.parse(nowUtc) - staleOffset).toISOString());
    const routeStatus = this.#options.simulateStale ? 'STALE' : 'QUALIFIED';

    const barCount = instrumentId.includes(':CONTINUOUS') ? 30 : 20;
    const bars1h = barSequence(BASE_WTI_PRICE, barCount, '1h', nowUtc);
    const bars4h = barSequence(BASE_WTI_PRICE, 12, '4h', nowUtc);
    const bars1d = barSequence(BASE_WTI_PRICE, 10, '1d', nowUtc);
    const allBars = Object.freeze([...bars1h, ...bars4h, ...bars1d]);
    const last = latestBar(bars4h);

    const priceAdjust = instrumentId === WTI_OIL_ETF_PROXY_ID ? -150n : 0n;

    const observation: WtiMarketObservation = Object.freeze({
      schema: HELIOS_MULTI_ASSET_SCHEMA,
      authority: HELIOS_MULTI_ASSET_AUTHORITY,
      instrumentId,
      quote: Object.freeze({
        bidMinorUnits: last.closeMinorUnits + priceAdjust - 2n,
        askMinorUnits: last.closeMinorUnits + priceAdjust + 2n,
        lastMinorUnits: last.closeMinorUnits + priceAdjust,
        openMinorUnits: last.openMinorUnits + priceAdjust,
        highMinorUnits: last.highMinorUnits + priceAdjust,
        lowMinorUnits: last.lowMinorUnits + priceAdjust,
        previousCloseMinorUnits: last.openMinorUnits + priceAdjust,
        volumeUnits: last.volumeUnits,
        priceScale: PRICE_SCALE,
        currency: 'USD',
        sessionStatus: 'OPEN',
      }),
      bars: allBars,
      providerId: this.providerId,
      sourceTimestamp,
      arrivalTimestamp: nowUtc,
      entitlement: Object.freeze({
        entitlementClass: 'sandbox',
        licensedForRealtime: false,
        delayedMinutes: null,
        unavailable: false,
      }),
      rollContext: null,
      observationId: `wti_obs_${instrumentId.replace(/[:]/g, '_')}_${Date.parse(nowUtc)}`,
    });

    return Object.freeze({ ok: true, value: observation, routeStatus, fromCache: false });
  }

  async getBars(request: WtiBarsRequest, nowUtc: UtcInstant): Promise<WtiDataResult<readonly OhlcvBar[]>> {
    const obs = await this.getObservation(request.instrumentId, nowUtc);
    if (!obs.ok) {
      return obs;
    }
    const limit = request.limit ?? 50;
    const filtered = obs.value.bars.filter((bar) => bar.interval === request.interval).slice(-limit);
    return Object.freeze({
      ok: true,
      value: Object.freeze(filtered),
      routeStatus: obs.routeStatus,
      fromCache: obs.fromCache,
    });
  }

  listSupportedInstruments(): readonly string[] {
    return Object.freeze([
      WTI_OIL_ETF_PROXY_ID,
      WTI_COMMODITY_REFERENCE_ID,
      WTI_FUTURES_FAMILY.familyId,
      WTI_CONTINUOUS_SERIES.continuousId,
      ...WTI_REGISTERED_CONTRACTS.map((c) => c.contractId),
    ]);
  }
}

export function createWtiSandboxProvider(options?: WtiSandboxProviderOptions): WtiSandboxProvider {
  return new WtiSandboxProvider(options);
}

export function defaultWtiFrontMonth(nowUtc: UtcInstant): string {
  const contracts = WTI_REGISTERED_CONTRACTS.filter(
    (c) => Date.parse(c.metadata.lastTradeDate) >= Date.parse(nowUtc),
  );
  return contracts[0]?.contractMonth ?? '2026-06';
}

export { buildWtiContract };
