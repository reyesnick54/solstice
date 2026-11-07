import { createHash } from 'node:crypto';

import type { UtcInstant } from '../imports.ts';
import type { HeliosResearchDataSnapshot } from '../institutional-research-mesh/data-context.ts';
import {
  SKEPTIC_ALT14_CHECKLIST,
  type AlternativeDataAlt14Artifact,
  type AlternativeDataAlt14Role,
  type Alt14SpecialistExtraction,
} from './types.ts';

type RoleRunnerInput = {
  readonly role: AlternativeDataAlt14Role;
  readonly workOrderId: string;
  readonly subjectId: string;
  readonly entityId: string;
  readonly objective: string;
  readonly informationTime: UtcInstant;
  readonly data: HeliosResearchDataSnapshot;
  readonly priorArtifacts: readonly AlternativeDataAlt14Artifact[];
};

function artifactId(role: AlternativeDataAlt14Role, workOrderId: string): string {
  return `alt14_${role.toLowerCase()}_${createHash('sha256').update(`${workOrderId}:${role}`).digest('hex').slice(0, 14)}`;
}

function extractionFor(role: AlternativeDataAlt14Role): Alt14SpecialistExtraction {
  const table: Record<AlternativeDataAlt14Role, Alt14SpecialistExtraction> = {
    WORKFORCE_INTELLIGENCE: Object.freeze({
      familyId: 'workforce',
      modality: 'job_postings',
      stateLabel: 'EXPANDING',
      uncertaintyBps: 2200,
      coverageFractionBps: 7600,
      notes: Object.freeze(['Fixture workforce posting velocity; research evidence only.']),
    }),
    DIGITAL_DEMAND: Object.freeze({
      familyId: 'digital_demand',
      modality: 'search_interest',
      stateLabel: 'ACCELERATING',
      uncertaintyBps: 1900,
      coverageFractionBps: 8000,
      notes: Object.freeze(['Search-interest vintage preserved at decision time.']),
    }),
    PRODUCT_DEMAND: Object.freeze({
      familyId: 'product_demand',
      modality: 'pricing_scrape',
      stateLabel: 'PRICING_POWER_STABLE',
      uncertaintyBps: 2500,
      coverageFractionBps: 6700,
      notes: Object.freeze(['Pricing scrape does not assert realized revenue.']),
    }),
    LOGISTICS: Object.freeze({
      familyId: 'logistics',
      modality: 'port_ais',
      stateLabel: 'CONGESTION_ELEVATED',
      uncertaintyBps: 3200,
      coverageFractionBps: 6900,
      notes: Object.freeze(['AIS movement without cargo remains non-authoritative for load.']),
    }),
    GEOSPATIAL: Object.freeze({
      familyId: 'geospatial',
      modality: 'satellite_activity',
      stateLabel: 'ACTIVITY_UP',
      uncertaintyBps: 3600,
      coverageFractionBps: 6100,
      notes: Object.freeze(['Cloud cover increases geospatial uncertainty in fixture path.']),
    }),
    INNOVATION: Object.freeze({
      familyId: 'innovation',
      modality: 'patent_velocity',
      stateLabel: 'MOMENTUM_MODERATE',
      uncertaintyBps: 4100,
      coverageFractionBps: 5500,
      notes: Object.freeze(['Patent counts require commercialization corroboration before demand mapping.']),
    }),
    PROCUREMENT: Object.freeze({
      familyId: 'procurement',
      modality: 'gov_contracts',
      stateLabel: 'DEMAND_STEADY',
      uncertaintyBps: 2700,
      coverageFractionBps: 7200,
      notes: Object.freeze(['Obligation interpreted separately from contract ceiling.']),
    }),
    SUPPLY_CHAIN: Object.freeze({
      familyId: 'supply_chain',
      modality: 'tier_graph',
      stateLabel: 'RISK_ELEVATED',
      uncertaintyBps: 3800,
      coverageFractionBps: 6600,
      notes: Object.freeze(['Weak edges attenuate graph propagation confidence.']),
    }),
    ALTERNATIVE_DATA_SKEPTIC: Object.freeze({
      familyId: 'skeptic',
      modality: 'review',
      stateLabel: 'REVIEW_COMPLETE',
      uncertaintyBps: 0,
      coverageFractionBps: 10_000,
      notes: Object.freeze(['Skeptic completed mandatory bias and mapping checks.']),
    }),
    ALTERNATIVE_DATA_SYNTHESIS: Object.freeze({
      familyId: 'synthesis',
      modality: 'fusion',
      stateLabel: 'FUSED',
      uncertaintyBps: 2800,
      coverageFractionBps: 7500,
      notes: Object.freeze(['Synthesis emits AAF-certified feature candidates only.']),
    }),
  };
  return table[role];
}

export function runAlternativeDataAlt14Role(input: RoleRunnerInput): AlternativeDataAlt14Artifact {
  const evidence = Object.freeze([...input.data.evidenceBundle]);
  const base = {
    artifactId: artifactId(input.role, input.workOrderId),
    role: input.role,
    workOrderId: input.workOrderId,
    subjectId: input.subjectId,
    informationTime: input.informationTime,
    evidence,
    simulationOnly: true as const,
  };
  const extraction =
    input.role === 'ALTERNATIVE_DATA_SKEPTIC' || input.role === 'ALTERNATIVE_DATA_SYNTHESIS'
      ? null
      : extractionFor(input.role);
  const thesisByRole: Record<AlternativeDataAlt14Role, string> = {
    WORKFORCE_INTELLIGENCE: `WorkforceIntelligenceAgent assessed hiring velocity for ${input.entityId} using fixture job feeds; evidence is research-only.`,
    DIGITAL_DEMAND: `DigitalDemandAgent measured search-interest acceleration for ${input.objective}; no live provider call.`,
    PRODUCT_DEMAND: `ProductDemandAgent summarized pricing-power proxies without claiming realized revenue.`,
    LOGISTICS: `LogisticsAgent flagged port congestion exposure from AIS fixture data.`,
    GEOSPATIAL: `GeospatialAgent reported physical-activity change with elevated uncertainty where coverage is partial.`,
    INNOVATION: `InnovationAgent tracked patent momentum without auto-mapping to product demand.`,
    PROCUREMENT: `ProcurementAgent interpreted government contract obligations separately from ceiling amounts.`,
    SUPPLY_CHAIN: `SupplyChainAgent propagated supply risk with attenuation on weak inferred edges.`,
    ALTERNATIVE_DATA_SKEPTIC: `AlternativeDataSkepticAgent audited entity mapping, coverage, licensing, and proxy stability before certification.`,
    ALTERNATIVE_DATA_SYNTHESIS: `AlternativeDataSynthesisAgent fused specialist modalities into research state; raw provider rows are not genome inputs.`,
  };
  if (input.role === 'ALTERNATIVE_DATA_SKEPTIC') {
    return Object.freeze({
      ...base,
      thesis: thesisByRole[input.role],
      extraction,
      skepticChecklist: Object.freeze([...SKEPTIC_ALT14_CHECKLIST]),
    });
  }
  if (input.role === 'ALTERNATIVE_DATA_SYNTHESIS') {
    const families = input.priorArtifacts
      .map((row) => row.extraction?.familyId)
      .filter((id): id is string => Boolean(id));
    return Object.freeze({
      ...base,
      thesis: `${thesisByRole[input.role]} Families: ${families.join(', ') || 'none'}.`,
      extraction,
    });
  }
  return Object.freeze({
    ...base,
    thesis: thesisByRole[input.role],
    extraction,
  });
}
