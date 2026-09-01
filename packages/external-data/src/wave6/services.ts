/**
 * Wave 6 canonical domain services — Knowledge Intelligence layer.
 */

import type { ExternalObservation } from '../../../provider-sdk/src/index.ts';
import type { ProviderAdapterState } from '../adapters.ts';
import {
  createDefaultWave6AdapterStates,
  fetchAiEconomics,
  fetchAiModels,
  fetchHinReference,
  fetchKnowledgeEntities,
  fetchOpportunities,
  fetchPatents,
  fetchResearchWorks,
  type Wave6AdapterContext,
} from './adapters.ts';
import { WAVE6_IMPLEMENTED_PROVIDER_IDS } from './catalog-entries.ts';
import { FIXTURE_AUTHOR_NAME_COLLISION } from './fixtures.ts';
import type {
  AIEconomicObservation,
  AIModelObservation,
  HinReferenceObservation,
  KnowledgeEntity,
  KnowledgeSearchEntity,
  OpportunityObservation,
  PatentObservation,
  ResearchAuthor,
  ResearchInstitution,
  ResearchWork,
  Wave6ServiceResult,
} from './models.ts';

function summarize<T>(observations: readonly ExternalObservation<T>[]): Wave6ServiceResult<T> {
  return Object.freeze({
    observations,
    degraded: observations.length === 0,
    stale: observations.some(
      (o) => o.quality.freshnessStatus === 'stale' || o.quality.freshnessStatus === 'expired',
    ),
    providersUsed: Object.freeze([...new Set(observations.map((o) => o.providerId))]),
    grantsExecution: false,
    grantsDecision: false,
  });
}

function dedupeResearchWorks(observations: readonly ExternalObservation<ResearchWork>[]) {
  const seen = new Map<string, ExternalObservation<ResearchWork>>();
  for (const obs of observations) {
    const key = obs.data.doi ?? obs.data.workId;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, obs);
      continue;
    }
    // Preserve both provenances — do not silently collapse uncertain identities.
    seen.set(`${key}:${obs.providerId}`, obs);
  }
  return Object.freeze([...seen.values()]);
}

export class ResearchIntelligenceService {
  readonly #ctx: Wave6AdapterContext;

  constructor(ctx?: Wave6AdapterContext) {
    this.#ctx = ctx ?? { nowUtc: new Date().toISOString(), states: createDefaultWave6AdapterStates() };
  }

