/**
 * ComplianceScreeningEvidenceService — multi-provider evidence aggregation.
 * Returns EVIDENCE only. Does not issue compliance decisions.
 */

import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../../domain/src/time.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import {
  COMPLIANCE_CACHE_CAPABILITIES,
  complianceCachePolicy,
} from './cache-policies.ts';
import { privacySafeEvidenceLogRef, privacySafeSubjectRef } from './privacy.ts';
import type { ComplianceIntelligenceProvider } from './provider.ts';
import { createComplianceIntelligenceAdapterFactory } from './registry.ts';
import { complianceSeparationProof } from './separation.ts';
import type {
  ComplianceEvidence,
  ComplianceRescreenConfig,
  ComplianceScreeningQuery,
  ComplianceScreeningResult,
  ComplianceSubjectType,
  ProviderDisagreementRecord,
} from './types.ts';

export type ComplianceScreeningEvidenceServiceOptions = {
  readonly providers?: readonly ComplianceIntelligenceProvider[];
  readonly rescreenConfig?: ComplianceRescreenConfig;
  readonly nowUtc?: () => UtcInstant;
};

type CacheEntry = {
  readonly evidence: readonly ComplianceEvidence[];
  readonly negative: readonly ComplianceEvidence[];
  readonly expiresAtMs: number;
  readonly providerId: string;
};

export class ComplianceScreeningEvidenceService {
  readonly #providers: readonly ComplianceIntelligenceProvider[];
  readonly #cache = new Map<string, CacheEntry>();
  readonly #disagreements: ProviderDisagreementRecord[] = [];
  readonly #logRefs: string[] = [];
  readonly #circuitOpen = new Set<string>();
  readonly #rescreenConfig: ComplianceRescreenConfig;

