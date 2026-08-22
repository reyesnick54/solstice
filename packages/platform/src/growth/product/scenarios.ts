/**
 * Deterministic CONSERVATIVE / BASE / UPSIDE projections plus an optional
 * seeded monthly sampler. Money stays integer minor units.
 * Outcomes are illustrations, never guaranteed future value.
 */

import { Money, RoundingMode } from '../../../../money/src/money.ts';
import { annualBpsForScenario } from './assumptions.ts';
import type { ScenarioRunId } from './ids.ts';
import { ILLUSTRATION_DISCLAIMER, type GrowRiskProfile, type ScenarioKind } from './taxonomy.ts';
import type {
  GrowMoneyAmount,
  MonteCarloPercentiles,
  PossibleLossIllustration,
  ReturnAssumption,
  ScenarioAnalysis,
  ScenarioInputs,
  ScenarioProjection,
} from './types.ts';

const DEFAULT_SEED = 0x53524e59;
const MONTE_CARLO_PATHS = 256;

export function defaultScenarioSeed(): number {
  return DEFAULT_SEED;
}

export function projectScenarios(input: {
  readonly runId: ScenarioRunId;
  readonly starting: Money;
  readonly monthlyContribution: Money;
  readonly withdrawals: Money;
  readonly timeHorizonMonths: number;
  readonly assumption: ReturnAssumption;
  readonly riskProfile: GrowRiskProfile;
  readonly seed?: number;
}): ScenarioAnalysis {
  const seed = input.seed ?? DEFAULT_SEED;
  const scenarioInputs: ScenarioInputs = {
    startingCapital: input.starting.toJSON(),
    recurringContribution: input.monthlyContribution.toJSON(),
    contributionCadence: 'MONTHLY',
    timeHorizonMonths: input.timeHorizonMonths,
    withdrawals: input.withdrawals.toJSON(),
    assumptionSetId: input.assumption.assumptionSetId,
    assumptionAvailability: input.assumption.availability,
    seed,
  };
  const conservative = projectOne({ ...input, kind: 'CONSERVATIVE' });
  const base = projectOne({ ...input, kind: 'BASE' });
  const upside = projectOne({ ...input, kind: 'UPSIDE' });
  const analysis: ScenarioAnalysis = {
    runId: input.runId,
    methodology:
      input.assumption.methodology ??
      'Deterministic scenario sleeves. Investment outcomes are not promised.',
    inputs: scenarioInputs,
    conservative,
    base,
    upside,
    guaranteedOutcome: false,
  };
  if (input.assumption.availability === 'AVAILABLE') {
    return Object.freeze({
      ...analysis,
      monteCarlo: runSeededSampler({
        starting: input.starting,
        monthlyContribution: input.monthlyContribution,
        withdrawals: input.withdrawals,
        months: input.timeHorizonMonths,
        assumption: input.assumption,
        seed,
      }),
    });
  }
  return Object.freeze(analysis);
}

function projectOne(input: {
  readonly starting: Money;
  readonly monthlyContribution: Money;
  readonly withdrawals: Money;
  readonly timeHorizonMonths: number;
  readonly assumption: ReturnAssumption;
  readonly riskProfile: GrowRiskProfile;
  readonly kind: ScenarioKind;
}): ScenarioProjection {
  const bps = annualBpsForScenario(input.assumption, input.kind);
  const fees = input.assumption.feeBpsAnnual ?? 0;
  const possibleLoss = stressLoss(input.starting, input.assumption);
  if (bps === undefined) {
    const cash = rollForward({
      starting: input.starting,
      monthlyContribution: input.monthlyContribution,
      withdrawals: input.withdrawals,
      months: input.timeHorizonMonths,
      annualBps: 0,
      feeBps: 0,
    });
    return freezeProjection({
      kind: input.kind,
      availability: 'UNAVAILABLE',
      unavailableReason: input.assumption.unavailableReason ?? 'ASSUMPTION_UNAVAILABLE',
      timeHorizonMonths: input.timeHorizonMonths,
      low: cash.ending,
      mid: cash.ending,
      high: cash.ending,
      contributions: cash.contributions,
      feesApplied: cash.fees,
      risk: input.riskProfile,
      possibleLoss,
      assumption: input.assumption,
    });
  }
  const mid = rollForward({
    starting: input.starting,
    monthlyContribution: input.monthlyContribution,
    withdrawals: input.withdrawals,
    months: input.timeHorizonMonths,
    annualBps: bps,
    feeBps: fees,
  });
  const vol = input.assumption.volatilityBps ?? 0;
  const low = rollForward({
    starting: input.starting,
    monthlyContribution: input.monthlyContribution,
    withdrawals: input.withdrawals,
    months: input.timeHorizonMonths,
    annualBps: bps - vol,
    feeBps: fees,
  });
  const high = rollForward({
    starting: input.starting,
    monthlyContribution: input.monthlyContribution,
    withdrawals: input.withdrawals,
    months: input.timeHorizonMonths,
    annualBps: bps + Math.floor(vol / 2),
    feeBps: fees,
  });
  return freezeProjection({
    kind: input.kind,
    availability: 'AVAILABLE',
    timeHorizonMonths: input.timeHorizonMonths,
    low: low.ending,
    mid: mid.ending,
    high: high.ending,
    contributions: mid.contributions,
    feesApplied: mid.fees,
    risk: input.riskProfile,
    possibleLoss,
    assumption: input.assumption,
  });
}

