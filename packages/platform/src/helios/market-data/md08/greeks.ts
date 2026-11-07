/**
 * Research Greeks from model IV — DERIVED only, not exchange feed fields.
 */

import type { Md08ResearchGreeks } from './types.ts';

const GREEKS_PROVENANCE = Object.freeze({
  kind: 'DERIVED' as const,
  sourceId: 'helios.md08.greeks.black-scholes-european.v1',
  observationRef: null,
  modelId: 'black-scholes-european-analytic',
  notExchangeObserved: true,
});

function normPdf(x: number): number {
  return Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI);
}

function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p =
    d *
    t *
    (0.3193825 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

export function computeResearchGreeks(input: {
  readonly spotMajor: number;
  readonly strikeMajor: number;
  readonly timeYears: number;
  readonly rate: number;
  readonly vol: number;
  readonly call: boolean;
}): Md08ResearchGreeks {
  if (input.timeYears <= 0 || input.vol <= 0 || input.spotMajor <= 0 || input.strikeMajor <= 0) {
    return Object.freeze({
      deltaBps: null,
      gammaBps: null,
      vegaBps: null,
      thetaBps: null,
      provenance: GREEKS_PROVENANCE,
      researchOnly: true,
    });
  }
  const sqrtT = Math.sqrt(input.timeYears);
  const d1 =
    (Math.log(input.spotMajor / input.strikeMajor) +
      (input.rate + 0.5 * input.vol * input.vol) * input.timeYears) /
    (input.vol * sqrtT);
  const pdf = normPdf(d1);
  const nd1 = normCdf(d1);
  const gamma = pdf / (input.spotMajor * input.vol * sqrtT);
  const vega = (input.spotMajor * pdf * sqrtT) / 100;
  const delta = input.call ? nd1 : nd1 - 1;
  const theta =
    (-(input.spotMajor * pdf * input.vol) / (2 * sqrtT) -
      input.rate * input.strikeMajor * Math.exp(-input.rate * input.timeYears) * normCdf(d1 - input.vol * sqrtT)) /
    365;
  return Object.freeze({
    deltaBps: Math.round(delta * 10_000),
    gammaBps: Math.round(gamma * 10_000),
    vegaBps: Math.round(vega * 10_000),
    thetaBps: Math.round(theta * 10_000),
    provenance: GREEKS_PROVENANCE,
    researchOnly: true,
  });
}
