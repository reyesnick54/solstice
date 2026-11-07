/**
 * Model-derived implied volatility from observable quotes.
 * Never labeled as exchange-observed.
 */

import { MD08_DERIVED_IV_LABEL, MD08_PRICE_MINOR_SCALE } from './taxonomy.ts';
import type { Md08DerivedImpliedVolatility, Md08Provenance } from './types.ts';

const DERIVED_IV_PROVENANCE: Md08Provenance = Object.freeze({
  kind: 'DERIVED',
  sourceId: 'helios.md08.iv.black-scholes-european.v1',
  observationRef: null,
  modelId: 'black-scholes-european-newton',
  notExchangeObserved: true,
});

function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p =
    d *
    t *
    (0.3193825 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

function blackScholesPrice(input: {
  readonly spot: number;
  readonly strike: number;
  readonly timeYears: number;
  readonly rate: number;
  readonly vol: number;
  readonly call: boolean;
}): number {
  if (input.timeYears <= 0 || input.vol <= 0) {
    return Math.max(0, input.call ? input.spot - input.strike : input.strike - input.spot);
  }
  const sqrtT = Math.sqrt(input.timeYears);
  const d1 =
    (Math.log(input.spot / input.strike) + (input.rate + 0.5 * input.vol * input.vol) * input.timeYears) /
    (input.vol * sqrtT);
  const d2 = d1 - input.vol * sqrtT;
  if (input.call) {
    return input.spot * normCdf(d1) - input.strike * Math.exp(-input.rate * input.timeYears) * normCdf(d2);
  }
  return input.strike * Math.exp(-input.rate * input.timeYears) * normCdf(-d2) - input.spot * normCdf(-d1);
}

function impliedVolBpsFromPrice(input: {
  readonly spotMajor: number;
  readonly strikeMajor: number;
  readonly priceMajor: number;
  readonly timeYears: number;
  readonly rate: number;
  readonly call: boolean;
}): number | null {
  if (input.priceMajor <= 0 || input.spotMajor <= 0 || input.strikeMajor <= 0) {
    return null;
  }
  let lo = 1e-4;
  let hi = 5;
  let mid = 0.2;
  for (let i = 0; i < 48; i += 1) {
    mid = (lo + hi) / 2;
    const model = blackScholesPrice({
      spot: input.spotMajor,
      strike: input.strikeMajor,
      timeYears: input.timeYears,
      rate: input.rate,
      vol: mid,
      call: input.call,
    });
    if (model > input.priceMajor) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return Math.round(mid * 10_000);
}

function majorFromMinor(minor: bigint): number {
  return Number(minor) / Number(MD08_PRICE_MINOR_SCALE);
}

export function computeDerivedImpliedVolatility(input: {
  readonly spotMinor: bigint;
  readonly strikeMinor: bigint;
  readonly bidMinor: bigint | null;
  readonly askMinor: bigint | null;
  readonly timeYears: number;
  readonly rate: number;
  readonly call: boolean;
}): Md08DerivedImpliedVolatility {
  const spot = majorFromMinor(input.spotMinor);
  const strike = majorFromMinor(input.strikeMinor);
  const bidIv =
    input.bidMinor !== null
      ? impliedVolBpsFromPrice({
          spotMajor: spot,
          strikeMajor: strike,
          priceMajor: majorFromMinor(input.bidMinor),
          timeYears: input.timeYears,
          rate: input.rate,
          call: input.call,
        })
      : null;
  const askIv =
    input.askMinor !== null
      ? impliedVolBpsFromPrice({
          spotMajor: spot,
          strikeMajor: strike,
          priceMajor: majorFromMinor(input.askMinor),
          timeYears: input.timeYears,
          rate: input.rate,
          call: input.call,
        })
      : null;
  let midIv: number | null = null;
  if (bidIv !== null && askIv !== null) {
    midIv = Math.round((bidIv + askIv) / 2);
  } else if (bidIv !== null) {
    midIv = bidIv;
  } else if (askIv !== null) {
    midIv = askIv;
  }
  return Object.freeze({
    midIvBps: midIv,
    bidIvBps: bidIv,
    askIvBps: askIv,
    provenance: DERIVED_IV_PROVENANCE,
    label: MD08_DERIVED_IV_LABEL,
  });
}
