/**
 * Options-derived earnings expectation metrics (pre-event only).
 */

import type { UtcInstant } from '@solstice/domain';
import { OPTION_PRICE_MINOR_SCALE } from './taxonomy.ts';
import { computeDealerGammaProxy } from './dealer-gamma-proxy.ts';
import type {
  HistoricalIvSample,
  OptionChainSnapshot,
  OptionContractObservation,
  OptionsPreEventMetrics,
  OptionsVolumeBaseline,
} from './types.ts';

function spotMajor(spotMinor: bigint): number {
  return Number(spotMinor) / Number(OPTION_PRICE_MINOR_SCALE);
}

function midMinor(contract: OptionContractObservation): bigint | null {
  return contract.quote?.midMinor ?? null;
}

function daysToExpiry(expirationDate: string, asOfIso: string): number {
  const exp = Date.parse(`${expirationDate}T21:00:00.000Z`);
  const asOf = Date.parse(asOfIso);
  if (Number.isNaN(exp) || Number.isNaN(asOf)) {
    return 0;
  }
  return Math.max(0, (exp - asOf) / (86_400_000));
}

function pickAtmPair(
  contracts: readonly OptionContractObservation[],
  spotMinor: bigint,
): { call: OptionContractObservation | null; put: OptionContractObservation | null } {
  const spot = Number(spotMinor);
  let bestCall: OptionContractObservation | null = null;
  let bestPut: OptionContractObservation | null = null;
  let bestCallDist = Number.POSITIVE_INFINITY;
  let bestPutDist = Number.POSITIVE_INFINITY;
  for (const c of contracts) {
    const dist = Math.abs(Number(c.strikeMinor) - spot);
    if (c.right === 'CALL' && dist < bestCallDist) {
      bestCallDist = dist;
      bestCall = c;
    }
    if (c.right === 'PUT' && dist < bestPutDist) {
      bestPutDist = dist;
      bestPut = c;
    }
  }
  return { call: bestCall, put: bestPut };
}

function nearestExpiries(
  contracts: readonly OptionContractObservation[],
  eventAt: UtcInstant,
): { nearTerm: string | null; postEventProxy: string | null } {
  const eventMs = Date.parse(eventAt);
  const expiries = [...new Set(contracts.map((c) => c.expirationDate))].sort();
  let nearTerm: string | null = null;
  let postEventProxy: string | null = null;
  for (const exp of expiries) {
    const ms = Date.parse(`${exp}T21:00:00.000Z`);
    if (ms < eventMs) {
      continue;
    }
    if (nearTerm === null) {
      nearTerm = exp;
      continue;
    }
    if (postEventProxy === null) {
      postEventProxy = exp;
      break;
    }
  }
  if (nearTerm === null && expiries.length > 0) {
    nearTerm = expiries[expiries.length - 1] ?? null;
  }
  return { nearTerm, postEventProxy };
}

function avgIvForExpiry(contracts: readonly OptionContractObservation[], expiry: string | null): number | null {
  if (!expiry) {
    return null;
  }
  const rows = contracts.filter((c) => c.expirationDate === expiry && c.impliedVolatility);
  if (rows.length === 0) {
    return null;
  }
  const sum = rows.reduce((acc, c) => acc + (c.impliedVolatility?.impliedVolBps ?? 0), 0);
  return Math.round(sum / rows.length);
}

function otmSkewBps(
  contracts: readonly OptionContractObservation[],
  spotMinor: bigint,
  right: 'CALL' | 'PUT',
): number | null {
  const spot = Number(spotMinor);
  const filtered = contracts.filter((c) => c.right === right && c.impliedVolatility);
  if (filtered.length === 0) {
    return null;
  }
  const pair = pickAtmPair(contracts, spotMinor);
  const atmIv =
    (right === 'CALL' ? pair.call : pair.put)?.impliedVolatility?.impliedVolBps ?? null;
  if (atmIv === null) {
    return null;
  }
  const otm = filtered
    .filter((c) => (right === 'CALL' ? Number(c.strikeMinor) > spot : Number(c.strikeMinor) < spot))
    .sort(
      (a, b) =>
        Math.abs(Number(a.strikeMinor) - spot) - Math.abs(Number(b.strikeMinor) - spot),
    )[0];
  if (!otm?.impliedVolatility) {
    return null;
  }
  return otm.impliedVolatility.impliedVolBps - atmIv;
}

function sumVolume(
  contracts: readonly OptionContractObservation[],
  predicate: (c: OptionContractObservation) => boolean,
): bigint {
  let total = 0n;
  for (const c of contracts) {
    if (!predicate(c)) {
      continue;
    }
    total += c.volume?.volumeContracts ?? 0n;
  }
  return total;
}

function sumOpenInterest(
  contracts: readonly OptionContractObservation[],
  right?: 'CALL' | 'PUT',
): bigint {
  let total = 0n;
  for (const c of contracts) {
    if (right && c.right !== right) {
      continue;
    }
    total += c.openInterest?.openInterestContracts ?? 0n;
  }
  return total;
}

function ratioScaled(numerator: bigint, denominator: bigint): number | null {
  if (denominator <= 0n) {
    return null;
  }
  return Math.round((Number(numerator) / Number(denominator)) * 10_000);
}

