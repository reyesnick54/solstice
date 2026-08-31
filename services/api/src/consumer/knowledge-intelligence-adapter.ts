/**
 * Consumer BFF adapter for Wave 6 Knowledge Intelligence.
 */

import type { ExternalDataPlane } from '../../../../packages/external-data/src/plane.ts';
import { buildWave6ConsumerSnapshots, hinReferenceSnapshot, wave6ActionCenterSignals } from '../../../../packages/external-data/src/wave6/bridges.ts';
import { buildWave6CoverageReport } from '../../../../packages/external-data/src/wave6/coverage.ts';

export type KnowledgeIntelligenceBff = {
  readonly researchSearch: (query: { readonly q?: string; readonly topic?: string }) => ReturnType<ExternalDataPlane['wave6']['research']['searchWorks']>;
  readonly patentSearch: (query: { readonly q?: string; readonly jurisdiction?: string }) => ReturnType<ExternalDataPlane['wave6']['patents']['searchPatents']>;
  readonly knowledgeSearch: (query: { readonly q?: string }) => ReturnType<ExternalDataPlane['wave6']['knowledge']['searchEntities']>;
  readonly aiModels: () => ReturnType<ExternalDataPlane['wave6']['aiEconomics']['getModelObservations']>;
  readonly aiEconomics: () => ReturnType<ExternalDataPlane['wave6']['aiEconomics']['getEconomicObservations']>;
  readonly hinReference: () => ReturnType<typeof hinReferenceSnapshot>;
  readonly opportunities: (query?: { readonly kind?: 'JOB' | 'SKILL' | 'LEARNING' | 'RESEARCH_OPPORTUNITY'; readonly skill?: string }) => ReturnType<ExternalDataPlane['wave6']['opportunities']['searchOpportunities']>;
  readonly agentEvidence: () => ReturnType<typeof buildWave6ConsumerSnapshots>['agent'];
  readonly growContext: () => ReturnType<typeof buildWave6ConsumerSnapshots>['grow'];
  readonly worldContext: () => ReturnType<typeof buildWave6ConsumerSnapshots>['world'];
  readonly moonreyContext: () => ReturnType<typeof buildWave6ConsumerSnapshots>['moonrey'];
  readonly modelGatewayReference: () => ReturnType<typeof buildWave6ConsumerSnapshots>['modelGateway'];
  readonly coverage: () => ReturnType<typeof buildWave6CoverageReport>;
  readonly providerHealth: () => ReturnType<ExternalDataPlane['wave6Health']>;
  readonly actionCenterSignals: () => ReturnType<typeof wave6ActionCenterSignals>;
  readonly knowledgeBundle: () => ReturnType<ExternalDataPlane['wave6KnowledgeBundle']>;
};

export function createKnowledgeIntelligenceBff(plane: ExternalDataPlane): KnowledgeIntelligenceBff {
  const snapshots = () => buildWave6ConsumerSnapshots(plane.wave6);
  return Object.freeze({
    researchSearch: (query) => plane.wave6.research.searchWorks(query),
    patentSearch: (query) => plane.wave6.patents.searchPatents(query),
    knowledgeSearch: (query) => plane.wave6.knowledge.searchEntities(query),
    aiModels: () => plane.wave6.aiEconomics.getModelObservations(),
    aiEconomics: () => plane.wave6.aiEconomics.getEconomicObservations(),
    hinReference: () => hinReferenceSnapshot(plane.wave6),
    opportunities: (query) => plane.wave6.opportunities.searchOpportunities(query ?? {}),
    agentEvidence: () => snapshots().agent,
    growContext: () => snapshots().grow,
    worldContext: () => snapshots().world,
    moonreyContext: () => snapshots().moonrey,
    modelGatewayReference: () => snapshots().modelGateway,
    coverage: () => buildWave6CoverageReport(),
    providerHealth: () => plane.wave6Health(),
    actionCenterSignals: () => wave6ActionCenterSignals(plane),
    knowledgeBundle: () => plane.wave6KnowledgeBundle(),
  });
}
