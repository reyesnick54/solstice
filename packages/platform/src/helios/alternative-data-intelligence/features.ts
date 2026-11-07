import type { UtcInstant } from '@solstice/domain';
import { ALT01_FORMULA_VERSIONS } from './taxonomy.ts';
import type { AlternativeDataFeature, AlternativeDataObservation } from './types.ts';
import type { Alt01CanonicalFeatureId } from './taxonomy.ts';

function maxKnowableAmong(rows: readonly AlternativeDataObservation[]): UtcInstant {
  if (rows.length === 0) {
    throw new Error('observations required');
  }
  return rows.reduce((latest, row) => {
    return Date.parse(row.knowableAt) > Date.parse(latest) ? row.knowableAt : latest;
  }, rows[0]!.knowableAt);
}

function momentumBps(rows: readonly AlternativeDataObservation[]): bigint | null {
  if (rows.length < 2) return null;
  const sorted = [...rows].sort((a, b) => Date.parse(a.knowableAt) - Date.parse(b.knowableAt));
  const prior = sorted[sorted.length - 2]!;
  const latest = sorted[sorted.length - 1]!;
  if (prior.valueMinor === null || latest.valueMinor === null) return null;
  const delta = latest.valueMinor - prior.valueMinor;
  return delta * 100n;
}

export function computeAlternativeDataFeatures(
  observations: readonly AlternativeDataObservation[],
): readonly AlternativeDataFeature[] {
  const byFamily = new Map<string, AlternativeDataObservation[]>();
  for (const row of observations) {
    const list = byFamily.get(row.signalFamily) ?? [];
    list.push(row);
    byFamily.set(row.signalFamily, list);
  }

  const features: AlternativeDataFeature[] = [];
  const emit = (featureId: Alt01CanonicalFeatureId, signalFamily: AlternativeDataObservation['signalFamily'], formulaVersion: string) => {
    const rows = byFamily.get(signalFamily) ?? [];
    if (rows.length === 0) {
      features.push(
        Object.freeze({
          featureId,
          formulaVersion,
          signalFamily,
          valueMinor: null,
          valueText: 'NO_INPUT',
          knowableAt: rows[0]?.knowableAt ?? '1970-01-01T00:00:00.000Z',
          qualityState: 'UNAVAILABLE',
          observationRefs: Object.freeze([]),
          entityLink: Object.freeze({
            canonicalEntityId: null,
            canonicalInstrumentId: null,
            providerEntityRef: null,
            entityLinkConfidence: null,
            resolutionRef: null,
          }),
          grantsExecutionAuthority: false,
        }),
      );
      return;
    }
    const knowableAt = maxKnowableAmong(rows);
    const quality = rows.some((r) => r.qualityState !== 'VALID') ? 'DEGRADED_LOW_CONFIDENCE' : 'VALID';
    features.push(
      Object.freeze({
        featureId,
        formulaVersion,
        signalFamily,
        valueMinor: momentumBps(rows),
        valueText: rows.length === 1 ? 'SINGLE_POINT' : 'MOMENTUM_BPS',
        knowableAt,
        qualityState: quality,
        observationRefs: Object.freeze(rows.map((r) => r.observationId)),
        entityLink: rows[rows.length - 1]!.entityLink,
        grantsExecutionAuthority: false,
      }),
    );
  };

  emit('alt01.workforce_posting_momentum', 'WORKFORCE', ALT01_FORMULA_VERSIONS.workforcePostingMomentum);
  emit('alt01.digital_demand_index', 'DIGITAL_DEMAND', ALT01_FORMULA_VERSIONS.digitalDemandIndex);
  emit('alt01.logistics_throughput_proxy', 'LOGISTICS', ALT01_FORMULA_VERSIONS.logisticsThroughputProxy);
  emit('alt01.geospatial_activity_level', 'GEOSPATIAL', ALT01_FORMULA_VERSIONS.geospatialActivityLevel);
  emit('alt01.patent_filing_intensity', 'PATENTS', ALT01_FORMULA_VERSIONS.patentFilingIntensity);
  emit('alt01.supply_chain_stress_proxy', 'SUPPLY_CHAIN', ALT01_FORMULA_VERSIONS.supplyChainStressProxy);

  return Object.freeze(features);
}
