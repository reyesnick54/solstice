import type { Result, UtcInstant } from '@solstice/domain';
import type {
  OperatorEvolutionRunEvent,
  OperatorCreditState,
  NicheOperatorPerformance,
  ResearchAllocationPolicy,
} from './types.ts';
import type { ResearchStrategyNiche, StrategyEvolutionOperatorId } from './taxonomy.ts';
import { STRATEGY_EVOLUTION_OPERATORS, RESEARCH_STRATEGY_NICHES } from './taxonomy.ts';
import { betaPosteriorMean } from './stats.ts';

function parseMinor(value: string): bigint {
  return BigInt(value);
}

function addMinor(a: string, b: string): string {
  return (BigInt(a) + BigInt(b)).toString();
}

type Accum = {
  runs: number;
  candidates: number;
  valid: number;
  aafPass: number;
  holdoutPass: number;
  falsificationPass: number;
  paper: number;
  noveltyNumerator: bigint;
  compute: bigint;
};

function emptyAccum(): Accum {
  return {
    runs: 0,
    candidates: 0,
    valid: 0,
    aafPass: 0,
    holdoutPass: 0,
    falsificationPass: 0,
    paper: 0,
    noveltyNumerator: 0n,
    compute: 0n,
  };
}

function foldRuns(
  runs: readonly OperatorEvolutionRunEvent[],
  asOf: UtcInstant,
  filter: (row: OperatorEvolutionRunEvent) => boolean,
): Map<StrategyEvolutionOperatorId, Accum> {
  const map = new Map<StrategyEvolutionOperatorId, Accum>();
  for (const op of STRATEGY_EVOLUTION_OPERATORS) {
    map.set(op, emptyAccum());
  }
  for (const row of runs) {
    if (!filter(row)) {
      continue;
    }
    if (Date.parse(row.outcomeVisibleAt as unknown as string) > Date.parse(asOf as unknown as string)) {
      continue;
    }
    const acc = map.get(row.operatorId);
    if (!acc) {
      continue;
    }
    acc.runs += 1;
    acc.candidates += row.candidateCount;
    acc.valid += row.validCandidateCount;
    acc.aafPass += row.aafPassCount;
    acc.holdoutPass += row.holdoutPassCount;
    acc.falsificationPass += row.falsificationPassCount;
    acc.paper += row.paperCandidateCount;
    acc.noveltyNumerator += BigInt(row.noveltyProducedCount);
    acc.compute += parseMinor(row.computeCostMinor);
  }
  return map;
}

function rateBps(successes: number, trials: number, priorAlpha: number): number {
  if (trials === 0) {
    return Math.round(betaPosteriorMean(0, 0, priorAlpha) * 10_000);
  }
  const m = betaPosteriorMean(successes, trials, priorAlpha);
  return Math.round(m * 10_000);
}

function noveltyPerCandidateBps(acc: Accum): number {
  if (acc.candidates <= 0) {
    return 0;
  }
  const ratio = acc.noveltyNumerator / BigInt(acc.candidates);
  const n = Number(ratio);
  return Math.min(10_000, Math.round(n * 10_000));
}

function buildCreditEntries(
  folded: Map<StrategyEvolutionOperatorId, Accum>,
  priorAlpha: number,
): OperatorCreditState['entries'] {
  const out = {} as Record<
    StrategyEvolutionOperatorId,
    OperatorCreditState['entries'][StrategyEvolutionOperatorId]
  >;
  for (const op of STRATEGY_EVOLUTION_OPERATORS) {
    const acc = folded.get(op) ?? emptyAccum();
    out[op] = Object.freeze({
      posteriorValidRateBps: rateBps(acc.valid, acc.candidates, priorAlpha),
      posteriorAafPassRateBps: rateBps(acc.aafPass, acc.candidates, priorAlpha),
      posteriorHoldoutPassRateBps: rateBps(acc.holdoutPass, acc.candidates, priorAlpha),
      posteriorFalsificationPassRateBps: rateBps(acc.falsificationPass, acc.candidates, priorAlpha),
      posteriorPaperCandidateRateBps: rateBps(acc.paper, acc.candidates, priorAlpha),
      noveltyPerCandidateBps: noveltyPerCandidateBps(acc),
      runsCredited: acc.runs,
      totalComputeMinor: acc.compute.toString(),
    });
  }
  return Object.freeze(out);
}

