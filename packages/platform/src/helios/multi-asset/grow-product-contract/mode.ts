import type { PaperGrowReadModelInput } from '../../paper-grow/read-model.ts';
import type { GrowOperatingMode } from './types.ts';

export function resolveOperatingMode(input: PaperGrowReadModelInput): GrowOperatingMode {
  if (input.degradedReasons.includes('PAPER_EXECUTOR_UNAVAILABLE')) {
    return 'SANDBOX';
  }
  if (input.investment && BigInt(input.ledgerCash.paperDeployedMinorUnits) > 0n) {
    return 'PAPER';
  }
  return 'SIMULATION';
}
