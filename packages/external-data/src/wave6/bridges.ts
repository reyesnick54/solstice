/**
 * Wave 6 consumer integration bridges — Grow, Financial Agent, World, MoonRey, Action Center.
 */

import type { ExternalDataPlane } from '../plane.ts';
import type { Wave6Services } from './services.ts';

export type WorldKnowledgeSnapshot = {
  readonly schema: 'sunrey.world.knowledge.v1';
  readonly researchActivityCount: number;
  readonly patentActivityCount: number;
  readonly innovationTopics: readonly string[];
  readonly aiEconomicsContext: readonly { readonly metricType: string; readonly value: number; readonly unit: string }[];
  readonly foodReferenceCount: number;
  readonly methodologyExplicit: true;
  readonly grantsMisleadingRanking: false;
};

export type GrowKnowledgeSnapshot = {
  readonly schema: 'sunrey.grow.knowledge.v1';
  readonly learningOpportunities: readonly { readonly title: string; readonly skills: readonly string[]; readonly source: string }[];
  readonly researchTrends: readonly { readonly topic: string; readonly workCount: number }[];
  readonly technologyTrends: readonly string[];
  readonly speculativeOverstatement: false;
  readonly sourcesRetained: true;
};

export type AgentKnowledgeEvidenceSnapshot = {
  readonly schema: 'sunrey.agent.knowledge-evidence.v1';
  readonly researchEvidenceCount: number;
  readonly patentEvidenceCount: number;
  readonly aiEconomicsEvidenceCount: number;
  readonly opportunityEvidenceCount: number;
  readonly grantsExecutionAuthority: false;
  readonly treatedAsTradeInstruction: false;
  readonly submitsJobApplication: false;
  readonly sharesPrivateProfile: false;
  readonly infersHealthCondition: false;
};

export type MoonReyAiComputeSnapshot = {
  readonly schema: 'sunrey.moonrey.ai-compute-context.v1';
  readonly aiUsageObservations: readonly { readonly metricType: string; readonly value: number; readonly unit: string }[];
  readonly computeCostObservations: readonly { readonly value: number; readonly unit: string; readonly currency: string | null }[];
  readonly modelAvailability: readonly { readonly modelId: string; readonly availability: string }[];
  readonly issuanceAuthority: false;
  readonly burnAuthority: false;
  readonly nativeAssetIdentityChanged: false;
  readonly blockchainConsensusChanged: false;
};

export type ModelGatewayKnowledgeSnapshot = {
  readonly schema: 'sunrey.model-gateway.reference.v1';
  readonly modelMetadataCount: number;
  readonly policyRemainsAuthoritative: true;
  readonly autoReconfigurationPermitted: false;
};

export type HinReferenceSnapshot = {
  readonly schema: 'sunrey.hin.reference.v1';
  readonly publicReferenceCount: number;
  readonly privateDataIncluded: false;
  readonly vaultPermissionsAuthoritative: true;
};

export function worldKnowledgeSnapshot(services: Wave6Services): WorldKnowledgeSnapshot {
  const research = services.research.searchWorks();
  const patents = services.patents.searchPatents();
  const ai = services.aiEconomics.getEconomicObservations();
  const hin = services.hinReference.getPublicReference();
  const topics = new Map<string, number>();
  for (const obs of research.observations) {
    for (const topic of obs.data.topics) {
      topics.set(topic, (topics.get(topic) ?? 0) + 1);
    }
  }
  return Object.freeze({
    schema: 'sunrey.world.knowledge.v1',
    researchActivityCount: research.observations.length,
    patentActivityCount: patents.observations.length,
    innovationTopics: Object.freeze(
      [...topics.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([topic, count]) => `${topic}:${count}`),
    ),
    aiEconomicsContext: Object.freeze(
      ai.observations.map((o) => ({
        metricType: o.data.metricType,
        value: o.data.value,
        unit: o.data.unit,
      })),
    ),
    foodReferenceCount: hin.observations.length,
    methodologyExplicit: true,
    grantsMisleadingRanking: false,
  });
}

export function growKnowledgeSnapshot(services: Wave6Services): GrowKnowledgeSnapshot {
  const opportunities = services.opportunities.searchOpportunities();
  const research = services.research.searchWorks();
  const topicCounts = new Map<string, number>();
  for (const obs of research.observations) {
    for (const topic of obs.data.topics) {
      topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
    }
  }
  return Object.freeze({
    schema: 'sunrey.grow.knowledge.v1',
    learningOpportunities: Object.freeze(
      opportunities.observations.map((o) => ({
        title: o.data.title,
        skills: o.data.skills,
        source: o.data.provenance,
      })),
    ),
    researchTrends: Object.freeze(
      [...topicCounts.entries()].map(([topic, workCount]) => Object.freeze({ topic, workCount })),
    ),
    technologyTrends: Object.freeze(['transformer-architecture', 'policy-gated-agents', 'open-government-data']),
    speculativeOverstatement: false,
    sourcesRetained: true,
  });
}

