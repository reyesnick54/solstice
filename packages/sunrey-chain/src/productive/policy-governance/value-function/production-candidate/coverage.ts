/**
 * Deliberate ProductiveCategory coverage reporting.
 *
 * Coverage is reported even when GPUV remains VALUE_UNCONFIGURED.
 * No base value is fabricated merely to claim coverage.
 */

import { PRODUCTIVE_CATEGORIES, type ProductiveCategory } from '../../../types.ts';
import { CATEGORY_UNIT_BINDINGS } from './bindings.ts';
import {
  VALUE_UNCONFIGURED,
  type CategoryCoverageRecord,
  type CategoryCoverageStatus,
  type ProductiveBaseValueScheduleCandidate,
} from './types.ts';

export type CoverageGapHints = {
  readonly unitGaps?: readonly ProductiveCategory[];
  readonly semanticReviewRequired?: readonly ProductiveCategory[];
  readonly providerGaps?: readonly ProductiveCategory[];
  readonly notIntended?: readonly ProductiveCategory[];
};

export function reportCategoryCoverage(
  schedules: readonly ProductiveBaseValueScheduleCandidate[] = [],
  gaps: CoverageGapHints = {},
): readonly CategoryCoverageRecord[] {
  const configured = new Map(schedules.map((row) => [row.productiveCategory, row]));
  const unitGaps = new Set(gaps.unitGaps ?? []);
  const semanticReview = new Set(gaps.semanticReviewRequired ?? []);
  const providerGaps = new Set(gaps.providerGaps ?? []);
  const notIntended = new Set(gaps.notIntended ?? []);
  return Object.freeze(
    PRODUCTIVE_CATEGORIES.map((category) => {
      const binding = CATEGORY_UNIT_BINDINGS[category];
      const schedule = configured.get(category);
      const status = coverageStatus(category, schedule, {
        unitGaps,
        semanticReview,
        providerGaps,
        notIntended,
      });
      return Object.freeze({
        category,
        status,
        canonicalUnit: binding.canonicalUnit,
        semanticQualifier: binding.semanticQualifier,
        dimension: binding.dimension,
        valueStatus: schedule ? 'CONFIGURED_CANDIDATE' : VALUE_UNCONFIGURED,
        scheduleId: schedule?.scheduleId ?? null,
        notes: coverageNotes(status, schedule),
      });
    }),
  );
}

export function everyCategoryReported(records: readonly CategoryCoverageRecord[]): boolean {
  return PRODUCTIVE_CATEGORIES.every((category) => records.some((row) => row.category === category));
}

export function unconfiguredCategories(records: readonly CategoryCoverageRecord[]): readonly ProductiveCategory[] {
  return Object.freeze(records.filter((row) => row.valueStatus === VALUE_UNCONFIGURED).map((row) => row.category));
}

function coverageStatus(
  category: ProductiveCategory,
  schedule: ProductiveBaseValueScheduleCandidate | undefined,
  sets: {
    readonly unitGaps: ReadonlySet<ProductiveCategory>;
    readonly semanticReview: ReadonlySet<ProductiveCategory>;
    readonly providerGaps: ReadonlySet<ProductiveCategory>;
    readonly notIntended: ReadonlySet<ProductiveCategory>;
  },
): CategoryCoverageStatus {
  if (sets.notIntended.has(category)) {
    return 'NOT_INTENDED_FOR_ACTIVATION';
  }
  if (sets.unitGaps.has(category)) {
    return 'UNIT_GAP';
  }
  if (sets.semanticReview.has(category)) {
    return 'SEMANTIC_REVIEW_REQUIRED';
  }
  if (sets.providerGaps.has(category)) {
    return 'PROVIDER_GAP';
  }
  if (schedule) {
    return 'CONFIGURED_CANDIDATE';
  }
  return 'UNCONFIGURED';
}

function coverageNotes(
  status: CategoryCoverageStatus,
  schedule: ProductiveBaseValueScheduleCandidate | undefined,
): string {
  if (status === 'CONFIGURED_CANDIDATE' && schedule?.fixture) {
    return 'fixture candidate only; GPUV not a production value';
  }
  if (status === 'UNCONFIGURED') {
    return 'VALUE_UNCONFIGURED; no production base GPUV invented';
  }
  return status;
}
