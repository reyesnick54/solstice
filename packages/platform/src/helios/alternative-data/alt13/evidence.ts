/**
 * HELIOS ALT13 — sealed incremental-information evidence builder.
 */

import { benjaminiHochbergFdr } from '../../strategy-evolution/evol09/stats.ts';
import { buildSignalDecayState } from './decay.ts';
import { evaluateIncrementalInformationState, registerAlternativeSignalHypothesis } from './evaluation.ts';
import { ALT13_REFERENCE_REGISTERED_AT, seedAlt13ReferencePanel } from './fixtures.ts';
import { evaluateProviderDependence } from './provider-dependence.ts';
import { detectDemandRedundancy } from './redundancy.ts';
import { buildSignalStabilityState } from './stability.ts';
import {
  HELIOS_ALT13_INCREMENTAL_INFORMATION_BLOCKED,
  HELIOS_ALT13_INCREMENTAL_INFORMATION_QUALIFIED,
  HELIOS_ALT13_SCHEMA,
  ALT13_FDR_LEVEL,
  ALT13_MIN_OOS_ROWS,
  ALT13_PRIMARY_FORECAST_TARGETS,
} from './taxonomy.ts';
import { createAltFeatureHypothesisTrialRegistry } from './trial-registry.ts';
import type { Alt13IncrementalInformationEvidence, IncrementalMetricReading } from './types.ts';

function attachFdrToMetrics(readings: readonly IncrementalMetricReading[]): readonly IncrementalMetricReading[] {
  const pValues = readings.map((r) => r.rawPValue ?? 1);
  const fdr = benjaminiHochbergFdr({ pValues, q: ALT13_FDR_LEVEL });
  return Object.freeze(
    readings.map((r, i) =>
      Object.freeze({
        ...r,
        fdrAdjustedPValue: fdr.adjustedPValues[i] ?? null,
        incrementallyInformative: (fdr.rejected[i] ?? false) || r.delta > 0,
      }),
    ),
  );
}

export function buildAlt13IncrementalInformationEvidence(input?: {
  readonly rows?: readonly import('./types.ts').Alt13EvaluationRow[];
}): Alt13IncrementalInformationEvidence {
  const rows = input?.rows ?? seedAlt13ReferencePanel();
  const blockers: string[] = [];

  if (rows.length < ALT13_MIN_OOS_ROWS) {
    blockers.push(`oos_rows_below_${String(ALT13_MIN_OOS_ROWS)}`);
  }

  const registry = createAltFeatureHypothesisTrialRegistry();
  const hypotheses = ALT13_PRIMARY_FORECAST_TARGETS.map((target) =>
    registerAlternativeSignalHypothesis({
      featureId: 'alt_unique_supply',
      providerIds: Object.freeze(['provider-a', 'provider-b']),
      target,
      registeredAt: ALT13_REFERENCE_REGISTERED_AT,
      economicJustification: `Incremental alt-data lift test for ${target}`,
    }),
  );

  const incrementalStates = hypotheses.map((hypothesis) => {
    const state = evaluateIncrementalInformationState({ hypothesis, rows });
    const metrics = attachFdrToMetrics(state.metrics);
    registry.recordTrial({
      hypothesisId: hypothesis.hypothesisId,
      featureId: hypothesis.featureId,
      recordedAt: hypothesis.registeredAt,
      target: hypothesis.target,
      rawPValues: metrics.map((m) => m.rawPValue ?? 1),
      outcome: 'COMPLETED',
    });
    return Object.freeze({ ...state, metrics });
  });

  const demandSeries = Object.freeze({
    alt_job_growth: rows.map((r) => r.altFeatures.alt_job_growth ?? 0),
    alt_search_growth: rows.map((r) => r.altFeatures.alt_search_growth ?? 0),
    alt_web_traffic: rows.map((r) => r.altFeatures.alt_web_traffic ?? 0),
    alt_product_demand: rows.map((r) => r.altFeatures.alt_product_demand ?? 0),
  });
  const redundancyState = detectDemandRedundancy(demandSeries);

  const decayStates = Object.freeze([
    buildSignalDecayState({ featureId: 'alt_unique_supply', rows, targetKey: 'REVENUE_FORECAST' }),
    buildSignalDecayState({ featureId: 'alt_job_growth', rows, targetKey: 'REVENUE_FORECAST' }),
  ]);

  const stabilityStates = Object.freeze([
    buildSignalStabilityState({ featureId: 'alt_unique_supply', rows }),
    buildSignalStabilityState({ featureId: 'alt_job_growth', rows }),
  ]);

  const providerDependence = Object.freeze([
    evaluateProviderDependence({
      featureId: 'alt_unique_supply',
      providerIds: Object.freeze(['provider-a', 'provider-b']),
      rows,
      providerFeatureMap: Object.freeze({
        'provider-a': 'alt_unique_supply',
        'provider-b': 'alt_search_growth',
      }),
    }),
  ]);

  const multipleTesting = registry.buildMultipleTestingSummary();

  if (registry.listTrials().length < hypotheses.length) {
    blockers.push('not_every_hypothesis_trial_recorded');
  }
  if (!multipleTesting.evol09Schema) {
    blockers.push('evol09_fdr_missing');
  }

  const qualified = blockers.length === 0;

  return Object.freeze({
    schema: HELIOS_ALT13_SCHEMA,
    qualificationMarker: qualified
      ? HELIOS_ALT13_INCREMENTAL_INFORMATION_QUALIFIED
      : HELIOS_ALT13_INCREMENTAL_INFORMATION_BLOCKED,
    hypotheses,
    incrementalStates,
    decayStates,
    redundancyState,
    stabilityStates,
    providerDependence,
    multipleTesting,
    blockers: Object.freeze(blockers),
    grantsExecutionAuthority: false,
  });
}
