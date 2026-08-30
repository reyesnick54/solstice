/**
 * Shared simulation adapter utilities.
 */

import type { AccessProviderOutcome, ProviderQuote, ProviderSettlementTerms } from '../types.ts';

export const SIMULATION_NOW = '2026-08-23T12:00:00.000Z';
export const SIMULATION_EXPIRES = '2026-08-24T12:00:00.000Z';

export function ok<T>(value: T): AccessProviderOutcome<T> {
  return Object.freeze({ ok: true, value });
}

export function fail(code: string, message: string): AccessProviderOutcome<never> {
  return Object.freeze({ ok: false, code, message });
}

export function settlementTerms(
  providerReceivesMinorUnits: bigint,
  currency = 'USD',
  connectivity: 'SIMULATION' | 'SANDBOX' = 'SIMULATION',
): ProviderSettlementTerms {
  return Object.freeze({
    currency,
    settlementRail: 'FIAT_PAYMENTS',
    providerReceivesMinorUnits,
    simulationOnly: connectivity === 'SIMULATION',
    ...(connectivity === 'SANDBOX' ? { sandboxOnly: true as const } : {}),
  });
}

export function quoteIdFor(material: string): string {
  let hash = 0;
  for (let index = 0; index < material.length; index += 1) {
    hash = (hash * 31 + material.charCodeAt(index)) >>> 0;
  }
  return `pq_${hash.toString(16).padStart(8, '0')}`;
}

export function reservationIdFor(material: string): string {
  return `prsv_${quoteIdFor(material).slice(3)}`;
}

export function bookingIdFor(material: string): string {
  return `pbk_${quoteIdFor(material).slice(3)}`;
}

export function buildQuote(input: {
  readonly quoteId: string;
  readonly providerId: ProviderQuote['providerId'];
  readonly catalogItemId: string;
  readonly canonicalUnit: ProviderQuote['canonicalUnit'];
  readonly quantity: bigint;
  readonly providerPriceMinorUnits: bigint;
  readonly currency?: string;
  readonly connectivity?: 'SIMULATION' | 'SANDBOX';
  readonly providerRateToken?: string | null;
}): ProviderQuote {
  const connectivity = input.connectivity ?? 'SIMULATION';
  return Object.freeze({
    quoteId: input.quoteId,
    providerId: input.providerId,
    catalogItemId: input.catalogItemId,
    canonicalUnit: input.canonicalUnit,
    quantity: input.quantity,
    providerPriceMinorUnits: input.providerPriceMinorUnits,
    currency: input.currency ?? 'USD',
    expiresAt: SIMULATION_EXPIRES,
    settlementTerms: settlementTerms(input.providerPriceMinorUnits, input.currency ?? 'USD', connectivity),
    simulationOnly: connectivity === 'SIMULATION',
    ...(connectivity === 'SANDBOX' ? { sandboxOnly: true as const } : {}),
    providerRateToken: input.providerRateToken ?? null,
  });
}
