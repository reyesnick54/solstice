/**
 * EARN06 point-in-time earnings quality feature plane — research inputs only.
 */

import type { UtcInstant } from '@solstice/domain';
import { buildQuarterHistoryAt, computeEarn06QualityFeatures } from './features.ts';
import { detectForensicAccountingChanges } from './forensic-detector.ts';
import { buildEarningsQualityScorecard } from './scorecard.ts';
import type {
  Earn06ManagementGuidance,
  Earn06QualityFeaturePlane,
  Earn06QuarterFinancials,
} from './types.ts';

export type PointInTimeEarningsQualityFabricOptions = {
  readonly canonicalEntityId: string;
};

export class PointInTimeEarningsQualityFabric {
  readonly #entityId: string;
  readonly #quarters = new Map<string, Earn06QuarterFinancials>();

  constructor(options: PointInTimeEarningsQualityFabricOptions) {
    this.#entityId = options.canonicalEntityId;
  }

  ingestQuarter(quarter: Earn06QuarterFinancials): void {
    this.#quarters.set(quarter.fiscalPeriod, quarter);
  }

  compileQualityPlane(input: {
    readonly evaluationTime: UtcInstant;
    readonly fiscalPeriod: string;
    readonly previousQuarterPeriod?: string | null;
    readonly sameQuarterPriorYearPeriod?: string | null;
    readonly trailingFourQuarterPeriods?: readonly string[];
    readonly guidance?: Earn06ManagementGuidance | null;
  }): Earn06QualityFeaturePlane | null {
    const current = this.#quarters.get(input.fiscalPeriod);
    if (!current) {
      return null;
    }
    const history = buildQuarterHistoryAt({
      evaluationTime: input.evaluationTime,
      current,
      previousQuarter: input.previousQuarterPeriod ? this.#quarters.get(input.previousQuarterPeriod) ?? null : null,
      sameQuarterPriorYear: input.sameQuarterPriorYearPeriod
        ? this.#quarters.get(input.sameQuarterPriorYearPeriod) ?? null
        : null,
      trailingFourQuarters: Object.freeze(
        (input.trailingFourQuarterPeriods ?? [])
          .map((p) => this.#quarters.get(p))
          .filter((q): q is Earn06QuarterFinancials => q != null),
      ),
      guidance: input.guidance ?? null,
    });
    if (!history) {
      return null;
    }

    const features = computeEarn06QualityFeatures({ evaluationTime: input.evaluationTime, history });
    const scorecard = buildEarningsQualityScorecard({
      canonicalEntityId: this.#entityId,
      evaluationTime: input.evaluationTime,
      fiscalPeriod: input.fiscalPeriod,
      features,
    });
    const forensic = detectForensicAccountingChanges({ evaluationTime: input.evaluationTime, history });

    return Object.freeze({
      evaluationTime: input.evaluationTime,
      canonicalEntityId: this.#entityId,
      fiscalPeriod: input.fiscalPeriod,
      features,
      scorecard,
      forensic,
      grantsExecutionAuthority: false,
    });
  }
}

export function createPointInTimeEarningsQualityFabric(
  options: PointInTimeEarningsQualityFabricOptions,
): PointInTimeEarningsQualityFabric {
  return new PointInTimeEarningsQualityFabric(options);
}
