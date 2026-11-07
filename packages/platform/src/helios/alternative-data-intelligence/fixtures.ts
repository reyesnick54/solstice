import { asUtcInstant, type UtcInstant } from '@solstice/domain';

import { runAlternativeDataSkepticChecks } from './alt08-skeptic.ts';
import { buildAlternativeDataResearchState } from './alt09-synthesis.ts';
import type { AlternativeDataResearchState } from './types.ts';
import { SKEPTIC_ALT_ATTACK_VECTORS } from './taxonomy.ts';

const DECISION: UtcInstant = asUtcInstant('2026-06-01T00:00:00.000Z');

export function demoAlternativeDataResearchState(entityId = 'ent_demo_alt14'): AlternativeDataResearchState {
  const skepticInputs = SKEPTIC_ALT_ATTACK_VECTORS.map((vector) =>
    Object.freeze({
      vector,
      passed: true,
      detail: `${vector} check passed in fixture universe`,
    }),
  );
  const skepticFindings = runAlternativeDataSkepticChecks(skepticInputs);
  return buildAlternativeDataResearchState({
    entityId,
    decisionTime: DECISION,
    entityResolutionQuality: 0.96,
    signalFamilies: Object.freeze([
      Object.freeze({
        familyId: 'workforce',
        modality: 'job_postings',
        stateLabel: 'EXPANDING',
        uncertaintyBps: 2200,
        coverageFractionBps: 7800,
        knowableAt: DECISION,
        blocked: false,
        blockReason: null,
      }),
      Object.freeze({
        familyId: 'digital_demand',
        modality: 'search_interest',
        stateLabel: 'ACCELERATING',
        uncertaintyBps: 1800,
        coverageFractionBps: 8200,
        knowableAt: DECISION,
        blocked: false,
        blockReason: null,
      }),
      Object.freeze({
        familyId: 'product_demand',
        modality: 'pricing_scrape',
        stateLabel: 'PRICING_POWER_STABLE',
        uncertaintyBps: 2400,
        coverageFractionBps: 6500,
        knowableAt: DECISION,
        blocked: false,
        blockReason: null,
      }),
      Object.freeze({
        familyId: 'logistics',
        modality: 'port_ais',
        stateLabel: 'CONGESTION_ELEVATED',
        uncertaintyBps: 3100,
        coverageFractionBps: 7000,
        knowableAt: DECISION,
        blocked: false,
        blockReason: null,
      }),
      Object.freeze({
        familyId: 'geospatial',
        modality: 'satellite_activity',
        stateLabel: 'ACTIVITY_UP',
        uncertaintyBps: 3500,
        coverageFractionBps: 6200,
        knowableAt: DECISION,
        blocked: false,
        blockReason: null,
      }),
      Object.freeze({
        familyId: 'innovation',
        modality: 'patent_velocity',
        stateLabel: 'MOMENTUM_MODERATE',
        uncertaintyBps: 4200,
        coverageFractionBps: 5400,
        knowableAt: DECISION,
        blocked: false,
        blockReason: null,
      }),
      Object.freeze({
        familyId: 'procurement',
        modality: 'gov_contracts',
        stateLabel: 'DEMAND_STEADY',
        uncertaintyBps: 2800,
        coverageFractionBps: 7100,
        knowableAt: DECISION,
        blocked: false,
        blockReason: null,
      }),
      Object.freeze({
        familyId: 'supply_chain',
        modality: 'tier_graph',
        stateLabel: 'RISK_ELEVATED',
        uncertaintyBps: 3900,
        coverageFractionBps: 6800,
        knowableAt: DECISION,
        blocked: false,
        blockReason: null,
      }),
    ]),
    sources: Object.freeze([
      Object.freeze({
        providerId: 'prov_jobs_fixture',
        modality: 'job_postings',
        weightBps: 2500,
        reliabilityBps: 8200,
        licensed: true,
      }),
      Object.freeze({
        providerId: 'prov_search_fixture',
        modality: 'search_interest',
        weightBps: 2000,
        reliabilityBps: 7900,
        licensed: true,
      }),
    ]),
    contradictions: Object.freeze([]),
    skepticFindings,
    incremental: Object.freeze({
      inSampleLiftBps: 95,
      holdoutLiftBps: 42,
      incrementalOnHoldout: true,
      rejectedForOverfit: false,
    }),
    evidenceRefs: Object.freeze(['ev/alt14/demo_state']),
  });
}
