import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';
import { ratioFromUnits, type Ratio } from '@solstice/risk';

import {
  ALPHA_DECOMPOSITION_BUCKETS,
  ALPHA05_RULE_FLAGS,
  HELIOS_ALPHA05_SCHEMA,
  NON_ALPHA_DECOMPOSITION_BUCKETS,
  SKILL_ALPHA_BUCKETS,
} from './taxonomy.ts';
import type { AlphaAttribution, AlphaDecomposition, AlphaDecompositionLine } from './types.ts';
import type { AlphaDecompositionBucket } from './taxonomy.ts';
import { sumRatioUnits } from './numeric.ts';

export type AlphaDecompositionInput = {
  readonly attribution: AlphaAttribution;
  readonly lines: readonly {
    readonly bucket: AlphaDecompositionBucket;
    readonly contribution: Ratio;
    readonly leverageDriven?: boolean;
    readonly sectorConcentrationDriven?: boolean;
    readonly cryptoBetaDriven?: boolean;
  }[];
  readonly computedAt: UtcInstant;
};

function bucketCountsAsSkillAlpha(line: AlphaDecompositionInput['lines'][number]): boolean {
  if (line.leverageDriven === true) {
    return false;
  }
  if (line.sectorConcentrationDriven === true || line.cryptoBetaDriven === true) {
    return false;
  }
  if ((NON_ALPHA_DECOMPOSITION_BUCKETS as readonly string[]).includes(line.bucket)) {
    if (line.bucket === 'POSITION_SIZING' && line.leverageDriven !== true) {
      return false;
    }
    return false;
  }
  return (SKILL_ALPHA_BUCKETS as readonly string[]).includes(line.bucket);
}

export function validateAlphaDecompositionLines(
  lines: AlphaDecompositionInput['lines'],
): readonly string[] {
  const blockers: string[] = [];
  const allowed = new Set<string>(ALPHA_DECOMPOSITION_BUCKETS);
  for (const line of lines) {
    if (!allowed.has(line.bucket)) {
      blockers.push(`unknown decomposition bucket: ${line.bucket}`);
    }
    if (line.bucket === 'MARKET_BETA' && bucketCountsAsSkillAlpha(line)) {
      blockers.push('market beta is not alpha');
    }
    if (line.bucket === 'FACTOR_EXPOSURE') {
      if (line.sectorConcentrationDriven === true && bucketCountsAsSkillAlpha(line)) {
        blockers.push('sector concentration is not alpha');
      }
      if (line.cryptoBetaDriven === true && bucketCountsAsSkillAlpha(line)) {
        blockers.push('crypto beta is not alpha');
      }
    }
    if (line.bucket === 'POSITION_SIZING' && line.leverageDriven === true && bucketCountsAsSkillAlpha(line)) {
      blockers.push('leverage is not alpha');
    }
  }
  const required = new Set(ALPHA_DECOMPOSITION_BUCKETS);
  for (const line of lines) {
    required.delete(line.bucket);
  }
  if (required.size > 0) {
    blockers.push(`missing decomposition buckets: ${[...required].join(',')}`);
  }
  return Object.freeze(blockers);
}

export function buildAlphaDecomposition(input: AlphaDecompositionInput): AlphaDecomposition {
  const validation = validateAlphaDecompositionLines(input.lines);
  if (validation.length > 0) {
    throw new Error(validation.join('; '));
  }

  const frozenLines: AlphaDecompositionLine[] = input.lines.map((line) =>
    Object.freeze({
      bucket: line.bucket,
      contribution: line.contribution,
      countsAsSkillAlpha: bucketCountsAsSkillAlpha(line),
      ...(line.leverageDriven === true ? { leverageDriven: true } : {}),
      ...(line.sectorConcentrationDriven === true ? { sectorConcentrationDriven: true } : {}),
      ...(line.cryptoBetaDriven === true ? { cryptoBetaDriven: true } : {}),
    }),
  );

  const skillAlpha = sumRatioUnits(
    frozenLines.filter((row) => row.countsAsSkillAlpha).map((row) => row.contribution),
  );
  const nonAlpha = sumRatioUnits(
    frozenLines.filter((row) => !row.countsAsSkillAlpha).map((row) => row.contribution),
  );
  const totalLines = sumRatioUnits(frozenLines.map((row) => row.contribution));
  const residualCheck = ratioFromUnits(input.attribution.metrics.activeReturn.units - totalLines.units);

  const material = `${input.attribution.attributionId}:${totalLines.units.toString()}`;
  const decompositionId = `alpha05-dec:${createHash('sha256').update(material).digest('hex').slice(0, 18)}`;

  return Object.freeze({
    schema: HELIOS_ALPHA05_SCHEMA,
    decompositionId,
    campaignId: input.attribution.campaignId,
    attribution: Object.freeze({
      ...input.attribution,
      attributableSkillAlpha: skillAlpha,
      excludedNonAlpha: nonAlpha,
    }),
    lines: Object.freeze(frozenLines),
    skillAlpha,
    nonAlpha,
    residualCheck,
    rules: ALPHA05_RULE_FLAGS,
    computedAt: input.computedAt,
  });
}
