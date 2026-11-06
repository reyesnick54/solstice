/**
 * HELIOS CF07 — qualification for sequential off-policy evaluation outputs.
 */

import {
  HELIOS_CF07_SEQUENTIAL_OPE_BLOCKED,
  HELIOS_CF07_SEQUENTIAL_OPE_QUALIFIED,
} from './taxonomy.ts';
import type { SequentialOpeResult } from './types.ts';

export { HELIOS_CF07_SEQUENTIAL_OPE_BLOCKED, HELIOS_CF07_SEQUENTIAL_OPE_QUALIFIED };

export type Cf07SequentialOpeQualificationResult = {
  readonly marker:
    | typeof HELIOS_CF07_SEQUENTIAL_OPE_QUALIFIED
    | typeof HELIOS_CF07_SEQUENTIAL_OPE_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

/**
 * Maps an engine `SequentialOpeResult` to the CF07 qualification marker.
 * Any portfolio violation, blocked diagnostics path, or non-qualified result blocks.
 */
export function evaluateCf07SequentialOpeQualification(
  result: SequentialOpeResult,
): Cf07SequentialOpeQualificationResult {
  const blockers: string[] = [...result.blockedReasons];
  if (!result.qualified) {
    blockers.push('engine_not_qualified');
  }
  if (result.portfolioViolations.length > 0) {
    blockers.push('portfolio_constraints');
  }
  if (result.estimates.fqe === null && result.qualified) {
    blockers.push('fqe_missing_while_marked_qualified');
  }
  const uniq = Array.from(new Set(blockers));
  const qualified = uniq.length === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_CF07_SEQUENTIAL_OPE_QUALIFIED : HELIOS_CF07_SEQUENTIAL_OPE_BLOCKED,
    qualified,
    blockers: Object.freeze(uniq),
  });
}
