import type { UtcInstant } from '@solstice/domain';
import { MD08_PRICE_MINOR_SCALE } from './taxonomy.ts';
import { HELIOS_MD08_DERIVATIVES_AUTHORITY, HELIOS_MD08_DERIVATIVES_SCHEMA } from './taxonomy.ts';
import { computeDerivedImpliedVolatility } from './iv-compute.ts';
import { computeResearchGreeks } from './greeks.ts';
import { buildTermStructureForRoot } from './term-structure.ts';
import type {
  DerivativeMarketState,
  Md08FuturesContractState,
  Md08OptionContractState,
  Md08OptionQuote,
} from './types.ts';
import type { Md08FeedTransportState } from './feed-bridge.ts';

function yearsToExpiry(expiry: UtcInstant, evaluatedAt: UtcInstant): number {
  const ms = Date.parse(expiry) - Date.parse(evaluatedAt);
  return Math.max(0, ms / (365.25 * 86_400_000));
}

export function enrichOptionContractWithDerivations(
  contract: Md08OptionContractState,
  underlyingSpotMinor: bigint,
  evaluatedAt: UtcInstant,
  riskFreeRate: number,
): Md08OptionContractState {
  const timeYears = yearsToExpiry(contract.expiry, evaluatedAt);
  const derivedIv = computeDerivedImpliedVolatility({
    spotMinor: underlyingSpotMinor,
    strikeMinor: contract.strikeMinor,
    bidMinor: contract.quote.bidMinor,
    askMinor: contract.quote.askMinor,
    timeYears,
    rate: riskFreeRate,
    call: contract.right === 'CALL',
  });
  const vol =
    contract.exchangeImpliedVolBps !== null
      ? contract.exchangeImpliedVolBps / 10_000
      : (derivedIv.midIvBps ?? 0) / 10_000;
  const spotMajor = Number(underlyingSpotMinor) / Number(MD08_PRICE_MINOR_SCALE);
  const strikeMajor = Number(contract.strikeMinor) / Number(MD08_PRICE_MINOR_SCALE);
  const greeks =
    vol > 0
      ? computeResearchGreeks({
          spotMajor,
          strikeMajor,
          timeYears,
          rate: riskFreeRate,
          vol,
          call: contract.right === 'CALL',
        })
      : null;
  return Object.freeze({
    ...contract,
    derivedImpliedVolatility: derivedIv,
    researchGreeks: greeks,
    evaluatedAt,
  });
}

export function buildDerivativeMarketState(input: {
  readonly snapshotId: string;
  readonly evaluatedAt: UtcInstant;
  readonly futures: readonly Md08FuturesContractState[];
  readonly options: readonly Md08OptionContractState[];
  readonly underlyingSpotById: Readonly<Record<string, bigint>>;
  readonly riskFreeRate: number;
  readonly feedTransport: Md08FeedTransportState | null;
}): DerivativeMarketState {
  const options = Object.freeze(
    input.options.map((row) =>
      enrichOptionContractWithDerivations(
        row,
        input.underlyingSpotById[row.underlyingInstrumentId] ?? 0n,
        input.evaluatedAt,
        input.riskFreeRate,
      ),
    ),
  );
  const byRoot = new Map<string, Md08FuturesContractState[]>();
  for (const future of input.futures) {
    const bucket = byRoot.get(future.rootSymbol) ?? [];
    bucket.push(future);
    byRoot.set(future.rootSymbol, bucket);
  }
  const termStructures = Object.freeze(
    [...byRoot.entries()].map(([rootSymbol, contracts]) =>
      buildTermStructureForRoot({ rootSymbol, contracts }),
    ),
  );
  return Object.freeze({
    schema: HELIOS_MD08_DERIVATIVES_SCHEMA,
    authority: HELIOS_MD08_DERIVATIVES_AUTHORITY,
    snapshotId: input.snapshotId,
    evaluatedAt: input.evaluatedAt,
    futures: Object.freeze([...input.futures]),
    options,
    termStructures,
    feedTransport: input.feedTransport,
    grantsExecutionAuthority: false,
  });
}

export function observedOptionQuote(input: {
  readonly bidMinor: bigint | null;
  readonly askMinor: bigint | null;
  readonly lastTradeMinor: bigint | null;
  readonly observationRef: string;
}): Md08OptionQuote {
  const observed = (ref: string) =>
    Object.freeze({
      kind: 'OBSERVED' as const,
      sourceId: 'helios.md08.simulation-feed',
      observationRef: ref,
      modelId: null,
      notExchangeObserved: false,
    });
  return Object.freeze({
    bidMinor: input.bidMinor,
    askMinor: input.askMinor,
    lastTradeMinor: input.lastTradeMinor,
    bidProvenance: observed(`${input.observationRef}:bid`),
    askProvenance: observed(`${input.observationRef}:ask`),
  });
}
