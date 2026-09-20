/**
 * M08 — distinct WTI/oil identity registry.
 *
 * ETF proxy, WTI commodity reference, futures family, and specific contracts
 * are never interchangeable.
 */

import { asUtcInstant } from '../../../../../../domain/src/time.ts';
import {
  buildFuturesContract,
  buildFuturesContinuous,
  buildFuturesFamily,
  futuresContractId,
} from '../../futures/identities.ts';
import type { FuturesContractIdentity, FuturesContinuousIdentity, FuturesFamilyIdentity } from '../../futures/types.ts';

export const WTI_OIL_ETF_PROXY_ID = 'SECURITY:US:USO:ARCX' as const;
export const WTI_COMMODITY_REFERENCE_ID = 'COMMODITY:wti:USD:barrel' as const;

export const WTI_EXCHANGE = 'NYMEX' as const;
export const WTI_ROOT_SYMBOL = 'CL' as const;
export const WTI_FAMILY = 'WTI' as const;

export type OilEtfProxyIdentity = {
  readonly kind: 'security_etf_proxy';
  readonly instrumentId: typeof WTI_OIL_ETF_PROXY_ID;
  readonly symbol: 'USO';
  readonly displayName: 'United States Oil Fund (proxy)';
  readonly venueId: 'ARCX';
  readonly currency: 'USD';
  readonly assetClass: 'etf';
  readonly proxyFor: typeof WTI_COMMODITY_REFERENCE_ID;
};

export type WtiCommodityReferenceIdentity = {
  readonly kind: 'commodity_reference';
  readonly instrumentId: typeof WTI_COMMODITY_REFERENCE_ID;
  readonly symbol: 'WTI';
  readonly displayName: 'West Texas Intermediate Crude Oil (reference)';
  readonly currency: 'USD';
  readonly unit: 'barrel';
  readonly commodityCode: 'wti';
};

export const WTI_FUTURES_FAMILY: FuturesFamilyIdentity = buildFuturesFamily({
  exchange: WTI_EXCHANGE,
  rootSymbol: WTI_ROOT_SYMBOL,
  family: WTI_FAMILY,
  displayName: 'NYMEX WTI Crude Oil Futures',
  currency: 'USD',
  unit: 'barrel',
});

export const WTI_CONTINUOUS_SERIES: FuturesContinuousIdentity = buildFuturesContinuous({
  exchange: WTI_EXCHANGE,
  rootSymbol: WTI_ROOT_SYMBOL,
  family: WTI_FAMILY,
  rollMethod: 'front_month',
});

export function wtiContractMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function buildWtiContract(contractMonth: string): FuturesContractIdentity {
  const [yearStr, monthStr] = contractMonth.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const expirationDay = 20;
  const expirationDate = asUtcInstant(`${year}-${String(month).padStart(2, '0')}-${String(expirationDay).padStart(2, '0')}T19:30:00.000Z`);
  const firstNoticeDay = 1;
  const firstNoticeDate = asUtcInstant(`${year}-${String(month).padStart(2, '0')}-${String(firstNoticeDay).padStart(2, '0')}T00:00:00.000Z`);
  const lastTradeDate = expirationDate;

  return buildFuturesContract({
    exchange: WTI_EXCHANGE,
    rootSymbol: WTI_ROOT_SYMBOL,
    family: WTI_FAMILY,
    contractMonth,
    metadata: Object.freeze({
      contractMonth,
      expirationDate,
      firstNoticeDate,
      lastTradeDate,
      settlementDate: expirationDate,
      multiplierMinorUnits: 100000n,
      multiplierScale: 2,
      tickSizeMinorUnits: 1n,
      tickSizeScale: 2,
      currency: 'USD',
      exchange: WTI_EXCHANGE,
      rootSymbol: WTI_ROOT_SYMBOL,
    }),
  });
}

export const WTI_REGISTERED_CONTRACTS: readonly FuturesContractIdentity[] = Object.freeze([
  buildWtiContract('2026-05'),
  buildWtiContract('2026-06'),
  buildWtiContract('2026-07'),
  buildWtiContract('2026-08'),
  buildWtiContract('2026-09'),
  buildWtiContract('2026-10'),
  buildWtiContract('2026-11'),
  buildWtiContract('2026-12'),
]);

export const OIL_ETF_PROXY: OilEtfProxyIdentity = Object.freeze({
  kind: 'security_etf_proxy',
  instrumentId: WTI_OIL_ETF_PROXY_ID,
  symbol: 'USO',
  displayName: 'United States Oil Fund (proxy)',
  venueId: 'ARCX',
  currency: 'USD',
  assetClass: 'etf',
  proxyFor: WTI_COMMODITY_REFERENCE_ID,
});

export const WTI_COMMODITY_REFERENCE: WtiCommodityReferenceIdentity = Object.freeze({
  kind: 'commodity_reference',
  instrumentId: WTI_COMMODITY_REFERENCE_ID,
  symbol: 'WTI',
  displayName: 'West Texas Intermediate Crude Oil (reference)',
  currency: 'USD',
  unit: 'barrel',
  commodityCode: 'wti',
});

export type WtiIdentity =
  | OilEtfProxyIdentity
  | WtiCommodityReferenceIdentity
  | FuturesFamilyIdentity
  | FuturesContractIdentity
  | FuturesContinuousIdentity;

export function resolveWtiIdentity(instrumentId: string): WtiIdentity | undefined {
  if (instrumentId === WTI_OIL_ETF_PROXY_ID) return OIL_ETF_PROXY;
  if (instrumentId === WTI_COMMODITY_REFERENCE_ID) return WTI_COMMODITY_REFERENCE;
  if (instrumentId === WTI_FUTURES_FAMILY.familyId) return WTI_FUTURES_FAMILY;
  if (instrumentId === WTI_CONTINUOUS_SERIES.continuousId) return WTI_CONTINUOUS_SERIES;
  const contract = WTI_REGISTERED_CONTRACTS.find((c) => c.contractId === instrumentId);
  if (contract) return contract;
  if (instrumentId.startsWith('FUTURES:NYMEX:CL:WTI:')) {
    const month = instrumentId.split(':').pop();
    if (month && month !== 'CONTINUOUS') {
      return buildWtiContract(month);
    }
  }
  return undefined;
}

export function identityKindLabel(identity: WtiIdentity): string {
  return identity.kind;
}

export function assertDistinctIdentity(
  leftId: string,
  rightId: string,
): { readonly ok: true } | { readonly ok: false; readonly message: string } {
  if (leftId === rightId) {
    return Object.freeze({ ok: true });
  }
  const left = resolveWtiIdentity(leftId);
  const right = resolveWtiIdentity(rightId);
  if (!left || !right) {
    return Object.freeze({ ok: true });
  }
  if (left.kind !== right.kind) {
    return Object.freeze({ ok: true });
  }
  return Object.freeze({
    ok: false,
    message: `identities ${leftId} and ${rightId} must not be treated as interchangeable`,
  });
}

export function contractIdForMonth(month: string): string {
  return futuresContractId(WTI_EXCHANGE, WTI_ROOT_SYMBOL, WTI_FAMILY, month);
}
