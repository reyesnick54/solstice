/**
 * Financial Agent evidence catalog — categorized canonical evidence with provenance.
 *
 * External observations never grant Execution Authority.
 */

import { toAgentEvidenceRef, type ExternalObservationEvidenceRef } from '../../provider-sdk/src/agent-evidence.ts';
import type { ExternalDataPlane } from './plane.ts';

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
    refs: Object.freeze(observations.map((o) => toAgentEvidenceRef(o as Parameters<typeof toAgentEvidenceRef>[0]))),
  });
}

function categorizeMarket(plane: ExternalDataPlane): CategorizedAgentEvidence {
  const observations = [
    ...plane.markets.getQuotes().observations,
    ...plane.markets.getCommodities().observations,
  ];
  return Object.freeze({
    category: 'MARKET',
    refs: Object.freeze(observations.map((o) => toAgentEvidenceRef(o as Parameters<typeof toAgentEvidenceRef>[0]))),
  });
}

function categorizeFx(plane: ExternalDataPlane): CategorizedAgentEvidence {
  return Object.freeze({
    category: 'FX',
    refs: Object.freeze(plane.fx.getRates().observations.map((o) => toAgentEvidenceRef(o as Parameters<typeof toAgentEvidenceRef>[0]))),
  });
}

function categorizeCompany(plane: ExternalDataPlane): CategorizedAgentEvidence {
  const observations = [
    ...plane.company.getLatestFilings().observations,
    ...plane.company.getRegulatoryPublications().observations,
  ];
  return Object.freeze({
    category: 'COMPANY',
    refs: Object.freeze(observations.map((o) => toAgentEvidenceRef(o as Parameters<typeof toAgentEvidenceRef>[0]))),
  });
}

function categorizeCompliance(plane: ExternalDataPlane): CategorizedAgentEvidence {
  const screening = plane.compliance.screenWatchlists('catalog-sample');
  return Object.freeze({
    category: 'COMPLIANCE',
    refs: Object.freeze(screening.observations.map((o) => toAgentEvidenceRef(o))),
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
      refs: Object.freeze(observations.map((o) => toAgentEvidenceRef(o as Parameters<typeof toAgentEvidenceRef>[0]))),
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
