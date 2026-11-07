import type { UtcInstant } from '@solstice/domain';

import { AAF_CERTIFIED_ALT_FEATURE_IDS, type AafCertifiedAltFeatureId } from './taxonomy.ts';
import type { AlternativeDataResearchState, AltStrategyGenomeFeatureRow } from './types.ts';

const FAMILY_TO_FEATURE: Record<string, AafCertifiedAltFeatureId> = Object.freeze({
  workforce: 'workforce_expansion_state',
  digital_demand: 'digital_demand_acceleration',
  product_demand: 'pricing_power_state',
  logistics: 'port_congestion_exposure',
  geospatial: 'physical_activity_change',
  innovation: 'innovation_momentum',
  procurement: 'procurement_demand_state',
  supply_chain: 'supply_chain_risk_state',
});

export function compileAltStrategyGenomeFeatures(
  state: AlternativeDataResearchState,
): readonly AltStrategyGenomeFeatureRow[] {
  if (state.AAFQualification === 'BLOCKED') {
    return Object.freeze([]);
  }
  const certifiedOnly = state.AAFQualification === 'CERTIFIED' || state.AAFQualification === 'DEGRADED';
  if (!certifiedOnly) {
    return Object.freeze([]);
  }

  const rows: AltStrategyGenomeFeatureRow[] = [];
  for (const family of state.signalFamilyStates) {
    if (family.blocked) continue;
    const featureId = FAMILY_TO_FEATURE[family.familyId];
    if (!featureId || !AAF_CERTIFIED_ALT_FEATURE_IDS.includes(featureId)) continue;
    rows.push(
      Object.freeze({
        featureId,
        stateLabel: family.stateLabel,
        uncertaintyBps: family.uncertaintyBps,
        knowableAt: family.knowableAt,
        aafCertified: true,
        rawProviderRecordExposed: false as const,
      }),
    );
  }
  return Object.freeze(rows);
}

export function assertNoRawProviderRecordsInGenome(
  rows: readonly AltStrategyGenomeFeatureRow[],
): boolean {
  return rows.every((row) => row.rawProviderRecordExposed === false && row.aafCertified === true);
}

export function altFeatureKnowableAt(featureId: AafCertifiedAltFeatureId, at: UtcInstant): UtcInstant {
  return at;
}
