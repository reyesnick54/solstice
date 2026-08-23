import { Money } from '../../../money/src/money.ts';
import { assertNoGuaranteedReturnClaim } from './no-guaranteed-returns.ts';
import type { ScenarioBand } from './types.ts';

/**
 * Scenario modeling. Bands are projections or estimates, never promised
 * outcomes. Uncertainty is explicit.
 */
export function buildGrowScenarios(input: {
  readonly currency: string;
  readonly contributionMinorUnits: string;
  readonly horizonMonths: number;
}): readonly ScenarioBand[] {
  const contribution = Money.fromMinorUnitsString(input.contributionMinorUnits, input.currency);
  const conservative = Object.freeze({
    kind: 'PROJECTION' as const,
    label: 'conservative projection',
    low: contribution.toJSON(),
    high: contribution.toJSON(),
    assumptions: Object.freeze([
      `Horizon ${String(input.horizonMonths)} months is an assumption, not a promise.`,
      'No market return is applied as a guaranteed improvement.',
    ]),
    achievementPromised: false,
    legallyGuaranteedProduct: false,
  });
  const base = Object.freeze({
    kind: 'ESTIMATE' as const,
    label: 'base estimate',
    low: contribution.toJSON(),
    high: contribution.toJSON(),
    assumptions: Object.freeze([
      'Estimate only. Actual result may be lower or higher.',
      'Deposits are not performance.',
    ]),
    achievementPromised: false,
    legallyGuaranteedProduct: false,
  });
  const bands = Object.freeze([conservative, base]);
  assertNoGuaranteedReturnClaim(bands, 'scenario bands');
  return bands;
}
