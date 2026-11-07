/**
 * HELIOS ALT13 — leave-one-provider-out operational confidence.
 */

import type { Alt13EvaluationRow, ProviderDependenceRow, ProviderDependenceState } from './types.ts';
import { computeMae } from './metrics.ts';

export function evaluateProviderDependence(input: {
  readonly featureId: string;
  readonly providerIds: readonly string[];
  readonly rows: readonly Alt13EvaluationRow[];
  readonly providerFeatureMap: Readonly<Record<string, string>>;
}): ProviderDependenceState {
  const rows: ProviderDependenceRow[] = [];

  for (const providerId of input.providerIds) {
    const strippedFeatureId = input.providerFeatureMap[providerId] ?? input.featureId;
    const filtered = input.rows.map((row) => {
      const alt = { ...row.altFeatures };
      delete alt[strippedFeatureId];
      return Object.freeze({ ...row, altFeatures: Object.freeze(alt) });
    });

    const actual: number[] = [];
    const pred: number[] = [];
    for (const row of filtered) {
      const y = row.targets.REVENUE_FORECAST;
      const f = row.altFeatures[input.featureId];
      if (y === undefined) continue;
      pred.push(f ?? 0);
      actual.push(y);
    }

    const degradedMae = computeMae(actual, pred);
    const baselineMae = computeMae(
      input.rows.map((r) => r.targets.REVENUE_FORECAST ?? 0),
      input.rows.map((r) => r.altFeatures[input.featureId] ?? 0),
    );
    const delta = baselineMae > 0 ? (degradedMae - baselineMae) / baselineMae : 0;
    const confidence = Math.max(0, Math.min(10_000, Math.round(10_000 * (1 - Math.min(1, Math.abs(delta))))));

    rows.push(
      Object.freeze({
        providerId,
        metricDeltaWhenExcluded: delta,
        operationalConfidenceBps: confidence,
      }),
    );
  }

  const fragileSingleProvider =
    input.providerIds.length === 1 ||
    rows.some((r) => r.operationalConfidenceBps < 3_500);

  return Object.freeze({
    featureId: input.featureId,
    rows: Object.freeze(rows),
    fragileSingleProvider,
    grantsExecutionAuthority: false,
  });
}
