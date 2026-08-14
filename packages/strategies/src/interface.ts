import type { UtcInstant } from '../../contracts/src/time.ts';
import type { StrategyClass, StrategyProposal } from '../../contracts/src/strategy-types.ts';
import type { SimulatedSeries } from '../../execution-engine/src/market-data.ts';

/**
 * Strategy interface. Produces typed proposals only — never orders.
 * Strategies hold no execution credentials and no ledger reference.
 */
export interface SimulatedStrategy {
  readonly id: string;
  readonly strategyClass: StrategyClass;
  readonly seed: bigint;
  propose(series: SimulatedSeries, asOf: UtcInstant): readonly StrategyProposal[];
}

export function noCredentials(strategy: SimulatedStrategy): true {
  const record = strategy as unknown as Record<string, unknown>;
  if ('ledger' in record || 'executionAuthority' in record || 'credentials' in record) {
    throw new Error('strategy must not hold a ledger reference or execution credentials');
  }
  return true;
}
