/**
 * Useful monotonicity and safety invariants.
 *
 * Monotonicity is imposed only where the simulation policy treats the
 * factor as monotonic. Scarcity and geography are bounded context
 * factors and are not claimed to be universally monotonic.
 */

import { emptyMoonReySupply } from '../../supply.ts';
import { MoonReyEconomicShadowEvaluator } from './evaluator.ts';
import {
  PRODUCTION_MIGRATION_APPROVED,
  V2_PRODUCTION_ACTIVE,
} from './identities.ts';
import { representativeScenario } from './scenarios.ts';
import type { ShadowInvariantName } from './types.ts';
import { evaluateGovernedV2 } from './v2.ts';

export type InvariantResult = {
  readonly name: ShadowInvariantName;
  readonly holds: boolean;
  readonly detail: string;
};

export function checkShadowInvariants(): readonly InvariantResult[] {
  const base = representativeScenario('solar-energy');
  const lowerShare = evaluateGovernedV2({
    ...base,
    attributionShare: { numerator: 200_000n, denominator: 1_000_000n },
  });
  const higherShare = evaluateGovernedV2({
    ...base,
    attributionShare: { numerator: 400_000n, denominator: 1_000_000n },
  });
  const lowerQuality = evaluateGovernedV2({
    ...base,
    evidence: { ...base.evidence, quality: 400_000n },
  });
  const higherQuality = evaluateGovernedV2(base);
  const staler = evaluateGovernedV2({
    ...base,
    evidence: { ...base.evidence, freshnessAgeEpochs: 4n },
  });
  const fresher = evaluateGovernedV2({
    ...base,
    evidence: { ...base.evidence, freshnessAgeEpochs: 0n },
  });
  const strictCap = evaluateGovernedV2({ ...base, conversionCap: 10n });
  const looseCap = evaluateGovernedV2({ ...base, conversionCap: 50_000_000n });
  const evaluator = new MoonReyEconomicShadowEvaluator(emptyMoonReySupply());
  const first = evaluator.evaluate(base);
  const replay = evaluator.evaluate({ ...base, replayAttempt: 1, scenarioId: 'solar-energy.replay' });
  const supplyUnchanged = evaluator.canonicalSupply().issued === 0n;

  return Object.freeze([
    result(
      'LOWER_ATTRIBUTION_CANNOT_INCREASE_VALUE',
      valuedAtMost(lowerShare.quantity, higherShare.quantity),
      'lower attribution share cannot produce greater attributed value with all else equal',
    ),
    result(
      'LOWER_QUALITY_CANNOT_INCREASE_VALUE',
      valuedAtMost(lowerQuality.quantity, higherQuality.quantity),
      'verification quality is monotonic under the simulation policy',
    ),
    result(
      'STALER_EVIDENCE_CANNOT_INCREASE_FRESHNESS',
      valuedAtMost(staler.quantity, fresher.quantity),
      'staler evidence cannot increase freshness factor',
    ),
    result(
      'STRICTER_CAP_CANNOT_INCREASE_OUTPUT',
      valuedAtMost(strictCap.quantity, looseCap.quantity),
      'applying a stricter cap cannot increase output',
    ),
    result(
      'REPLAY_CANNOT_INCREASE_ATTRIBUTION',
      first.v2Valued && !replay.v2Valued,
      'replaying the same event cannot increase canonical attribution',
    ),
    result(
      'SHADOW_CANNOT_CHANGE_SUPPLY',
      supplyUnchanged && first.supplyMutated === false,
      'shadow evaluation cannot change supply',
    ),
    result(
      'PRODUCTION_INACTIVE_REMAINS_TRUE',
      V2_PRODUCTION_ACTIVE === false && PRODUCTION_MIGRATION_APPROVED === false,
      'production inactive remains true',
    ),
  ]);
}

function valuedAtMost(left: bigint | null, right: bigint | null): boolean {
  if (left === null || right === null) {
    return left === null || right !== null;
  }
  return left <= right;
}

function result(name: ShadowInvariantName, holds: boolean, detail: string): InvariantResult {
  return Object.freeze({ name, holds, detail });
}

export function shadowInvariantsHold(results: readonly InvariantResult[] = checkShadowInvariants()): boolean {
  return results.every((item) => item.holds);
}