export function agentKnowledgeEvidenceSnapshot(services: Wave6Services): AgentKnowledgeEvidenceSnapshot {
  const research = services.research.searchWorks();
  const patents = services.patents.searchPatents();
  const ai = services.aiEconomics.getEconomicObservations();
  const opportunities = services.opportunities.searchOpportunities();
  return Object.freeze({
    schema: 'sunrey.agent.knowledge-evidence.v1',
    researchEvidenceCount: research.observations.length,
    patentEvidenceCount: patents.observations.length,
    aiEconomicsEvidenceCount: ai.observations.length,
    opportunityEvidenceCount: opportunities.observations.length,
    grantsExecutionAuthority: false,
    treatedAsTradeInstruction: false,
    submitsJobApplication: false,
    sharesPrivateProfile: false,
    infersHealthCondition: false,
  });
}

export function moonReyAiComputeSnapshot(services: Wave6Services): MoonReyAiComputeSnapshot {
  const aiEcon = services.aiEconomics.getEconomicObservations();
  const models = services.aiEconomics.getModelObservations();
  return Object.freeze({
    schema: 'sunrey.moonrey.ai-compute-context.v1',
    aiUsageObservations: Object.freeze(
      aiEcon.observations
        .filter((o) => o.data.metricType === 'TOKEN_COST' || o.data.metricType === 'AGENT_ECONOMICS')
        .map((o) => ({ metricType: o.data.metricType, value: o.data.value, unit: o.data.unit })),
    ),
    computeCostObservations: Object.freeze(
      aiEcon.observations
        .filter((o) => o.data.metricType === 'COMPUTE_COST' || o.data.metricType === 'ENERGY_USE')
        .map((o) => ({ value: o.data.value, unit: o.data.unit, currency: o.data.currency })),
    ),
    modelAvailability: Object.freeze(
      models.observations.map((o) => ({ modelId: o.data.modelId, availability: o.data.availability })),
    ),
    issuanceAuthority: false,
    burnAuthority: false,
    nativeAssetIdentityChanged: false,
    blockchainConsensusChanged: false,
  });
}

export function modelGatewayKnowledgeSnapshot(services: Wave6Services): ModelGatewayKnowledgeSnapshot {
  const models = services.aiEconomics.getModelObservations();
  return Object.freeze({
    schema: 'sunrey.model-gateway.reference.v1',
    modelMetadataCount: models.observations.length,
    policyRemainsAuthoritative: true,
    autoReconfigurationPermitted: false,
  });
}

export function hinReferenceSnapshot(services: Wave6Services): HinReferenceSnapshot {
  const hin = services.hinReference.getPublicReference();
  return Object.freeze({
    schema: 'sunrey.hin.reference.v1',
    publicReferenceCount: hin.observations.length,
    privateDataIncluded: false,
    vaultPermissionsAuthoritative: true,
  });
}

export type Wave6ConsumerSnapshots = {
  readonly world: WorldKnowledgeSnapshot;
  readonly grow: GrowKnowledgeSnapshot;
  readonly agent: AgentKnowledgeEvidenceSnapshot;
  readonly moonrey: MoonReyAiComputeSnapshot;
  readonly modelGateway: ModelGatewayKnowledgeSnapshot;
  readonly hinReference: HinReferenceSnapshot;
};

export function buildWave6ConsumerSnapshots(services: Wave6Services): Wave6ConsumerSnapshots {
  return Object.freeze({
    world: worldKnowledgeSnapshot(services),
    grow: growKnowledgeSnapshot(services),
    agent: agentKnowledgeEvidenceSnapshot(services),
    moonrey: moonReyAiComputeSnapshot(services),
    modelGateway: modelGatewayKnowledgeSnapshot(services),
    hinReference: hinReferenceSnapshot(services),
  });
}

export async function wave6ActionCenterSignals(plane: ExternalDataPlane) {
  const bundle = plane.wave6KnowledgeBundle();
  return Object.freeze([
    Object.freeze({
      kind: 'sunrey.action-center.knowledge-research.v1',
      title: 'Research evidence refreshed',
      detail: `${bundle.researchCount} research works indexed (simulation).`,
      autoNotify: false,
      grantsExecution: false,
    }),
    Object.freeze({
      kind: 'sunrey.action-center.patent-landscape.v1',
      title: 'Patent landscape updated',
      detail: `${bundle.patentCount} patent observations available for review (not legal conclusions).`,
      autoNotify: false,
      grantsExecution: false,
    }),
  ]);
}
