import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';
import { ratioFromUnits } from '@solstice/risk';

import type { BenchmarkComparison } from './types.ts';
import { ALPHA05_RULE_FLAGS, HELIOS_ALPHA05_SCHEMA } from './taxonomy.ts';
import type { AlphaAttribution } from './types.ts';

export type BuildAlphaAttributionInput = {
  readonly comparison: BenchmarkComparison;
  /** Skill alpha before decomposition (e.g. from lines); defaults to active return placeholder. */
  readonly attributableSkillAlphaUnits?: bigint;
  readonly computedAt: UtcInstant;
};

export function buildAlphaAttribution(input: BuildAlphaAttributionInput): AlphaAttribution {
  const active = input.comparison.metrics.activeReturn;
  const skillUnits = input.attributableSkillAlphaUnits ?? active.units;
  const nonAlphaUnits = active.units - skillUnits;
  const material = `${input.comparison.comparisonId}:${skillUnits.toString()}`;
  const attributionId = `alpha05-att:${createHash('sha256').update(material).digest('hex').slice(0, 18)}`;
  return Object.freeze({
    schema: HELIOS_ALPHA05_SCHEMA,
    attributionId,
    campaignId: input.comparison.campaignId,
    comparison: input.comparison,
    metrics: input.comparison.metrics,
    attributableSkillAlpha: ratioFromUnits(skillUnits),
    excludedNonAlpha: ratioFromUnits(nonAlphaUnits),
    rules: ALPHA05_RULE_FLAGS,
    computedAt: input.computedAt,
  });
}