export function buildOperatorCreditState(input: {
  readonly runs: readonly OperatorEvolutionRunEvent[];
  readonly policy: Pick<ResearchAllocationPolicy, 'symmetricBetaPriorAlpha' | 'outcomeCreditDelayMs'>;
  readonly asOf: UtcInstant;
}): OperatorCreditState {
  void input.policy.outcomeCreditDelayMs;
  const folded = foldRuns(input.runs, input.asOf, () => true);
  return Object.freeze({
    schema: 'sunrey.helios.strategy_evolution.operator_credit.v1',
    asOf: input.asOf,
    creditDelayMs: input.policy.outcomeCreditDelayMs,
    entries: buildCreditEntries(folded, input.policy.symmetricBetaPriorAlpha),
  });
}

export function buildNicheOperatorPerformance(input: {
  readonly runs: readonly OperatorEvolutionRunEvent[];
  readonly policy: Pick<ResearchAllocationPolicy, 'symmetricBetaPriorAlpha' | 'outcomeCreditDelayMs'>;
  readonly asOf: UtcInstant;
}): readonly NicheOperatorPerformance[] {
  const { policy, asOf, runs } = input;
  void policy.outcomeCreditDelayMs;
  return RESEARCH_STRATEGY_NICHES.map((nicheId: ResearchStrategyNiche) => {
    const folded = foldRuns(runs, asOf, (row) => row.nicheId === nicheId);
    const perOperator = {} as Record<
      StrategyEvolutionOperatorId,
      NicheOperatorPerformance['perOperator'][StrategyEvolutionOperatorId]
    >;
    for (const op of STRATEGY_EVOLUTION_OPERATORS) {
      const acc = folded.get(op) ?? emptyAccum();
      perOperator[op] = Object.freeze({
        posteriorValidRateBps: rateBps(acc.valid, acc.candidates, policy.symmetricBetaPriorAlpha),
        posteriorAafPassRateBps: rateBps(acc.aafPass, acc.candidates, policy.symmetricBetaPriorAlpha),
        runsCredited: acc.runs,
      });
    }
    return Object.freeze({
      nicheId,
      asOf,
      perOperator: Object.freeze(perOperator),
    });
  });
}

/** Composite productivity score (bps) for allocation: excludes any backtest Sharpe. */
export function operatorProductivityScoreBps(
  credit: OperatorCreditState['entries'][StrategyEvolutionOperatorId],
): number {
  const wValid = 25;
  const wAaf = 20;
  const wHold = 20;
  const wFalse = 15;
  const wPaper = 10;
  const wNov = 10;
  const sum =
    wValid * credit.posteriorValidRateBps +
    wAaf * credit.posteriorAafPassRateBps +
    wHold * credit.posteriorHoldoutPassRateBps +
    wFalse * credit.posteriorFalsificationPassRateBps +
    wPaper * credit.posteriorPaperCandidateRateBps +
    wNov * credit.noveltyPerCandidateBps;
  const denom = (wValid + wAaf + wHold + wFalse + wPaper + wNov) * 10_000;
  return Math.round(sum / denom);
}

export function bridgeH20MarginalCostWithOperatorProductivity(input: {
  readonly marginalResearchCostMinor: string;
  readonly operatorId: StrategyEvolutionOperatorId;
  readonly creditEntries: OperatorCreditState['entries'];
}): Result<
  { readonly productivityBps: number; readonly suggestedMarginalCostMinor: string },
  { readonly code: 'INVALID_COST' }
> {
  let base: bigint;
  try {
    base = parseMinor(input.marginalResearchCostMinor);
  } catch {
    return { ok: false, error: { code: 'INVALID_COST' } };
  }
  if (base < 0n) {
    return { ok: false, error: { code: 'INVALID_COST' } };
  }
  const credit = input.creditEntries[input.operatorId];
  const prod = operatorProductivityScoreBps(credit);
  const productivityBps = Math.max(10_000, Math.min(100_000, prod + 10_000));
  const scaled = (base * BigInt(productivityBps)) / 10_000n;
  return {
    ok: true,
    value: Object.freeze({
      productivityBps,
      suggestedMarginalCostMinor: scaled.toString(),
    }),
  };
}
