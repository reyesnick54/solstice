/**
 * ACCESS-22 stress campaigns (CI smoke vs heavy qualification).
 */

import {
  ACCESS_22_CI_SCALE_LEVELS,
  ACCESS_22_HEAVY_SCALE_LEVELS,
  ACCESS_22_SCENARIO_IDS,
  type Access22ScaleLevel,
} from './ids.ts';
import { ACCESS_22_CATALOG } from './catalog.ts';
import { executeAccess22Scenario } from './engine.ts';
import type { Access22ScenarioResult } from './types.ts';

export const ACCESS_22_SMOKE_SCENARIO_IDS: readonly string[] = Object.freeze([
  'ACCESS22-01-baseline-balanced-economy',
  'ACCESS22-09-mass-access-redemption',
  'ACCESS22-14-both-tokens-crash',
  'ACCESS22-19-whale-concentration',
  'ACCESS22-22-provider-collapse',
  'ACCESS22-40-post-scarcity-multi-category',
  'ACCESS22-45-policy-change-during-open-reservation',
]);

export type Access22CampaignResult = Readonly<{
  readonly campaignId: string;
  readonly scaleLevels: readonly Access22ScaleLevel[];
  readonly scenarioIds: readonly string[];
  readonly results: readonly Access22ScenarioResult[];
  readonly passed: number;
  readonly failed: number;
  readonly violations: number;
}>;

export function runAccess22Campaign(options?: {
  readonly smoke?: boolean;
  readonly heavy?: boolean;
  readonly seed?: number;
}): Access22CampaignResult {
  const smoke = options?.smoke ?? false;
  const heavy = options?.heavy ?? false;
  const scenarioIds = smoke ? ACCESS_22_SMOKE_SCENARIO_IDS : [...ACCESS_22_SCENARIO_IDS];
  const scaleLevels = heavy
    ? [...ACCESS_22_CI_SCALE_LEVELS, ...ACCESS_22_HEAVY_SCALE_LEVELS]
    : [...ACCESS_22_CI_SCALE_LEVELS];

  const results: Access22ScenarioResult[] = [];
  let failed = 0;
  let violations = 0;

  for (const scaleLevel of scaleLevels) {
    for (const scenarioId of scenarioIds) {
      const scenario = ACCESS_22_CATALOG.find((row) => row.scenarioId === scenarioId);
      if (!scenario) {
        continue;
      }
      const resolved =
        options?.seed === undefined ? scenario : Object.freeze({ ...scenario, seed: options.seed });
      const result = executeAccess22Scenario(resolved, scaleLevel);
      results.push(result);
      if (!result.allInvariantsHeld) {
        failed += 1;
        violations += result.invariants.filter((row) => !row.held).length;
      }
      if (!Object.values(result.mechanismTests).every(Boolean)) {
        failed += 1;
      }
    }
  }

  return Object.freeze({
    campaignId: smoke ? 'access22-smoke' : heavy ? 'access22-heavy' : 'access22-ci',
    scaleLevels,
    scenarioIds,
    results,
    passed: results.length - failed,
    failed,
    violations,
  });
}
