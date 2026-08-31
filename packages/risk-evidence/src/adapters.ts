/**
 * Wave 4 risk evidence provider adapters with simulation fixtures.
 */

import { randomUUID } from 'node:crypto';

import { asUtcInstant } from '../../domain/src/time.ts';
import { FIXTURE_COMPANIES } from '../../external-data/src/fixtures.ts';
import {
  FIXTURE_BUSINESSES,
  FIXTURE_DIGITAL_RISK,
  RATE_LIMIT_PROVIDER,
  TIMEOUT_PROVIDER,
} from './fixtures.ts';
import type {
  BusinessIdentityEvidence,
  BusinessResolutionKey,
  BusinessSearchQuery,
  DigitalRiskEvidence,
  DigitalRiskType,
} from './models.ts';
import { classifyFreshness, RETENTION_POLICIES } from './retention.ts';
import { WAVE4_ELIGIBLE_CATALOG_PROVIDER_IDS } from './catalog-entries.ts';

export type RiskAdapterState = {
  readonly enabled: boolean;
  readonly down: boolean;
  readonly rateLimited: boolean;
  readonly malformed: boolean;
  readonly lastSuccess: string | null;
  readonly lastError: string | null;
};

export type Wave4AdapterContext = {
  readonly nowUtc: string;
  readonly states: Map<string, RiskAdapterState>;
};

export function createDefaultRiskAdapterStates(): Map<string, RiskAdapterState> {
  const states = new Map<string, RiskAdapterState>();
  for (const id of [...WAVE4_ELIGIBLE_CATALOG_PROVIDER_IDS, 'fixture-identity', 'fixture-aml', TIMEOUT_PROVIDER, RATE_LIMIT_PROVIDER]) {
    states.set(id, {
      enabled: true,
      down: false,
      rateLimited: false,
      malformed: false,
      lastSuccess: null,
      lastError: null,
    });
  }
  return states;
}

function stateFor(ctx: Wave4AdapterContext, providerId: string): RiskAdapterState {
  return (
    ctx.states.get(providerId) ?? {
      enabled: true,
      down: false,
      rateLimited: false,
      malformed: false,
      lastSuccess: null,
      lastError: null,
    }
  );
}

function guardProvider(ctx: Wave4AdapterContext, providerId: string): string | null {
  const state = stateFor(ctx, providerId);
  if (!state.enabled) return 'PROVIDER_DISABLED';
  if (state.down || providerId === TIMEOUT_PROVIDER) return 'PROVIDER_UNAVAILABLE';
  if (state.rateLimited || providerId === RATE_LIMIT_PROVIDER) return 'RATE_LIMITED';
  if (state.malformed) return 'INVALID_PAYLOAD';
  return null;
}

function businessKey(query: BusinessSearchQuery | BusinessResolutionKey): string {
  if ('registrationNumber' in query && query.registrationNumber) {
    return `${query.jurisdiction}:${query.registrationNumber}`.toLowerCase();
  }
  if ('legalName' in query && query.legalName) {
    return `${query.jurisdiction}:${query.legalName}`.toLowerCase();
  }
  return '';
}

function findBusinessEvidence(
  query: BusinessSearchQuery | BusinessResolutionKey,
): BusinessIdentityEvidence | null {
  const key = businessKey(query);
  const match = FIXTURE_BUSINESSES.find((b) => {
    const bizKey = `${b.jurisdiction}:${b.registrationNumber ?? b.legalName}`.toLowerCase();
    if (bizKey === key) return true;
    if ('legalName' in query && query.legalName) {
      return (
        b.legalName.toLowerCase() === query.legalName.toLowerCase() &&
        b.jurisdiction === query.jurisdiction
      );
    }
    return false;
  });
  return match ?? null;
}

function resolveFromSecEdgar(
  ctx: Wave4AdapterContext,
  query: BusinessSearchQuery,
): BusinessIdentityEvidence | null {
  const failure = guardProvider(ctx, 'sec-edgar');
  if (failure) return null;

  const needle = (query.legalName ?? query.registrationNumber ?? '').toLowerCase();
  const company = FIXTURE_COMPANIES.find(
    (c) =>
      c.jurisdiction === query.jurisdiction &&
      (c.legalName.toLowerCase().includes(needle) ||
        c.cik === query.registrationNumber ||
        c.entityId.includes(query.registrationNumber ?? '')),
  );
  if (!company) return null;

  return Object.freeze({
    evidenceId: `kyb-ev:sec-edgar:${company.entityId}`,
    entityId: company.entityId,
    legalName: company.legalName,
    tradingName: null,
    registrationNumber: company.cik ?? null,
    jurisdiction: company.jurisdiction,
    status: 'ACTIVE',
    providerNativeStatus: 'Active (SEC registrant)',
    incorporationDate: null,
    entityType: 'Public Company',
    registeredAddress: null,
    officers: Object.freeze([]),
    providerId: 'sec-edgar',
    providerRecordId: company.providerCompanyId ?? company.cik ?? null,
    retrievedAt: asUtcInstant(ctx.nowUtc),
    sourceUpdatedAt: null,
    freshness: 'FRESH',
    confidence: 0.92,
    authorityClass: 'authoritative_official',
    provenance: 'sec-edgar:company-search',
  });
}

