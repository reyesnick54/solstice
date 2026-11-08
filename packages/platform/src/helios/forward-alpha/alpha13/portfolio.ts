import { HELIOS_ALPHA13_PORTFOLIO_FORWARD_EVIDENCE_SCHEMA } from './taxonomy.ts';
import type { ForwardStrategyLeg, ForwardStrategyPortfolio } from './types.ts';

export function createForwardStrategyPortfolio(input: {
  readonly portfolioId: string;
  readonly totalCapitalMinor: string;
  readonly legs: readonly ForwardStrategyLeg[];
}): ForwardStrategyPortfolio {
  if (input.legs.length === 0) {
    throw new Error('forward strategy portfolio requires at least one leg');
  }
  const lengths = new Set(input.legs.map((leg) => leg.returnSeriesBps.length));
  if (lengths.size > 1) {
    throw new Error('all strategy return series must share the same length');
  }
  return Object.freeze({
    schema: HELIOS_ALPHA13_PORTFOLIO_FORWARD_EVIDENCE_SCHEMA,
    portfolioId: input.portfolioId,
    totalCapitalMinor: input.totalCapitalMinor,
    legs: Object.freeze(input.legs.map((leg) => Object.freeze({ ...leg, positions: Object.freeze([...leg.positions]) }))),
  });
}
