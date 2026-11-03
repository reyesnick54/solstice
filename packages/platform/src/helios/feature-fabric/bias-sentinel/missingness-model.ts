import { createHash } from 'node:crypto';

import { MISSINGNESS_MODEL_MIN_OBSERVATIONS } from './thresholds.ts';
import type { MissingnessModelDiagnostic, UniverseMemberProfile } from './types.ts';

function bucketKey(parts: readonly string[]): string {
  return parts.filter(Boolean).join('|');
}

/**
 * Diagnostic conditional missingness rates P(missing | coarse strata).
 * Transparent frequency table — not a fitted ML model.
 */
export function diagnoseMissingnessModel(input: {
  readonly intended: readonly UniverseMemberProfile[];
  readonly observedSet: ReadonlySet<string>;
}): MissingnessModelDiagnostic | null {
  const rows = input.intended;
  if (rows.length < MISSINGNESS_MODEL_MIN_OBSERVATIONS) {
    return Object.freeze({
      modelId: 'missingness_strata_v1_insufficient',
      sufficientObservations: false,
      conditionalMissingRates: Object.freeze({}),
      note: 'Insufficient observations for strata missingness diagnostic.',
    });
  }

  const strataCounts = new Map<string, { readonly missing: number; readonly total: number }>();
  for (const member of rows) {
    const strata = bucketKey([
      member.sector ?? 'UNK_SECTOR',
      member.geography ?? 'UNK_GEO',
      member.primaryProviderId ?? 'UNK_PROVIDER',
      member.marketCapMinor === null
        ? 'UNK_CAP'
        : Number(member.marketCapMinor) >= 10_000_000_000
          ? 'MEGA'
          : Number(member.marketCapMinor) >= 2_000_000_000
            ? 'LARGE'
            : 'SMALL',
    ]);
    const prev = strataCounts.get(strata) ?? { missing: 0, total: 0 };
    const missing = input.observedSet.has(member.canonicalEntityId) ? 0 : 1;
    strataCounts.set(strata, { missing: prev.missing + missing, total: prev.total + 1 });
  }

  const rates: Record<string, number> = {};
  for (const [strata, counts] of strataCounts) {
    if (counts.total >= 3) {
      rates[strata] = counts.missing / counts.total;
    }
  }

  const modelId = createHash('sha256')
    .update(JSON.stringify(Object.keys(rates).sort()))
    .digest('hex')
    .slice(0, 16);

  return Object.freeze({
    modelId: `missingness_strata_${modelId}`,
    sufficientObservations: true,
    conditionalMissingRates: Object.freeze(rates),
    note:
      'Conditional missingness rates by sector|geography|provider|cap bucket; descriptive diagnostic only.',
  });
}