export function searchBusinessEvidence(
  ctx: Wave4AdapterContext,
  query: BusinessSearchQuery,
): readonly BusinessIdentityEvidence[] {
  const results: BusinessIdentityEvidence[] = [];

  const fixtureMatches = FIXTURE_BUSINESSES.filter((b) => {
    if (b.jurisdiction !== query.jurisdiction) return false;
    if (query.registrationNumber && b.registrationNumber === query.registrationNumber) return true;
    if (query.legalName && b.legalName.toLowerCase().includes(query.legalName.toLowerCase())) {
      return true;
    }
    return false;
  });
  results.push(...fixtureMatches);

  if (query.jurisdiction === 'US') {
    const sec = resolveFromSecEdgar(ctx, query);
    if (sec && !results.some((r) => r.entityId === sec.entityId)) {
      results.push(sec);
    }
  }

  return Object.freeze(results);
}

export function lookupBusinessEvidence(
  ctx: Wave4AdapterContext,
  key: BusinessResolutionKey,
): BusinessIdentityEvidence | null {
  if (!key.registrationNumber || !key.jurisdiction) {
    return null;
  }
  const fixture = findBusinessEvidence(key);
  if (fixture) return fixture;
  if (key.jurisdiction === 'US') {
    return resolveFromSecEdgar(ctx, {
      registrationNumber: key.registrationNumber,
      jurisdiction: key.jurisdiction,
    });
  }
  return null;
}

export function getBusinessEvidence(
  ctx: Wave4AdapterContext,
  entityId: string,
): BusinessIdentityEvidence | null {
  const fixture = FIXTURE_BUSINESSES.find((b) => b.entityId === entityId);
  if (fixture) return fixture;
  if (entityId.includes('us:') && guardProvider(ctx, 'sec-edgar') === null) {
    const cik = entityId.split(':').pop();
    return lookupBusinessEvidence(ctx, { registrationNumber: cik ?? '', jurisdiction: 'US' });
  }
  return null;
}

export function normalizeProviderScore(score: unknown): number | null {
  if (typeof score !== 'number' || !Number.isFinite(score)) return null;
  if (score < 0 || score > 100) return null;
  return score;
}

export function fetchDigitalRiskEvidence(
  ctx: Wave4AdapterContext,
  input: {
    readonly subjectRef: string;
    readonly riskType: DigitalRiskType;
    readonly sessionId?: string;
    readonly deviceId?: string;
    readonly userId?: string;
    readonly providerId?: string;
  },
): DigitalRiskEvidence | null {
  const providerId = input.providerId ?? 'fixture-aml';
  const failure = guardProvider(ctx, providerId);
  if (failure) return null;

  const ref = input.subjectRef.toLowerCase();
  const fixture = FIXTURE_DIGITAL_RISK.find((d) => {
    if (d.riskType !== input.riskType) return false;
    if (ref.includes('vpn') && d.riskType === 'VPN') return true;
    if (ref.includes('tor') && d.riskType === 'TOR') return true;
    if (ref.includes('proxy') && d.riskType === 'PROXY') return true;
    if (ref.includes('email') && d.riskType === 'EMAIL_REPUTATION') return true;
    if (ref.includes('travel') && d.riskType === 'LOCATION_ANOMALY') return true;
    if (ref.includes('malformed')) return false;
    if (ref.includes('clean') || ref.includes('ok')) return d.riskType === 'IP_REPUTATION';
    return false;
  });

  if (!fixture) {
    if (ref.includes('malformed')) {
      return null;
    }
    return Object.freeze({
      evidenceId: `dr-ev:${randomUUID()}`,
      sessionId: input.sessionId ?? null,
      deviceId: input.deviceId ?? null,
      userId: input.userId ?? null,
      riskType: input.riskType,
      riskScore: 10,
      confidence: 0.9,
      providerId,
      providerNativeClassification: 'low_risk',
      observedAt: asUtcInstant(ctx.nowUtc),
      retrievedAt: asUtcInstant(ctx.nowUtc),
      freshness: 'FRESH',
      provenance: `fixture:${providerId}:default`,
      ipIntelligence: null,
      emailReputation: null,
    });
  }

  const freshness = classifyFreshness(
    fixture.retrievedAt,
    ctx.nowUtc,
    RETENTION_POLICIES.SESSION_DIGITAL_RISK.maxAgeHours,
  );

  return Object.freeze({
    ...fixture,
    evidenceId: `dr-ev:${input.subjectRef}:${input.riskType}`,
    sessionId: input.sessionId ?? fixture.sessionId,
    deviceId: input.deviceId ?? fixture.deviceId,
    userId: input.userId ?? fixture.userId,
    retrievedAt: asUtcInstant(ctx.nowUtc),
    freshness,
    riskScore: ref.includes('malformed') ? null : normalizeProviderScore(fixture.riskScore),
  });
}

export function businessesAreDistinct(
  a: BusinessIdentityEvidence,
  b: BusinessIdentityEvidence,
): boolean {
  if (a.legalName.toLowerCase() !== b.legalName.toLowerCase()) return true;
  return a.jurisdiction !== b.jurisdiction || a.registrationNumber !== b.registrationNumber;
}