  constructor(options: ComplianceScreeningEvidenceServiceOptions = {}) {
    const factory = createComplianceIntelligenceAdapterFactory();
    this.#providers = Object.freeze(options.providers ?? factory.createAll());
    this.#rescreenConfig = options.rescreenConfig ?? {
      initialOnboarding: true,
      periodicRescreeningHours: 24 * 7,
      eventTriggeredRescreening: Object.freeze(['KYC_UPGRADE', 'JURISDICTION_CHANGE', 'MANUAL_REQUEST']),
    };
  }

  separationProof() {
    return complianceSeparationProof();
  }

  rescreenConfig(): ComplianceRescreenConfig {
    return this.#rescreenConfig;
  }

  listProviders(): readonly ComplianceIntelligenceProvider[] {
    return this.#providers;
  }

  disagreementRecords(): readonly ProviderDisagreementRecord[] {
    return Object.freeze([...this.#disagreements]);
  }

  auditLogRefs(): readonly string[] {
    return Object.freeze([...this.#logRefs]);
  }

  async screenPerson(input: {
    readonly name: string;
    readonly aliases?: readonly string[];
    readonly dateOfBirth?: string | null;
    readonly nationality?: string | null;
    readonly country?: string | null;
    readonly canonicalSubjectId?: string | null;
    readonly nowUtc?: UtcInstant;
    readonly forceRefresh?: boolean;
  }): Promise<readonly ComplianceEvidence[]> {
    return this.#aggregate(await this.#runScreen('PERSON', input));
  }

  async screenOrganization(input: {
    readonly name: string;
    readonly organizationIdentifiers?: Readonly<Record<string, string>>;
    readonly country?: string | null;
    readonly canonicalSubjectId?: string | null;
    readonly nowUtc?: UtcInstant;
    readonly forceRefresh?: boolean;
  }): Promise<readonly ComplianceEvidence[]> {
    return this.#aggregate(await this.#runScreen('ORGANIZATION', input));
  }

  async searchEntity(input: {
    readonly subjectType: ComplianceSubjectType;
    readonly name: string;
    readonly aliases?: readonly string[];
    readonly dateOfBirth?: string | null;
    readonly nationality?: string | null;
    readonly country?: string | null;
    readonly organizationIdentifiers?: Readonly<Record<string, string>>;
    readonly canonicalSubjectId?: string | null;
    readonly nowUtc?: UtcInstant;
    readonly forceRefresh?: boolean;
  }): Promise<readonly ComplianceEvidence[]> {
    return this.#aggregate(await this.#runScreen(input.subjectType, input));
  }

  async getEvidence(evidenceId: string): Promise<ComplianceEvidence | null> {
    for (const entry of this.#cache.values()) {
      const found = [...entry.evidence, ...entry.negative].find((e) => e.evidenceId === evidenceId);
      if (found) return found;
    }
    return null;
  }

  async refreshEvidence(input: {
    readonly subjectType: ComplianceSubjectType;
    readonly name: string;
    readonly canonicalSubjectId?: string | null;
    readonly nowUtc?: UtcInstant;
  }): Promise<readonly ComplianceEvidence[]> {
    return this.searchEntity({ ...input, forceRefresh: true });
  }

  providerHealth(nowUtc: UtcInstant) {
    return this.#providers.map((p) => p.health(nowUtc));
  }

  async #runScreen(
    subjectType: ComplianceSubjectType,
    input: {
      readonly name: string;
      readonly aliases?: readonly string[];
      readonly dateOfBirth?: string | null;
      readonly nationality?: string | null;
      readonly country?: string | null;
      readonly organizationIdentifiers?: Readonly<Record<string, string>>;
      readonly canonicalSubjectId?: string | null;
      readonly nowUtc?: UtcInstant;
      readonly forceRefresh?: boolean;
    },
  ): Promise<ComplianceScreeningResult[]> {
    const nowUtc = input.nowUtc ?? asUtcInstant(new Date().toISOString());
    const requestId = randomUUID();
    const query: ComplianceScreeningQuery = Object.freeze({
      subjectType,
      name: input.name,
      ...(input.aliases !== undefined ? { aliases: input.aliases } : {}),
      dateOfBirth: input.dateOfBirth ?? null,
      nationality: input.nationality ?? null,
      country: input.country ?? null,
      ...(input.organizationIdentifiers !== undefined ? { organizationIdentifiers: input.organizationIdentifiers } : {}),
      canonicalSubjectId: input.canonicalSubjectId ?? null,
      requestId,
      screenedAt: nowUtc,
    });

    const cacheKey = `${subjectType}:${input.name}:${input.canonicalSubjectId ?? ''}`;
    if (!input.forceRefresh) {
      const cached = this.#readCache(cacheKey);
      if (cached) {
        return [
          Object.freeze({
            ok: true,
            query,
            evidence: cached.evidence,
            negativeObservations: cached.negative,
            providerId: cached.providerId,
            fromCache: true,
            fallbackProviderId: null,
            errorCode: null,
          }),
        ];
      }
    }

    const logRef = privacySafeSubjectRef(input.canonicalSubjectId ?? null, requestId);
    this.#logRefs.push(logRef);

    const results: ComplianceScreeningResult[] = [];
    for (const provider of this.#sortedProviders()) {
      if (this.#circuitOpen.has(provider.providerId)) continue;
      const result = await this.#callProvider(provider, query);
      results.push(result);
      if (!result.ok) {
        if (result.errorCode === 'PROVIDER_UNAVAILABLE' || result.errorCode === 'SERVER_ERROR') {
          this.#circuitOpen.add(provider.providerId);
        }
      } else if (!result.fromCache) {
        this.#writeCache(cacheKey, result);
      }
    }

    this.#detectDisagreements(query, results, nowUtc);
    return results;
  }

  async #callProvider(
    provider: ComplianceIntelligenceProvider,
    query: ComplianceScreeningQuery,
  ): Promise<ComplianceScreeningResult> {
    if (query.subjectType === 'PERSON' || query.subjectType === 'BENEFICIARY' || query.subjectType === 'COUNTERPARTY') {
      return provider.screenPerson(query);
    }
    if (
      query.subjectType === 'ORGANIZATION' ||
      query.subjectType === 'LEGAL_ENTITY' ||
      query.subjectType === 'BUSINESS'
    ) {
      return provider.screenOrganization(query);
    }
    return provider.searchEntity(query);
  }

  #sortedProviders(): readonly ComplianceIntelligenceProvider[] {
    const rank = { primary: 0, secondary: 1, fallback: 2 };
    return Object.freeze([...this.#providers].sort((a, b) => rank[a.priority] - rank[b.priority]));
  }

  #aggregate(results: ComplianceScreeningResult[]): readonly ComplianceEvidence[] {
    const all: ComplianceEvidence[] = [];
    for (const result of results) {
      for (const ev of result.evidence) {
        all.push(ev);
        this.#logRefs.push(privacySafeEvidenceLogRef(ev.evidenceId));
      }
      for (const neg of result.negativeObservations) {
        all.push(neg);
      }
    }
    return Object.freeze(all);
  }

  #readCache(key: string): CacheEntry | null {
    const entry = this.#cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAtMs) {
      this.#cache.delete(key);
      return null;
    }
    return entry;
  }

  #writeCache(key: string, result: ComplianceScreeningResult): void {
    const policy = complianceCachePolicy(
      result.evidence.length > 0
        ? COMPLIANCE_CACHE_CAPABILITIES.recordMetadata
        : COMPLIANCE_CACHE_CAPABILITIES.negativeObservation,
    );
    this.#cache.set(key, {
      evidence: result.evidence,
      negative: result.negativeObservations,
      expiresAtMs: Date.now() + policy.freshTtlMs,
      providerId: result.providerId,
    });
  }

  #detectDisagreements(
    query: ComplianceScreeningQuery,
    results: ComplianceScreeningResult[],
    nowUtc: UtcInstant,
  ): void {
    const successful = results.filter((r) => r.ok);
    if (successful.length < 2) return;
    const hasMatch = successful.some((r) => r.evidence.some((e) => e.classification !== 'OTHER'));
    const hasNoMatch = successful.some(
      (r) => r.evidence.length === 0 && r.negativeObservations.length > 0,
    );
    if (hasMatch && hasNoMatch) {
      this.#disagreements.push(
        Object.freeze({
          queryRequestId: query.requestId,
          providerA: successful[0]!.providerId,
          providerB: successful[1]!.providerId,
          classification: 'SANCTIONS',
          disagreementType: 'MATCH_VS_NO_MATCH',
          observedAt: nowUtc,
        }),
      );
    }
  }
}

export function createComplianceScreeningEvidenceService(
  options?: ComplianceScreeningEvidenceServiceOptions,
): ComplianceScreeningEvidenceService {
  return new ComplianceScreeningEvidenceService(options);
}

export function createComplianceIntelligenceSandbox(): ComplianceScreeningEvidenceService {
  return new ComplianceScreeningEvidenceService();
}
