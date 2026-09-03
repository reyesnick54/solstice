// @ts-nocheck
/**
 * Wave 6 provider adapters — fixture-backed simulation only.
 */

import {
  buildExternalObservation,
  canonicalJsonStringify,
  type ExternalObservation,
} from '../../../provider-sdk/src/index.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import type { ProviderAdapterState } from '../adapters.ts';
import { WAVE6_IMPLEMENTED_PROVIDER_IDS } from './catalog-entries.ts';
import {
  FIXTURE_AI_ECONOMICS,
  FIXTURE_AI_MODELS,
  FIXTURE_HIN_REFERENCE,
  FIXTURE_KNOWLEDGE_ENTITIES,
  FIXTURE_OPPORTUNITIES,
  FIXTURE_PATENTS,
  FIXTURE_RESEARCH_WORKS,
  MALFORMED_PATENT_PROVIDER,
  TIMEOUT_RESEARCH_PROVIDER,
} from './fixtures.ts';
import type {
  AIEconomicObservation,
  AIModelObservation,
  HinReferenceObservation,
  KnowledgeEntity,
  OpportunityObservation,
  PatentObservation,
  ResearchWork,
} from './models.ts';

export { WAVE6_IMPLEMENTED_PROVIDER_IDS };

export type Wave6AdapterContext = {
  readonly nowUtc: string;
  readonly states: Map<string, ProviderAdapterState>;
};

export function createDefaultWave6AdapterStates(): Map<string, ProviderAdapterState> {
  const states = new Map<string, ProviderAdapterState>();
  for (const providerId of WAVE6_IMPLEMENTED_PROVIDER_IDS) {
    states.set(providerId, {
      enabled: true,
      down: false,
      rateLimited: false,
      malformed: false,
      lastSuccess: null,
      lastError: null,
      circuitState: 'CLOSED',
    });
  }
  states.set(TIMEOUT_RESEARCH_PROVIDER, {
    enabled: true,
    down: true,
    rateLimited: false,
    malformed: false,
    lastSuccess: null,
    lastError: 'PROVIDER_UNAVAILABLE',
    circuitState: 'OPEN',
  });
  states.set(MALFORMED_PATENT_PROVIDER, {
    enabled: true,
    down: false,
    rateLimited: false,
    malformed: true,
    lastSuccess: null,
    lastError: 'INVALID_PAYLOAD',
    circuitState: 'CLOSED',
  });
  return states;
}

function stateFor(ctx: Wave6AdapterContext, providerId: string): ProviderAdapterState {
  return (
    ctx.states.get(providerId) ?? {
      enabled: true,
      down: false,
      rateLimited: false,
      malformed: false,
      lastSuccess: null,
      lastError: null,
      circuitState: 'CLOSED',
    }
  );
}

function guardProvider(ctx: Wave6AdapterContext, providerId: string): string | null {
  const state = stateFor(ctx, providerId);
  if (!state.enabled) {
    return 'PROVIDER_DISABLED';
  }
  if (state.down || providerId === TIMEOUT_RESEARCH_PROVIDER) {
    return 'PROVIDER_UNAVAILABLE';
  }
  if (state.rateLimited) {
    return 'RATE_LIMITED';
  }
  if (state.malformed || providerId === MALFORMED_PATENT_PROVIDER) {
    return 'INVALID_PAYLOAD';
  }
  return null;
}

function observe<T>(
  ctx: Wave6AdapterContext,
  input: {
    readonly providerId: string;
    readonly category: 'research' | 'patents' | 'food_nutrition' | 'jobs_skills' | 'artificial_intelligence' | 'other';
    readonly capability: string;
    readonly dataset: string;
    readonly data: T;
    readonly authorityClass?: 'authoritative_official' | 'reference_data' | 'research_data' | 'community_data' | 'derived_data';
  },
): ExternalObservation<T> | null {
  const failure = guardProvider(ctx, input.providerId);
  if (failure) {
    const state = ctx.states.get(input.providerId);
    if (state) {
      ctx.states.set(input.providerId, { ...state, lastError: failure });
    }
    return null;
  }
  const rawPayload = canonicalJsonStringify(input.data);
  const built = buildExternalObservation({
    providerId: input.providerId,
    providerCategory: input.category,
    capability: input.capability,
    data: input.data,
    source: {
      provider: input.providerId,
      dataset: input.dataset,
      sourceUrl: null,
    },
    time: { retrievedAt: asUtcInstant(ctx.nowUtc), sourceTimestamp: asUtcInstant(ctx.nowUtc) },
    authorityClass: input.authorityClass ?? 'reference_data',
    provenance: {
      requestId: `wave6-${input.providerId}`,
      rawPayload,
      providerSchemaVersion: 'fixture/1',
    },
  });
  if (!built.ok) {
    return null;
  }
  const state = ctx.states.get(input.providerId);
  if (state) {
    ctx.states.set(input.providerId, { ...state, lastSuccess: ctx.nowUtc, lastError: null });
  }
  return built.value;
}

function providerFilter<T extends { readonly providerId: string }>(
  items: readonly T[],
  providerIds: readonly string[],
): readonly T[] {
  const allowed = new Set(providerIds);
  return Object.freeze(items.filter((item) => allowed.has(item.providerId)));
}

