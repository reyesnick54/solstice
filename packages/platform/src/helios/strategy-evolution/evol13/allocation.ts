import type { UtcInstant } from '@solstice/domain';
import type { OperatorCreditState, ResearchAllocationPolicy, ResearchComputeAllocation } from './types.ts';
import type { StrategyEvolutionOperatorId } from './taxonomy.ts';
import { STRATEGY_EVOLUTION_OPERATORS } from './taxonomy.ts';
import { operatorProductivityScoreBps } from './credit.ts';
import { sampleBeta } from './stats.ts';

function parseMinor(value: string): bigint {
  return BigInt(value);
}

function allocateExplore(total: bigint, exploreBps: number, n: number): bigint[] {
  if (n <= 0) {
    return [];
  }
  const exploreTotal = (total * BigInt(exploreBps)) / 10_000n;
  const base = exploreTotal / BigInt(n);
  let rem = exploreTotal - base * BigInt(n);
  const out: bigint[] = [];
  for (let i = 0; i < n; i += 1) {
    let x = base;
    if (rem > 0n) {
      x += 1n;
      rem -= 1n;
    }
    out.push(x);
  }
  return out;
}

function ucbScore(meanBps: number, nOper: number, nTotal: number, coeff: number): number {
  const mean = meanBps / 10_000;
  if (nOper <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  const bonus = coeff * Math.sqrt(Math.log(1 + nTotal) / nOper);
  return mean + bonus;
}

/**
 * Split `totalResearchComputeMinor` across operators for the next research epoch.
 * Reserves a bounded exploration budget; never assigns 100% to a single operator.
 */
export function allocateResearchCompute(input: {
  readonly totalResearchComputeMinor: string;
  readonly creditState: OperatorCreditState;
  readonly policy: ResearchAllocationPolicy;
  readonly asOf: UtcInstant;
}): ResearchComputeAllocation {
  const total = parseMinor(input.totalResearchComputeMinor);
  const policy = input.policy;
  const entries = input.creditState.entries;
  const opCount = STRATEGY_EVOLUTION_OPERATORS.length;
  const exploreShares = allocateExplore(total, policy.explorationBudgetBps, opCount);

  const exploitPool = total - exploreShares.reduce((a, b) => a + b, 0n);

  const scores: Record<StrategyEvolutionOperatorId, number> = {
    PARAMETER_MUTATION: 0,
    FEATURE_SUBSTITUTION: 0,
    SUBGRAPH_MUTATION: 0,
    CROSSOVER: 0,
    CMA_ES: 0,
    LLM_PROPOSAL: 0,
    RANDOM_EXPLORATION: 0,
  };

  if (policy.kind === 'THOMPSON') {
    const alpha = policy.symmetricBetaPriorAlpha;
    for (const op of STRATEGY_EVOLUTION_OPERATORS) {
      const e = entries[op];
      const productivity = operatorProductivityScoreBps(e) / 10_000;
      // Blend mean with a Beta draw for exploration (scale to [0,1])
      const draw = sampleBeta(alpha + e.runsCredited * 3, alpha + Math.max(1, e.runsCredited * 2));
      scores[op] = 0.7 * productivity + 0.3 * draw;
    }
  } else {
    let nTotal = 0;
    for (const op of STRATEGY_EVOLUTION_OPERATORS) {
      nTotal += entries[op].runsCredited;
    }
    for (const op of STRATEGY_EVOLUTION_OPERATORS) {
      const e = entries[op];
      const mean = operatorProductivityScoreBps(e);
      let raw = ucbScore(mean, e.runsCredited, Math.max(1, nTotal), policy.ucbExplorationCoefficient);
      if (!Number.isFinite(raw)) {
        raw = 1e12;
      }
      scores[op] = raw;
    }
  }

  const scoreSum = Math.max(
    1e-9,
    STRATEGY_EVOLUTION_OPERATORS.reduce((s, op) => s + Math.max(1e-9, scores[op]), 0),
  );

  const exploitRaw: Record<StrategyEvolutionOperatorId, bigint> = {
    PARAMETER_MUTATION: 0n,
    FEATURE_SUBSTITUTION: 0n,
    SUBGRAPH_MUTATION: 0n,
    CROSSOVER: 0n,
    CMA_ES: 0n,
    LLM_PROPOSAL: 0n,
    RANDOM_EXPLORATION: 0n,
  };

  let allocated = 0n;
  for (let i = 0; i < STRATEGY_EVOLUTION_OPERATORS.length; i += 1) {
    const op = STRATEGY_EVOLUTION_OPERATORS[i]!;
    const w = scores[op] / scoreSum;
    const share = BigInt(Math.floor(Number(exploitPool) * w));
    exploitRaw[op] = share;
    allocated += share;
  }

  let remainder = exploitPool - allocated;
  let idx = 0;
  while (remainder > 0n && idx < 1000) {
    const op = STRATEGY_EVOLUTION_OPERATORS[idx % opCount]!;
    exploitRaw[op] += 1n;
    remainder -= 1n;
    idx += 1;
  }

  const maxShareMinor = (total * BigInt(policy.maxOperatorShareBps)) / 10_000n;

  const combined = (): Record<StrategyEvolutionOperatorId, bigint> => {
    const out = {} as Record<StrategyEvolutionOperatorId, bigint>;
    for (let i = 0; i < STRATEGY_EVOLUTION_OPERATORS.length; i += 1) {
      const op = STRATEGY_EVOLUTION_OPERATORS[i]!;
      out[op] = exploreShares[i]! + exploitRaw[op];
    }
    return out;
  };

  let trial = combined();
  for (let round = 0; round < 32; round += 1) {
    let excess = 0n;
    for (const op of STRATEGY_EVOLUTION_OPERATORS) {
      if (trial[op] > maxShareMinor) {
        excess += trial[op] - maxShareMinor;
        trial[op] = maxShareMinor;
      }
    }
    if (excess === 0n) {
      break;
    }
    const eligible = STRATEGY_EVOLUTION_OPERATORS.filter((op) => trial[op] < maxShareMinor);
    if (eligible.length === 0) {
      break;
    }
    let i = 0;
    while (excess > 0n) {
      const op = eligible[i % eligible.length]!;
      const headroom = maxShareMinor - trial[op];
      if (headroom > 0n) {
        const add = headroom < excess ? headroom : excess;
        trial[op] += add;
        excess -= add;
      }
      i += 1;
      if (i > eligible.length * 1000) {
        break;
      }
    }
  }

  const byOperator = {} as Record<StrategyEvolutionOperatorId, string>;
  for (const op of STRATEGY_EVOLUTION_OPERATORS) {
    byOperator[op] = trial[op].toString();
  }

  return Object.freeze({
    totalResearchComputeMinor: total.toString(),
    byOperator: Object.freeze(byOperator),
    policy,
    asOf: input.asOf,
  });
}

/** Largest single-operator share of total research compute (basis points). */
export function maxOperatorAllocationShareBps(allocation: ResearchComputeAllocation): number {
  const total = parseMinor(allocation.totalResearchComputeMinor);
  if (total <= 0n) {
    return 0;
  }
  let max = 0n;
  for (const op of STRATEGY_EVOLUTION_OPERATORS) {
    const v = parseMinor(allocation.byOperator[op]);
    if (v > max) {
      max = v;
    }
  }
  return Number((max * 10_000n) / total);
}