function freezeProjection(input: {
  readonly kind: ScenarioKind;
  readonly availability: ScenarioProjection['availability'];
  readonly unavailableReason?: string;
  readonly timeHorizonMonths: number;
  readonly low: Money;
  readonly mid: Money;
  readonly high: Money;
  readonly contributions: Money;
  readonly feesApplied: Money;
  readonly risk: GrowRiskProfile;
  readonly possibleLoss: PossibleLossIllustration;
  readonly assumption: ReturnAssumption;
}): ScenarioProjection {
  const ordered = [input.low, input.mid, input.high].sort((a, b) => a.cmp(b));
  return Object.freeze({
    kind: input.kind,
    availability: input.availability,
    ...(input.unavailableReason ? { unavailableReason: input.unavailableReason } : {}),
    timeHorizonMonths: input.timeHorizonMonths,
    illustratedLow: ordered[0]!.toJSON(),
    illustratedMid: ordered[1]!.toJSON(),
    illustratedHigh: ordered[2]!.toJSON(),
    contributionsApplied: input.contributions.toJSON(),
    feesApplied: input.feesApplied.toJSON(),
    uncertainty:
      input.availability === 'AVAILABLE'
        ? 'Range around the catalog sleeve using published volatility. Not a confidence interval of a real-world forecast.'
        : 'Investment sleeve unavailable; cash path uses zero market return and is still not a promise.',
    risk: input.riskProfile,
    possibleLoss: input.possibleLoss,
    fees: Object.freeze([
      Object.freeze({
        code: 'SIMULATION_SLEEVE_FEE',
        description: 'Catalog sleeve fee applied inside the projection when known',
        certainty: input.assumption.feeBpsAnnual !== undefined ? 'KNOWN' : 'ESTIMATE',
        ...(input.assumption.feeBpsAnnual !== undefined ? { annualBps: input.assumption.feeBpsAnnual } : {}),
        amount: input.feesApplied.toJSON(),
        includedInProjection: input.availability === 'AVAILABLE',
        note: 'Fees are included. They are not omitted to improve illustrated results.',
      }),
    ]),
    assumptions: input.assumption,
    ...(input.assumption.dataAsOf ? { dataAsOf: input.assumption.dataAsOf, sourceDate: input.assumption.dataAsOf } : {}),
    guaranteedOutcome: false,
    notAPromise: true,
    illustratedOnly: true,
  });
}