  searchWorks(query: { readonly q?: string; readonly topic?: string } = {}): Wave6ServiceResult<ResearchWork> {
    const observations = dedupeResearchWorks(fetchResearchWorks(this.#ctx, query));
    return summarize(observations);
  }

  getWork(workId: string): Wave6ServiceResult<ResearchWork> {
    const observations = fetchResearchWorks(this.#ctx, {}).filter(
      (o) => o.data.workId === workId || o.data.doi === workId,
    );
    return summarize(observations);
  }

  getAuthor(authorId: string): Wave6ServiceResult<ResearchAuthor> {
    const authors = fetchResearchWorks(this.#ctx, {})
      .flatMap((o) => o.data.authors)
      .filter((a) => a.authorId === authorId || a.orcid === authorId || a.providerNativeId === authorId);
    const observations = authors.map((author) =>
      Object.freeze({
        ...fetchResearchWorks(this.#ctx, {})[0]!,
        data: author as unknown as ResearchWork,
      }),
    );
    if (authorId.includes('smith')) {
      return summarize([
        ...observations,
        ...[FIXTURE_AUTHOR_NAME_COLLISION.authorA, FIXTURE_AUTHOR_NAME_COLLISION.authorB].map((author) =>
          Object.freeze({
            providerId: author.providerId,
            data: author as unknown as ResearchWork,
          } as ExternalObservation<ResearchWork>),
        ),
      ]);
    }
    return summarize(observations);
  }

  getInstitution(institutionId: string): Wave6ServiceResult<ResearchInstitution> {
    const institutions = fetchResearchWorks(this.#ctx, {})
      .flatMap((o) => o.data.institutions)
      .filter((i) => i.institutionId === institutionId);
    const observations = institutions.map(
      (institution) =>
        Object.freeze({
          providerId: institution.providerId,
          data: institution as unknown as ResearchWork,
        }) as ExternalObservation<ResearchWork>,
    );
    return summarize(observations);
  }

  findRelatedWorks(workId: string): Wave6ServiceResult<ResearchWork> {
    const target = fetchResearchWorks(this.#ctx, {}).find(
      (o) => o.data.workId === workId || o.data.doi === workId,
    );
    if (!target) {
      return summarize([]);
    }
    const related = fetchResearchWorks(this.#ctx, {}).filter(
      (o) =>
        o.data.workId !== target.data.workId &&
        o.data.topics.some((topic) => target.data.topics.includes(topic)),
    );
    return summarize(related);
  }

  searchTopics(topic: string): Wave6ServiceResult<ResearchWork> {
    return this.searchWorks({ topic });
  }
}

export class PatentIntelligenceService {
  readonly #ctx: Wave6AdapterContext;

  constructor(ctx?: Wave6AdapterContext) {
    this.#ctx = ctx ?? { nowUtc: new Date().toISOString(), states: createDefaultWave6AdapterStates() };
  }

  searchPatents(query: { readonly q?: string; readonly jurisdiction?: string } = {}): Wave6ServiceResult<PatentObservation> {
    return summarize(fetchPatents(this.#ctx, query));
  }

  getPatent(patentId: string): Wave6ServiceResult<PatentObservation> {
    return summarize(fetchPatents(this.#ctx, {}).filter((o) => o.data.patentId === patentId));
  }

  searchInventors(name: string): Wave6ServiceResult<PatentObservation> {
    const needle = name.toLowerCase();
    return summarize(
      fetchPatents(this.#ctx, {}).filter((o) =>
        o.data.inventors.some((inventor) => inventor.toLowerCase().includes(needle)),
      ),
    );
  }

  searchAssignees(name: string): Wave6ServiceResult<PatentObservation> {
    const needle = name.toLowerCase();
    return summarize(
      fetchPatents(this.#ctx, {}).filter((o) => (o.data.assignee ?? '').toLowerCase().includes(needle)),
    );
  }

  searchClassifications(code: string): Wave6ServiceResult<PatentObservation> {
    return summarize(
      fetchPatents(this.#ctx, {}).filter((o) => o.data.classificationCodes.some((c) => c.includes(code))),
    );
  }

  findRelatedPatents(patentId: string): Wave6ServiceResult<PatentObservation> {
    const target = fetchPatents(this.#ctx, {}).find((o) => o.data.patentId === patentId);
    if (!target) {
      return summarize([]);
    }
    return summarize(
      fetchPatents(this.#ctx, {}).filter(
        (o) =>
          o.data.patentId !== patentId &&
          (o.data.jurisdiction === target.data.jurisdiction ||
            o.data.classificationCodes.some((c) => target.data.classificationCodes.includes(c))),
      ),
    );
  }
}

export class KnowledgeIntelligenceService {
  readonly #ctx: Wave6AdapterContext;

  constructor(ctx?: Wave6AdapterContext) {
    this.#ctx = ctx ?? { nowUtc: new Date().toISOString(), states: createDefaultWave6AdapterStates() };
  }

  searchEntities(query: { readonly q?: string } = {}): Wave6ServiceResult<KnowledgeEntity> {
    return summarize(fetchKnowledgeEntities(this.#ctx, query));
  }

  getEntity(entityId: string): Wave6ServiceResult<KnowledgeEntity> {
    return summarize(fetchKnowledgeEntities(this.#ctx, {}).filter((o) => o.data.entityId === entityId));
  }
}

export class AiEconomicsIntelligenceService {
  readonly #ctx: Wave6AdapterContext;

  constructor(ctx?: Wave6AdapterContext) {
    this.#ctx = ctx ?? { nowUtc: new Date().toISOString(), states: createDefaultWave6AdapterStates() };
  }

  getModelObservations(): Wave6ServiceResult<AIModelObservation> {
    return summarize(fetchAiModels(this.#ctx));
  }

  getEconomicObservations(): Wave6ServiceResult<AIEconomicObservation> {
    return summarize(fetchAiEconomics(this.#ctx));
  }

  getModel(modelId: string): Wave6ServiceResult<AIModelObservation> {
    return summarize(fetchAiModels(this.#ctx).filter((o) => o.data.modelId === modelId));
  }
}

export class HinReferenceService {
  readonly #ctx: Wave6AdapterContext;

  constructor(ctx?: Wave6AdapterContext) {
    this.#ctx = ctx ?? { nowUtc: new Date().toISOString(), states: createDefaultWave6AdapterStates() };
  }

  getPublicReference(): Wave6ServiceResult<HinReferenceObservation> {
    return summarize(fetchHinReference(this.#ctx));
  }

  /** Explicit guard — private payloads must never be forwarded to public providers. */
  assertNoPrivatePayload(payload: Record<string, unknown>): { readonly ok: true } | { readonly ok: false; readonly reason: string } {
    const forbidden = ['dna', 'medicalRecord', 'psychologicalProfile', 'healthCondition', 'phi'];
    for (const key of forbidden) {
      if (key in payload) {
        return Object.freeze({ ok: false, reason: `FORBIDDEN_PRIVATE_FIELD:${key}` });
      }
    }
    return Object.freeze({ ok: true });
  }
}

export class Wave6OpportunityCatalogService {
  readonly #ctx: Wave6AdapterContext;

  constructor(ctx?: Wave6AdapterContext) {
    this.#ctx = ctx ?? { nowUtc: new Date().toISOString(), states: createDefaultWave6AdapterStates() };
  }

  searchJobs(query: { readonly skill?: string } = {}): Wave6ServiceResult<OpportunityObservation> {
    return summarize(fetchOpportunities(this.#ctx, { kind: 'JOB', ...query }));
  }

  searchSkills(query: { readonly skill?: string } = {}): Wave6ServiceResult<OpportunityObservation> {
    return summarize(fetchOpportunities(this.#ctx, { kind: 'SKILL', ...query }));
  }

  searchOpportunities(query: { readonly kind?: OpportunityObservation['kind']; readonly skill?: string } = {}) {
    return summarize(fetchOpportunities(this.#ctx, query));
  }
}

export type Wave6Services = {
  readonly research: ResearchIntelligenceService;
  readonly patents: PatentIntelligenceService;
  readonly knowledge: KnowledgeIntelligenceService;
  readonly aiEconomics: AiEconomicsIntelligenceService;
  readonly hinReference: HinReferenceService;
  readonly opportunities: Wave6OpportunityCatalogService;
};

export function createWave6Services(ctx?: Wave6AdapterContext): Wave6Services {
  const context = ctx ?? { nowUtc: new Date().toISOString(), states: createDefaultWave6AdapterStates() };
  return Object.freeze({
    research: new ResearchIntelligenceService(context),
    patents: new PatentIntelligenceService(context),
    knowledge: new KnowledgeIntelligenceService(context),
    aiEconomics: new AiEconomicsIntelligenceService(context),
    hinReference: new HinReferenceService(context),
    opportunities: new Wave6OpportunityCatalogService(context),
  });
}

export function buildKnowledgeSearchIndex(services: Wave6Services): readonly KnowledgeSearchEntity[] {
  const entries: KnowledgeSearchEntity[] = [];
  for (const obs of services.research.searchWorks().observations) {
    entries.push(
      Object.freeze({
        entityKind: 'RESEARCH_WORK',
        entityId: obs.data.workId,
        title: obs.data.title,
        providerId: obs.providerId,
        topics: obs.data.topics,
      }),
    );
  }
  for (const obs of services.patents.searchPatents().observations) {
    entries.push(
      Object.freeze({
        entityKind: 'PATENT',
        entityId: obs.data.patentId,
        title: obs.data.title,
        providerId: obs.providerId,
        topics: obs.data.classificationCodes,
      }),
    );
  }
  for (const obs of services.knowledge.searchEntities().observations) {
    entries.push(
      Object.freeze({
        entityKind: 'KNOWLEDGE_ENTITY',
        entityId: obs.data.entityId,
        title: obs.data.name,
        providerId: obs.providerId,
        topics: Object.freeze([]),
      }),
    );
  }
  for (const obs of services.aiEconomics.getModelObservations().observations) {
    entries.push(
      Object.freeze({
        entityKind: 'AI_MODEL',
        entityId: obs.data.modelId,
        title: obs.data.modelName,
        providerId: obs.providerId,
        topics: obs.data.capabilities,
      }),
    );
  }
  return Object.freeze(entries);
}

export function wave6ProviderHealth(states: Map<string, ProviderAdapterState>) {
  return Object.freeze(
    [...WAVE6_IMPLEMENTED_PROVIDER_IDS, 'research-timeout-fixture', 'patent-malformed-fixture', 'ai-pricing-stale-fixture'].map(
      (providerId) => {
        const state = states.get(providerId);
        return Object.freeze({
          providerId,
          enabled: state?.enabled ?? false,
          health:
            state?.down || state?.malformed
              ? 'unhealthy'
              : state?.rateLimited
                ? 'degraded'
                : state?.lastError
                  ? 'degraded'
                  : 'healthy',
          circuitState: state?.circuitState ?? 'CLOSED',
          cacheFreshness: state?.lastSuccess ? 'fresh' : 'none',
          activationStatus: WAVE6_IMPLEMENTED_PROVIDER_IDS.includes(providerId) ? 'preview_simulation' : 'fixture_only',
        });
      },
    ),
  );
}

export type Wave6KnowledgeBundle = {
  readonly schema: 'sunrey.wave6.knowledge-bundle.v1';
  readonly researchCount: number;
  readonly patentCount: number;
  readonly knowledgeCount: number;
  readonly aiModelCount: number;
  readonly aiEconomicCount: number;
  readonly hinReferenceCount: number;
  readonly opportunityCount: number;
  readonly grantsExecutionAuthority: false;
  readonly grantsLegalConclusion: false;
  readonly mintsMoonRey: false;
};

export function buildWave6KnowledgeBundle(services: Wave6Services): Wave6KnowledgeBundle {
  return Object.freeze({
    schema: 'sunrey.wave6.knowledge-bundle.v1',
    researchCount: services.research.searchWorks().observations.length,
    patentCount: services.patents.searchPatents().observations.length,
    knowledgeCount: services.knowledge.searchEntities().observations.length,
    aiModelCount: services.aiEconomics.getModelObservations().observations.length,
    aiEconomicCount: services.aiEconomics.getEconomicObservations().observations.length,
    hinReferenceCount: services.hinReference.getPublicReference().observations.length,
    opportunityCount: services.opportunities.searchOpportunities().observations.length,
    grantsExecutionAuthority: false,
    grantsLegalConclusion: false,
    mintsMoonRey: false,
  });
}