export function fetchResearchWorks(
  ctx: Wave6AdapterContext,
  query: { readonly q?: string; readonly topic?: string; readonly providerIds?: readonly string[] },
): readonly ExternalObservation<ResearchWork>[] {
  const providers = query.providerIds ?? [...WAVE6_IMPLEMENTED_PROVIDER_IDS, TIMEOUT_RESEARCH_PROVIDER];
  let works = providerFilter(FIXTURE_RESEARCH_WORKS, providers);
  if (query.q) {
    const needle = query.q.toLowerCase();
    works = Object.freeze(works.filter((w) => w.title.toLowerCase().includes(needle)));
  }
  if (query.topic) {
    works = Object.freeze(works.filter((w) => w.topics.includes(query.topic!)));
  }
  return Object.freeze(
    works
      .map((work) =>
        observe(ctx, {
          providerId: work.providerId,
          category: 'research',
          capability: 'research_works',
          dataset: 'research_catalog',
          data: work,
          authorityClass: work.authorityClass,
        }),
      )
      .filter((o): o is ExternalObservation<ResearchWork> => o !== null),
  );
}

export function fetchPatents(
  ctx: Wave6AdapterContext,
  query: { readonly q?: string; readonly jurisdiction?: string; readonly providerIds?: readonly string[] },
): readonly ExternalObservation<PatentObservation>[] {
  const providers = query.providerIds ?? [...WAVE6_IMPLEMENTED_PROVIDER_IDS, MALFORMED_PATENT_PROVIDER];
  let patents = providerFilter(FIXTURE_PATENTS, providers);
  if (query.jurisdiction) {
    patents = Object.freeze(patents.filter((p) => p.jurisdiction === query.jurisdiction));
  }
  if (query.q) {
    const needle = query.q.toLowerCase();
    patents = Object.freeze(patents.filter((p) => p.title.toLowerCase().includes(needle)));
  }
  return Object.freeze(
    patents
      .map((patent) =>
        observe(ctx, {
          providerId: patent.providerId,
          category: 'patents',
          capability: 'patent_search',
          dataset: 'patent_landscape',
          data: patent,
          authorityClass: 'reference_data',
        }),
      )
      .filter((o): o is ExternalObservation<PatentObservation> => o !== null),
  );
}

export function fetchKnowledgeEntities(
  ctx: Wave6AdapterContext,
  query: { readonly q?: string },
): readonly ExternalObservation<KnowledgeEntity>[] {
  let entities = FIXTURE_KNOWLEDGE_ENTITIES;
  if (query.q) {
    const needle = query.q.toLowerCase();
    entities = Object.freeze(entities.filter((e) => e.name.toLowerCase().includes(needle)));
  }
  return Object.freeze(
    entities
      .map((entity) =>
        observe(ctx, {
          providerId: entity.provider,
          category: 'research',
          capability: 'knowledge_graph',
          dataset: 'open_knowledge',
          data: entity,
          authorityClass: entity.authorityClass,
        }),
      )
      .filter((o): o is ExternalObservation<KnowledgeEntity> => o !== null),
  );
}

export function fetchAiModels(ctx: Wave6AdapterContext): readonly ExternalObservation<AIModelObservation>[] {
  return Object.freeze(
    FIXTURE_AI_MODELS.map((model) =>
      observe(ctx, {
        providerId: model.providerId,
        category: 'artificial_intelligence',
        capability: 'ai_model_metadata',
        dataset: 'model_catalog',
        data: model,
        authorityClass: 'derived_data',
      }),
    ).filter((o): o is ExternalObservation<AIModelObservation> => o !== null),
  );
}

export function fetchAiEconomics(ctx: Wave6AdapterContext): readonly ExternalObservation<AIEconomicObservation>[] {
  return Object.freeze(
    FIXTURE_AI_ECONOMICS.map((obs) =>
      observe(ctx, {
        providerId: obs.providerId,
        category: 'artificial_intelligence',
        capability: 'ai_economics',
        dataset: 'ai_economics',
        data: obs,
        authorityClass: 'derived_data',
      }),
    ).filter((o): o is ExternalObservation<AIEconomicObservation> => o !== null),
  );
}

export function fetchHinReference(ctx: Wave6AdapterContext): readonly ExternalObservation<HinReferenceObservation>[] {
  return Object.freeze(
    FIXTURE_HIN_REFERENCE.map((ref) =>
        observe(ctx, {
          providerId: ref.providerId,
          category: 'food_nutrition',
          capability: 'hin_reference',
        dataset: ref.dataset,
        data: ref,
        authorityClass: 'authoritative_official',
      }),
    ).filter((o): o is ExternalObservation<HinReferenceObservation> => o !== null),
  );
}

export function fetchOpportunities(
  ctx: Wave6AdapterContext,
  query: { readonly kind?: OpportunityObservation['kind']; readonly skill?: string },
): readonly ExternalObservation<OpportunityObservation>[] {
  let items = FIXTURE_OPPORTUNITIES;
  if (query.kind) {
    items = Object.freeze(items.filter((o) => o.kind === query.kind));
  }
  if (query.skill) {
    const needle = query.skill.toLowerCase();
    items = Object.freeze(items.filter((o) => o.skills.some((s) => s.toLowerCase().includes(needle))));
  }
  return Object.freeze(
    items
      .map((opp) =>
        observe(ctx, {
          providerId: opp.providerId,
          category: 'jobs_skills',
          capability: 'opportunity_search',
          dataset: 'human_economy',
          data: opp,
          authorityClass: 'reference_data',
        }),
      )
      .filter((o): o is ExternalObservation<OpportunityObservation> => o !== null),
  );
}

export function setWave6ProviderState(
  ctx: Wave6AdapterContext,
  providerId: string,
  patch: Partial<ProviderAdapterState>,
): void {
  const current = ctx.states.get(providerId);
  if (!current) {
    return;
  }
  ctx.states.set(providerId, { ...current, ...patch });
}
