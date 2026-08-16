import { AssetQuantity } from '../../money/src/asset-quantity.ts';
import { RoundingMode, roundQuotient } from '../../money/src/money.ts';
import { SUNREY_COIN_ASSET_ID, SUNREY_COIN_FORMULA_V1, type FormulaVersionId } from './ids.ts';
import type { ContributionFactors } from './types.ts';

/**
 * Simulation-only reward formula. All factors are 0–100 inclusive bigints.
 * Rounding is FLOOR. This does not optimize for a coin price.
 */
export const FORMULA_BASE_REWARD = 1_000_000n;
export const FACTOR_SCALE = 100n;
export const FACTOR_COUNT = 8n;

export function assertFactor(name: string, value: bigint): void {
  if (typeof value !== 'bigint') {
    throw new TypeError(`${name} must be bigint`);
  }
  if (value < 0n || value > 100n) {
    throw new RangeError(`${name} must be in 0..100`);
  }
}

export function computeRewardAmount(
  factors: ContributionFactors,
  formulaVersion: FormulaVersionId = SUNREY_COIN_FORMULA_V1,
): AssetQuantity {
  if (formulaVersion !== SUNREY_COIN_FORMULA_V1) {
    throw new TypeError(`unknown formula version ${formulaVersion}`);
  }
  assertFactor('provenance', factors.provenance);
  assertFactor('verification', factors.verification);
  assertFactor('freshness', factors.freshness);
  assertFactor('completeness', factors.completeness);
  assertFactor('authorizedScope', factors.authorizedScope);
  assertFactor('uniqueness', factors.uniqueness);
  assertFactor('computationParticipation', factors.computationParticipation);
  assertFactor('researchComputeUtility', factors.researchComputeUtility);
  const product =
    factors.provenance *
    factors.verification *
    factors.freshness *
    factors.completeness *
    factors.authorizedScope *
    factors.uniqueness *
    factors.computationParticipation *
    factors.researchComputeUtility;
  const denominator = FACTOR_SCALE ** FACTOR_COUNT;
  const scaled = roundQuotient(FORMULA_BASE_REWARD * product, denominator, RoundingMode.FLOOR);
  return AssetQuantity.fromScaledUnits(scaled, SUNREY_COIN_ASSET_ID);
}

export function replayKey(input: {
  readonly receiptId: string;
  readonly subjectId: string;
  readonly jobId: string;
  readonly purposeId: string;
  readonly contributionId: string;
  readonly formulaVersion: string;
}): string {
  return [
    input.receiptId,
    input.subjectId,
    input.jobId,
    input.purposeId,
    input.contributionId,
    input.formulaVersion,
  ].join(':');
}
