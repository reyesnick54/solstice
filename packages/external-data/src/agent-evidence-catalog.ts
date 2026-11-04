/**
 * Financial Agent evidence catalog — categorized canonical evidence with provenance.
 *
 * External observations never grant Execution Authority.
 */

import { toAgentEvidenceRef, type ExternalObservationEvidenceRef } from '@solstice/provider-sdk';
import type { ExternalDataObservation } from './models.ts';
import type { ExternalDataPlane } from './plane.ts';

function evidenceRefs(observations: readonly ExternalDataObservation<unknown>[]): readonly ExternalObservationEvidenceRef[] {
  return Object.freeze(observations.map((observation) => toAgentEvidenceRef(observation)));
}

export const AGENT_EVIDENCE_CATEGORIES = [
  'MACRO',
  'MARKET',
  'FX',
  'CRYPTO',
  'COMPANY',
  'COMPLIANCE',
  'RISK',
  'RESOURCE',
  'ENVIRONMENT',
  'OPPORTUNITY',
  'RESEARCH',
  'PATENT',
  'AI_ECONOMICS',
] as const;
export type AgentEvidenceCategory = (typeof AGENT_EVIDENCE_CATEGORIES)[number];

export type CategorizedAgentEvidence = {
  readonly category: AgentEvidenceCategory;
  readonly refs: readonly ExternalObservationEvidenceRef[];
};

export type AgentEvidenceCatalog = {
  readonly schema: 'sunrey.agent.evidence-catalog.v1';
  readonly generatedAt: string;
  readonly grantsExecutionAuthority: false;
  readonly treatedAsTradeInstruction: false;
  readonly categories: readonly CategorizedAgentEvidence[];
  readonly totalEvidenceCount: number;
};

function categorizeMacro(plane: ExternalDataPlane): CategorizedAgentEvidence {
  const observations = [
    ...plane.macro.getIndicators().observations,
    ...plane.macro.getTreasuryYields().observations,
    ...plane.macro.getFiscalBalances().observations,
  ];
  return Object.freeze({
    category: 'MACRO',
    refs: evidenceRefs(observations),
  });
}

function categorizeMarket(plane: ExternalDataPlane): CategorizedAgentEvidence {
  const observations = [
    ...plane.markets.getQuotes().observations,
    ...plane.markets.getCommodities().observations,
  ];
  return Object.freeze({
    category: 'MARKET',
    refs: evidenceRefs(observations),
  });
}

function categorizeFx(plane: ExternalDataPlane): CategorizedAgentEvidence {
  return Object.freeze({
    category: 'FX',
    refs: evidenceRefs(plane.fx.getRates().observations),
  });
}

function categorizeCompany(plane: ExternalDataPlane): CategorizedAgentEvidence {
  const observations = [
    ...plane.company.getLatestFilings().observations,
    ...plane.company.getRegulatoryPublications().observations,
  ];
  return Object.freeze({
    category: 'COMPANY',
    refs: evidenceRefs(observations),
  });
}

function categorizeCompliance(plane: ExternalDataPlane): CategorizedAgentEvidence {
  const screening = plane.compliance.screenWatchlists('catalog-sample');
  return Object.freeze({
    category: 'COMPLIANCE',
    refs: evidenceRefs(screening.observations),
  });
}

function emptyCategory(category: AgentEvidenceCategory): CategorizedAgentEvidence {
  return Object.freeze({ category, refs: Object.freeze([]) });
}

export async function buildAgentEvidenceCatalog(
  plane: ExternalDataPlane,
  options?: { readonly nowUtc?: string },
): Promise<AgentEvidenceCatalog> {
  const nowUtc = options?.nowUtc ?? plane.adapterContext().nowUtc;
  const syncCategories = [
    categorizeMacro(plane),
    categorizeMarket(plane),
    categorizeFx(plane),
    categorizeCompany(plane),
    categorizeCompliance(plane),
    emptyCategory('CRYPTO'),
    emptyCategory('RISK'),
    emptyCategory('ENVIRONMENT'),
    emptyCategory('OPPORTUNITY'),
    emptyCategory('RESEARCH'),
    emptyCategory('PATENT'),
    emptyCategory('AI_ECONOMICS'),
  ];

  let resourceCategory = emptyCategory('RESOURCE');
  try {
    const [energy, resources] = await Promise.all([
      plane.productiveEconomy.getEnergyObservations(),
      plane.productiveEconomy.getResourceObservations(),
    ]);
    const observations = [...energy, ...resources];
    resourceCategory = Object.freeze({
      category: 'RESOURCE',
      refs: evidenceRefs(observations),
    });
  } catch {
    resourceCategory = emptyCategory('RESOURCE');
  }

  const categories = Object.freeze([...syncCategories, resourceCategory]);
  const totalEvidenceCount = categories.reduce((sum, c) => sum + c.refs.length, 0);

  return Object.freeze({
    schema: 'sunrey.agent.evidence-catalog.v1',
    generatedAt: nowUtc,
    grantsExecutionAuthority: false,
    treatedAsTradeInstruction: false,
    categories,
    totalEvidenceCount,
  });
}