function ivRankPercentile(samples: readonly HistoricalIvSample[], currentIvBps: number | null): {
  rankBps: number | null;
  percentileBps: number | null;
} {
  if (currentIvBps === null || samples.length === 0) {
    return { rankBps: null, percentileBps: null };
  }
  const values = samples.map((s) => s.atmIvBps);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const rankBps = max === min ? 5000 : Math.round(((currentIvBps - min) / (max - min)) * 10_000);
  const below = values.filter((v) => v <= currentIvBps).length;
  const percentileBps = Math.round((below / values.length) * 10_000);
  return { rankBps, percentileBps };
}

export function computeOptionsPreEventMetrics(input: {
  readonly snapshot: OptionChainSnapshot;
  readonly evaluationTime: UtcInstant;
  readonly historicalIv?: readonly HistoricalIvSample[];
  readonly volumeBaseline?: OptionsVolumeBaseline | null;
}): OptionsPreEventMetrics {
  const { snapshot, evaluationTime } = input;
  const spot = spotMajor(snapshot.underlyingSpotMinor);
  const { call, put } = pickAtmPair(snapshot.contracts, snapshot.underlyingSpotMinor);
  const callMid = call ? midMinor(call) : null;
  const putMid = put ? midMinor(put) : null;
  const straddleMinor =
    callMid !== null && putMid !== null ? callMid + putMid : null;
  const atmStraddleMoveBps =
    straddleMinor !== null && spot > 0
      ? Math.round((Number(straddleMinor) / Number(OPTION_PRICE_MINOR_SCALE) / spot) * 10_000)
      : null;

  const expiries = nearestExpiries(snapshot.contracts, snapshot.eventScheduledAt);
  const nearIv = avgIvForExpiry(snapshot.contracts, expiries.nearTerm);
  const postIvProxy = avgIvForExpiry(snapshot.contracts, expiries.postEventProxy);
  const ivTermStructureBps =
    nearIv !== null && postIvProxy !== null ? postIvProxy - nearIv : null;
  const baselineIv = postIvProxy ?? nearIv;
  const ivEventPremiumBps =
    nearIv !== null && baselineIv !== null ? nearIv - baselineIv : null;

  const dte = call ? daysToExpiry(call.expirationDate, evaluationTime) : 0;
  const ivForMove = nearIv ?? call?.impliedVolatility?.impliedVolBps ?? null;
  const ivExpectedMoveBps =
    ivForMove !== null && spot > 0
      ? Math.round(spot * (ivForMove / 10_000) * Math.sqrt(Math.max(dte, 1) / 365) * 10_000 / spot)
      : null;

  const { rankBps, percentileBps } = ivRankPercentile(input.historicalIv ?? [], nearIv);

  const callVol = sumVolume(snapshot.contracts, (c) => c.right === 'CALL');
  const putVol = sumVolume(snapshot.contracts, (c) => c.right === 'PUT');
  const callOi = sumOpenInterest(snapshot.contracts, 'CALL');
  const putOi = sumOpenInterest(snapshot.contracts, 'PUT');
  const spotNum = Number(snapshot.underlyingSpotMinor);
  const directionalCallVolume = sumVolume(
    snapshot.contracts,
    (c) => c.right === 'CALL' && Number(c.strikeMinor) >= spotNum,
  );
  const directionalPutVolume = sumVolume(
    snapshot.contracts,
    (c) => c.right === 'PUT' && Number(c.strikeMinor) <= spotNum,
  );

  const totalVol = callVol + putVol;
  const totalOi = callOi + putOi;
  const volumeToOi = ratioScaled(totalVol, totalOi);
  const baseline = input.volumeBaseline?.medianDailyVolume ?? null;
  const abnormalVol =
    baseline !== null && baseline > 0n
      ? Math.round((Number(totalVol) / Number(baseline)) * 10_000)
      : null;
  const demandImbalance =
    callVol + putVol > 0n
      ? Math.round(((Number(callVol) - Number(putVol)) / Number(callVol + putVol)) * 10_000)
      : null;

  return Object.freeze({
    evaluationTime,
    ATMStraddleImpliedMoveBps: atmStraddleMoveBps,
    IVExpectedMoveBps: ivExpectedMoveBps,
    NearTermIVBps: nearIv,
    PostEventIVProxyBps: postIvProxy,
    IVTermStructureBps: ivTermStructureBps,
    IVEventPremiumBps: ivEventPremiumBps,
    IVRankBps: rankBps,
    IVPercentileBps: percentileBps,
    CallSkewBps: otmSkewBps(snapshot.contracts, snapshot.underlyingSpotMinor, 'CALL'),
    PutSkewBps: otmSkewBps(snapshot.contracts, snapshot.underlyingSpotMinor, 'PUT'),
    PutCallVolumeRatioScaled: ratioScaled(putVol, callVol),
    PutCallOpenInterestRatioScaled: ratioScaled(putOi, callOi),
    DirectionalCallVolume: directionalCallVolume,
    DirectionalPutVolume: directionalPutVolume,
    VolumeToOpenInterestScaled: volumeToOi,
    AbnormalOptionsVolumeScaled: abnormalVol,
    CallPutDemandImbalanceScaled: demandImbalance,
    dealerGammaProxy: computeDealerGammaProxy(snapshot),
    grantsExecutionAuthority: false,
  });
}
