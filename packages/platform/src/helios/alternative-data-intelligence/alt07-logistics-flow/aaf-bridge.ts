/**
 * Bridge ALT07 supply/demand features into AAF universal fabric ALT_DATA rows (research only).
 */

import type { UtcInstant } from '@solstice/domain';
import type { SupplyDemandFeatureRow } from './types.ts';

export type Alt07AafFeatureRow = {
  readonly observationRef: string;
  readonly kind: 'ALT_DATA';
  readonly featureKey: string;
  readonly value: number | null;
  readonly knowableAt: UtcInstant;
  readonly grantsExecutionAuthority: false;
};

export function projectAlt07FeaturesToAaf(rows: readonly SupplyDemandFeatureRow[]): readonly Alt07AafFeatureRow[] {
  return Object.freeze(
    rows.map((row) =>
      Object.freeze({
        observationRef: `alt07:feature:${row.featureKey}:${row.geographyOrScope}`,
        kind: 'ALT_DATA' as const,
        featureKey: row.featureKey,
        value: row.value,
        knowableAt: row.knowableAt,
        grantsExecutionAuthority: false,
      }),
    ),
  );
}
