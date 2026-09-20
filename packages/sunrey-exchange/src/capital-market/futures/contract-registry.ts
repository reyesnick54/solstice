/**
 * M03 — futures contract registry with canonical identity patterns.
 *
 * FUTURES:{jurisdiction}:{symbol}:{venue} — family
 * FUTURES:{jurisdiction}:{symbol}{month}{year}:{venue} — specific contract
 * FUTURES:{jurisdiction}:{symbol}:{venue}:CONTINUOUS — continuous research series
 */

import { asUtcInstant } from '../../../../domain/src/time.ts';
import type {
  ContinuousResearchSeriesSpec,
  FuturesContractMonthCode,
  FuturesContractSpec,
  FuturesFamilySpec,
  FuturesRollSnapshot,
  FuturesRollState,
  FuturesVenue,
} from './types.ts';

export const FUTURES_CONTRACT_REGISTRY_ID = 'sunrey.capital-market.futures.v1' as const;

const VENUE_COMEX: FuturesVenue = Object.freeze({
  venueId: 'COMEX',
  mic: 'XCEC',
  displayName: 'COMEX',
  exchange: 'COMEX',
});

function family(input: FuturesFamilySpec): FuturesFamilySpec {
  return Object.freeze(input);
}

function contract(input: FuturesContractSpec): FuturesContractSpec {
  return Object.freeze(input);
}

function continuous(input: ContinuousResearchSeriesSpec): ContinuousResearchSeriesSpec {
  return Object.freeze(input);
}

/** Gold COMEX futures family (GC). */
export const GOLD_FUTURES_FAMILY_ID = 'FUTURES:US:GC:COMEX' as const;

/** Gold continuous research series — analysis only, never executable. */
export const GOLD_FUTURES_CONTINUOUS_ID = 'FUTURES:US:GC:COMEX:CONTINUOUS' as const;

/** Example qualified Dec 2026 GC contract with truthful metadata. */
export const GOLD_FUTURES_GCZ2026_ID = 'FUTURES:US:GCZ2026:COMEX' as const;

export const GOLD_FUTURES_FAMILY: FuturesFamilySpec = family({
  familyId: GOLD_FUTURES_FAMILY_ID,
  rootSymbol: 'GC',
  venue: VENUE_COMEX,
  currency: 'USD',
  defaultMultiplierMinorUnits: 100n,
  defaultMultiplierScale: 0,
  defaultSettlementType: 'PHYSICAL',
  identityKind: 'family',
  executable: false,
});

export const GOLD_FUTURES_GCZ2026: FuturesContractSpec = contract({
  contractId: GOLD_FUTURES_GCZ2026_ID,
  rootSymbol: 'GC',
  contractMonthCode: 'Z',
  contractYear: 2026,
  venue: VENUE_COMEX,
  currency: 'USD',
  multiplierMinorUnits: 100n,
  multiplierScale: 0,
  tickSizeMinorUnits: 10n,
  tickSizeScale: 1,
  settlementType: 'PHYSICAL',
  expirationDate: asUtcInstant('2026-12-28T00:00:00.000Z'),
  firstNoticeDate: asUtcInstant('2026-11-28T00:00:00.000Z'),
  lastTradeDate: asUtcInstant('2026-12-27T00:00:00.000Z'),
  identityKind: 'specific_contract',
  executable: true,
});

export const GOLD_FUTURES_CONTINUOUS: ContinuousResearchSeriesSpec = continuous({
  seriesId: GOLD_FUTURES_CONTINUOUS_ID,
  rootSymbol: 'GC',
  familyId: GOLD_FUTURES_FAMILY_ID,
  venue: VENUE_COMEX,
  currency: 'USD',
  rollMethodology: 'front-month-volume-weighted',
  identityKind: 'continuous_research',
  executable: false,
});

const REGISTERED_FUTURES: readonly (FuturesFamilySpec | FuturesContractSpec | ContinuousResearchSeriesSpec)[] =
  Object.freeze([GOLD_FUTURES_FAMILY, GOLD_FUTURES_GCZ2026, GOLD_FUTURES_CONTINUOUS]);

const byId = new Map(REGISTERED_FUTURES.map((row) => [resolveFuturesId(row), row]));

function resolveFuturesId(
  row: FuturesFamilySpec | FuturesContractSpec | ContinuousResearchSeriesSpec,
): string {
  if (row.identityKind === 'family') return row.familyId;
  if (row.identityKind === 'specific_contract') return row.contractId;
  return row.seriesId;
}

export function resolveFuturesMetadata(
  futuresId: string,
): FuturesFamilySpec | FuturesContractSpec | ContinuousResearchSeriesSpec | undefined {
  return byId.get(futuresId);
}

export function canonicalFuturesFamilyId(jurisdiction: string, rootSymbol: string, venueId: string): string {
  return `FUTURES:${jurisdiction}:${rootSymbol}:${venueId}`;
}

export function canonicalFuturesContractId(
  jurisdiction: string,
  rootSymbol: string,
  monthCode: FuturesContractMonthCode,
  year: number,
  venueId: string,
): string {
  const yy = year % 100;
  return `FUTURES:${jurisdiction}:${rootSymbol}${monthCode}${yy}:${venueId}`;
}

export function canonicalContinuousSeriesId(familyId: string): string {
  return `${familyId}:CONTINUOUS`;
}

export function buildGoldFuturesRollSnapshot(nowUtc: string): FuturesRollSnapshot {
  const frontContractId = GOLD_FUTURES_GCZ2026_ID;
  let rollState: FuturesRollState = 'FRONT';
  const evalMs = Date.parse(nowUtc);
  const expMs = Date.parse(GOLD_FUTURES_GCZ2026.expirationDate);
  if (Number.isFinite(evalMs) && Number.isFinite(expMs) && evalMs > expMs) {
    rollState = 'EXPIRED';
  }
  return Object.freeze({
    familyId: GOLD_FUTURES_FAMILY_ID,
    frontContractId,
    secondContractId: null,
    rollState,
    evaluatedAt: asUtcInstant(nowUtc),
  });
}

export function listRegisteredFutures(): readonly (
  | FuturesFamilySpec
  | FuturesContractSpec
  | ContinuousResearchSeriesSpec
)[] {
  return REGISTERED_FUTURES;
}