export function rollForward(input: {
  readonly starting: Money;
  readonly monthlyContribution: Money;
  readonly withdrawals: Money;
  readonly months: number;
  readonly annualBps: number;
  readonly feeBps: number;
}): { readonly ending: Money; readonly contributions: Money; readonly fees: Money } {
  let balance = input.starting;
  let contributions = Money.zero(input.starting.currency);
  let fees = Money.zero(input.starting.currency);
  const monthlyBps = BigInt(Math.trunc(input.annualBps / 12));
  const monthlyFeeBps = BigInt(Math.max(0, Math.trunc(input.feeBps / 12)));
  for (let i = 0; i < input.months; i += 1) {
    if (input.monthlyContribution.isPositive()) {
      balance = balance.plus(input.monthlyContribution);
      contributions = contributions.plus(input.monthlyContribution);
    }
    if (input.withdrawals.isPositive() && balance.cmp(input.withdrawals) >= 0) {
      balance = balance.minus(input.withdrawals);
    }
    const grown = applyBps(balance, monthlyBps);
    const fee = monthlyFeeBps === 0n ? Money.zero(balance.currency) : grown.allocate(monthlyFeeBps, 10000n, RoundingMode.HALF_EVEN);
    balance = grown.minus(fee);
    fees = fees.plus(fee);
    if (balance.isNegative()) {
      balance = Money.zero(balance.currency);
    }
  }
  return { ending: balance, contributions, fees };
}

function applyBps(amount: Money, monthlyBps: bigint): Money {
  const numerator = 10000n + monthlyBps;
  if (numerator <= 0n) {
    return Money.zero(amount.currency);
  }
  return amount.allocate(numerator, 10000n, RoundingMode.HALF_EVEN);
}

function stressLoss(starting: Money, assumption: ReturnAssumption): PossibleLossIllustration {
  const vol = assumption.volatilityBps ?? 1000;
  const stressed = starting.allocate(BigInt(Math.max(0, 10000 - vol)), 10000n, RoundingMode.FLOOR);
  return Object.freeze({
    illustrated: true,
    guaranteed: false,
    oneYearStress: stressed.toJSON(),
    note: `Invested amounts can decline. One-year stress uses catalog volatility (${String(vol)} bps). ${ILLUSTRATION_DISCLAIMER}`,
  });
}

function runSeededSampler(input: {
  readonly starting: Money;
  readonly monthlyContribution: Money;
  readonly withdrawals: Money;
  readonly months: number;
  readonly assumption: ReturnAssumption;
  readonly seed: number;
}): MonteCarloPercentiles {
  const mean = input.assumption.baseAnnualBps ?? 0;
  const vol = input.assumption.volatilityBps ?? 0;
  const fee = input.assumption.feeBpsAnnual ?? 0;
  const endings: Money[] = [];
  let rng = BigInt(input.seed >>> 0);
  let below = 0;
  for (let path = 0; path < MONTE_CARLO_PATHS; path += 1) {
    const draw = nextNormalBps(rng, mean, vol);
    rng = draw.state;
    const rolled = rollForward({
      starting: input.starting,
      monthlyContribution: input.monthlyContribution,
      withdrawals: input.withdrawals,
      months: input.months,
      annualBps: draw.bps,
      feeBps: fee,
    });
    endings.push(rolled.ending);
    if (rolled.ending.cmp(input.starting) < 0) {
      below += 1;
    }
  }
  endings.sort((a, b) => a.cmp(b));
  const at = (pct: number): GrowMoneyAmount => endings[Math.min(endings.length - 1, Math.floor((pct / 100) * endings.length))]!.toJSON();
  return Object.freeze({
    pathCount: MONTE_CARLO_PATHS,
    seed: input.seed,
    methodology:
      'Seeded LCG + 12-uniform Irwin-Hall annual-return draw, then integer monthly compounding. Simulation illustration, not a market forecast.',
    p10: at(10),
    p50: at(50),
    p90: at(90),
    pathsBelowStart: below,
    illustratedShareBelowStart: `${String(below)}/${String(MONTE_CARLO_PATHS)} sampled paths ended below starting capital after fees.`,
    guaranteedOutcome: false,
    notAPromise: true,
    probabilityLanguage:
      'Share of sampled paths under these catalog assumptions. Not a real-world probability of loss or of reaching a goal.',
  });
}

function nextNormalBps(
  state: bigint,
  meanBps: number,
  volBps: number,
): { readonly state: bigint; readonly bps: number } {
  let current = state;
  let sum = 0n;
  for (let i = 0; i < 12; i += 1) {
    current = (current * 1664525n + 1013904223n) & 0xffffffffn;
    sum += current % 10000n;
  }
  const zNumer = sum - 60000n;
  const raw = BigInt(meanBps) + (BigInt(volBps) * zNumer) / 10000n;
  const clamped = raw < -5000n ? -5000n : raw > 5000n ? 5000n : raw;
  return { state: current, bps: Number(clamped) };
}
