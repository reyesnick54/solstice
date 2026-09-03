// @ts-nocheck
/**
 * Shared builders and fixture loading for compliance intelligence adapters.
 */

import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { asUtcInstant, type UtcInstant } from '../../../../domain/src/time.ts';
import type { ComplianceAuthorityClass } from '../catalog-types.ts';
import {
  isExactNameMatch,
  isFuzzyNameMatch,
  normalizeAliasList,
  normalizeComplianceName,
  tokenOverlapScore,
} from '../name-normalization.ts';
import type {
  ComplianceEvidence,
  ComplianceEvidenceClassification,
  ComplianceMatchType,
  ComplianceScreeningQuery,
  ComplianceScreeningResult,
  ComplianceSubjectType,
  PepRelationshipType,
} from '../types.ts';
import { COMPLIANCE_EVIDENCE_SCHEMA } from '../types.ts';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
export const NORMALIZATION_VERSION = 'wave4-compliance-v1';

export type AdapterScenario =
  | 'normal'
  | 'stale'
  | 'timeout'
  | 'rate_limited'
  | 'server_error'
  | 'disagreeing'
  | 'unavailable'
  | 'malformed';

export function loadComplianceFixture(fileName: string): unknown {
  const text = readFileSync(join(FIXTURES_DIR, fileName), 'utf8');
  return JSON.parse(text) as unknown;
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function classifyOpenSanctionsDataset(dataset: string): ComplianceEvidenceClassification {
  const lower = dataset.toLowerCase();
  if (lower.includes('pep') || lower.includes('wd_peps')) return 'PEP';
  if (lower.includes('wanted') || lower.includes('interpol')) return 'WANTED';
  if (lower.includes('sanction') || lower.includes('ofac') || lower.includes('hmt') || lower.includes('un_sc') || lower.includes('eu_fsf')) {
    return 'SANCTIONS';
  }
  if (lower.includes('watch') || lower.includes('fsf')) return 'WATCHLIST';
  return 'OTHER';
}

export function listAuthorityForDataset(dataset: string): { listName: string; listAuthority: string; jurisdiction: string | null } {
  const lower = dataset.toLowerCase();
  if (lower.includes('ofac')) return { listName: 'OFAC SDN', listAuthority: 'US Treasury OFAC', jurisdiction: 'US' };
  if (lower.includes('hmt')) return { listName: 'UK HMT Sanctions', listAuthority: 'UK HM Treasury', jurisdiction: 'GB' };
  if (lower.includes('eu_fsf')) return { listName: 'EU Financial Sanctions', listAuthority: 'European Union', jurisdiction: 'EU' };
  if (lower.includes('un_sc')) return { listName: 'UN Security Council', listAuthority: 'United Nations', jurisdiction: null };
  if (lower.includes('pep')) return { listName: 'PEP Dataset', listAuthority: 'OpenSanctions PEP', jurisdiction: null };
  return { listName: dataset, listAuthority: 'OpenSanctions', jurisdiction: null };
}

export function buildMatchDimensions(
  queryName: string,
  recordName: string,
  providerScore: number | null,
  matchedFields: readonly string[],
  unmatchedFields: readonly string[],
): {
  matchType: ComplianceMatchType;
  matchedFields: readonly string[];
  unmatchedFields: readonly string[];
  matchScore: number | null;
  exactMatch: boolean;
  fuzzyMatch: boolean;
  providerNativeScore: number | null;
} {
  const queryNorm = normalizeComplianceName(queryName);
  const recordNorm = normalizeComplianceName(recordName);
  const exact = isExactNameMatch(queryNorm, recordNorm);
  const fuzzy = !exact && isFuzzyNameMatch(queryNorm, recordNorm);
  const sunreyScore = exact ? 1 : fuzzy ? tokenOverlapScore(queryNorm, recordNorm) : providerScore;
  const matchType: ComplianceMatchType = exact ? 'EXACT' : fuzzy ? 'FUZZY' : providerScore != null ? 'FUZZY' : 'ALIAS';
  return Object.freeze({
    matchType,
    matchedFields,
    unmatchedFields,
    matchScore: sunreyScore,
    exactMatch: exact,
    fuzzyMatch: fuzzy || (providerScore != null && providerScore >= 0.7),
    providerNativeScore: providerScore,
  });
}

export function buildComplianceEvidence(input: {
  readonly providerId: string;
  readonly authorityClass: ComplianceAuthorityClass;
  readonly query: ComplianceScreeningQuery;
  readonly classification: ComplianceEvidenceClassification;
  readonly recordId: string;
  readonly recordName: string;
  readonly aliases: readonly string[];
  readonly matchedFields: readonly string[];
  readonly unmatchedFields: readonly string[];
  readonly providerScore: number | null;
  readonly listName: string | null;
  readonly listAuthority: string | null;
  readonly jurisdiction: string | null;
  readonly program: string | null;
  readonly sourceUpdatedAt: UtcInstant | null;
  readonly sourceUrl: string | null;
  readonly rawPayload: string;
  readonly pepRelationship?: PepRelationshipType;
  readonly pepRole?: string | null;
  readonly dateOfBirth?: string | null;
  readonly nationality?: string | null;
  readonly country?: string | null;
  readonly orgIdentifiers?: Readonly<Record<string, string>>;
  readonly freshness?: 'fresh' | 'aging' | 'stale' | 'expired';
  readonly verificationStatus?: 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'UNVERIFIED' | 'STALE';
}): ComplianceEvidence {
  const match = buildMatchDimensions(
    input.query.name,
    input.recordName,
    input.providerScore,
    input.matchedFields,
    input.unmatchedFields,
  );
  const evidenceId = `cmp-ev:${input.providerId}:${sha256Hex(`${input.recordId}:${input.query.requestId}`).slice(0, 16)}`;
  const isPep = input.classification === 'PEP';
  return Object.freeze({
    schema: COMPLIANCE_EVIDENCE_SCHEMA,
    evidenceId,
    subject: Object.freeze({
      subjectType: input.query.subjectType,
      canonicalSubjectId: input.query.canonicalSubjectId ?? null,
      name: input.query.name,
      aliases: Object.freeze([...normalizeAliasList(input.query.aliases ?? []).map((a) => a.original)]),
      dateOfBirth: input.dateOfBirth ?? input.query.dateOfBirth ?? null,
      nationality: input.nationality ?? input.query.nationality ?? null,
      country: input.country ?? input.query.country ?? null,
      organizationIdentifiers: Object.freeze({ ...(input.orgIdentifiers ?? input.query.organizationIdentifiers ?? {}) }),
    }),
    match: Object.freeze({
      ...match,
      algorithm: match.fuzzyMatch ? 'token_overlap_v1' : null,
      algorithmVersion: match.fuzzyMatch ? '1.0.0' : null,
      threshold: match.fuzzyMatch ? 0.75 : null,
    }),
    source: Object.freeze({
      providerId: input.providerId,
      providerRecordId: input.recordId,
      listName: input.listName,
      listAuthority: input.listAuthority,
      jurisdiction: input.jurisdiction,
      program: input.program,
      designationDate: input.sourceUpdatedAt,
      removalDate: null,
      status: 'ACTIVE',
      sourceUrl: input.sourceUrl,
    }),
    classification: input.classification,
    time: Object.freeze({
      sourceUpdatedAt: input.sourceUpdatedAt,
      retrievedAt: input.query.screenedAt,
      screenedAt: input.query.screenedAt,
    }),
    quality: Object.freeze({
      confidence: match.matchScore,
      freshness: input.freshness ?? 'fresh',
      verificationStatus: input.verificationStatus ?? 'VERIFIED',
    }),
    authority: Object.freeze({ authorityClass: input.authorityClass }),
    provenance: Object.freeze({
      observationId: randomUUID(),
      rawPayloadHash: sha256Hex(input.rawPayload),
      schemaVersion: '1.0.0',
      normalizationVersion: NORMALIZATION_VERSION,
    }),
    pepDetails: isPep
      ? Object.freeze({
          relationship: input.pepRelationship ?? 'CURRENT',
          role: input.pepRole ?? null,
          country: input.country ?? input.query.country ?? null,
          startDate: null,
          endDate: null,
        })
      : null,
    originalName: input.recordName,
    grantsDecisionAuthority: false,
    isKernelDecision: false,
  });
}

export function buildNegativeObservation(
  providerId: string,
  authorityClass: ComplianceAuthorityClass,
  query: ComplianceScreeningQuery,
  rawPayload: string,
): ComplianceEvidence {
  const base = buildComplianceEvidence({
    providerId,
    authorityClass,
    query,
    classification: 'OTHER',
    recordId: `no-match:${query.requestId}`,
    recordName: query.name,
    aliases: [],
    matchedFields: [],
    unmatchedFields: Object.freeze(['name', 'aliases', 'identifiers']),
    providerScore: null,
    listName: null,
    listAuthority: null,
    jurisdiction: null,
    program: null,
    sourceUpdatedAt: null,
    sourceUrl: null,
    rawPayload,
    freshness: 'fresh',
    verificationStatus: 'VERIFIED',
  });
  return Object.freeze({
    ...base,
    match: Object.freeze({
      ...base.match,
      matchType: 'NEGATIVE_OBSERVATION' as ComplianceMatchType,
      exactMatch: false,
      fuzzyMatch: false,
      matchScore: null,
    }),
  });
}

export function screeningSuccess(
  query: ComplianceScreeningQuery,
  providerId: string,
  evidence: readonly ComplianceEvidence[],
  negativeObservations: readonly ComplianceEvidence[] = [],
  fromCache = false,
): ComplianceScreeningResult {
  return Object.freeze({
    ok: true,
    query,
    evidence: Object.freeze([...evidence]),
    negativeObservations: Object.freeze([...negativeObservations]),
    providerId,
    fromCache,
    fallbackProviderId: null,
    errorCode: null,
  });
}

export function screeningFailure(
  query: ComplianceScreeningQuery,
  providerId: string,
  errorCode: string,
): ComplianceScreeningResult {
  return Object.freeze({
    ok: false,
    query,
    evidence: Object.freeze([]),
    negativeObservations: Object.freeze([]),
    providerId,
    fromCache: false,
    fallbackProviderId: null,
    errorCode,
  });
}

export function parseOpenSanctionsResults(
  raw: unknown,
  query: ComplianceScreeningQuery,
  providerId: string,
): ComplianceEvidence[] {
  if (!raw || typeof raw !== 'object') return [];
  const payload = raw as { results?: unknown[] };
  if (!Array.isArray(payload.results)) return [];
  const evidence: ComplianceEvidence[] = [];
  for (const row of payload.results) {
    if (!row || typeof row !== 'object') continue;
    const entity = row as Record<string, unknown>;
    const id = String(entity.id ?? randomUUID());
    const caption = String(entity.caption ?? '');
    const props = (entity.properties ?? {}) as Record<string, unknown>;
    const datasets = Array.isArray(entity.datasets) ? entity.datasets.map(String) : [];
    const dataset = datasets[0] ?? 'unknown';
    const classification = classifyOpenSanctionsDataset(dataset);
    const listMeta = listAuthorityForDataset(dataset);
    const names = Array.isArray(props.name) ? props.name.map(String) : [caption];
    const aliases = Array.isArray(props.alias) ? props.alias.map(String) : [];
    const recordName = names[0] ?? caption;
    const dob = Array.isArray(props.birthDate) ? String(props.birthDate[0]) : null;
    const nationality = Array.isArray(props.nationality) ? String(props.nationality[0]).toUpperCase() : null;
    const country = Array.isArray(props.country) ? String(props.country[0]).toUpperCase() : null;
    const score = typeof entity.score === 'number' ? entity.score : null;
    const lastChange =
      entity.last_change != null
        ? parseSourceTimestamp(String(entity.last_change))
        : null;
    const matchedFields: string[] = ['name'];
    const unmatchedFields: string[] = [];
    if (query.dateOfBirth && dob && query.dateOfBirth !== dob) unmatchedFields.push('dateOfBirth');
    else if (query.dateOfBirth && dob) matchedFields.push('dateOfBirth');
    if (query.nationality && nationality && query.nationality !== nationality) unmatchedFields.push('nationality');
    else if (query.nationality && nationality) matchedFields.push('nationality');
    const orgIds: Record<string, string> = {};
    if (Array.isArray(props.registrationNumber)) {
      orgIds.registrationNumber = String(props.registrationNumber[0]);
    }
    const isStale =
      lastChange != null &&
      Date.parse(lastChange) < Date.parse(query.screenedAt) - 365 * 24 * 60 * 60 * 1000;
    evidence.push(
      buildComplianceEvidence({
        providerId,
        authorityClass: 'reference_data',
        query,
        classification,
        recordId: id,
        recordName,
        aliases,
        matchedFields: Object.freeze(matchedFields),
        unmatchedFields: Object.freeze(unmatchedFields),
        providerScore: score,
        listName: listMeta.listName,
        listAuthority: listMeta.listAuthority,
        jurisdiction: listMeta.jurisdiction,
        program: dataset,
        sourceUpdatedAt: lastChange,
        sourceUrl: `https://www.opensanctions.org/entities/${id}/`,
        rawPayload: JSON.stringify(entity),
        pepRelationship: classification === 'PEP' ? 'CURRENT' : undefined,
        pepRole: Array.isArray(props.position) ? String(props.position[0]) : null,
        dateOfBirth: dob,
        nationality,
        country,
        orgIdentifiers: orgIds,
        freshness: isStale ? 'stale' : 'fresh',
        verificationStatus: isStale ? 'STALE' : 'VERIFIED',
      }),
    );
  }
  return evidence;
}

export function parseInterpolNotices(
  raw: unknown,
  query: ComplianceScreeningQuery,
  providerId: string,
): ComplianceEvidence[] {
  if (!raw || typeof raw !== 'object') return [];
  const payload = raw as { _embedded?: { notices?: unknown[] } };
  const notices = payload._embedded?.notices;
  if (!Array.isArray(notices)) return [];
  const evidence: ComplianceEvidence[] = [];
  for (const row of notices) {
    if (!row || typeof row !== 'object') continue;
    const notice = row as Record<string, unknown>;
    const entityId = String(notice.entity_id ?? randomUUID());
    const forename = String(notice.forename ?? '');
    const surname = String(notice.name ?? '');
    const recordName = `${forename} ${surname}`.trim();
    const dob = notice.date_of_birth != null ? String(notice.date_of_birth) : null;
    const nationalities = Array.isArray(notice.nationalities) ? notice.nationalities.map(String) : [];
    const nationality = nationalities[0]?.toUpperCase() ?? null;
    const warrants = Array.isArray(notice.arrest_warrants) ? notice.arrest_warrants : [];
    const charge =
      warrants.length > 0 && typeof warrants[0] === 'object'
        ? String((warrants[0] as Record<string, unknown>).charge ?? '')
        : null;
    const selfLink =
      notice._links && typeof notice._links === 'object'
        ? String(((notice._links as Record<string, unknown>).self as Record<string, unknown>)?.href ?? '')
        : null;
    evidence.push(
      buildComplianceEvidence({
        providerId,
        authorityClass: 'authoritative_official',
        query,
        classification: 'WANTED',
        recordId: entityId,
        recordName,
        aliases: [],
        matchedFields: Object.freeze(['name']),
        unmatchedFields: Object.freeze(query.dateOfBirth && dob && query.dateOfBirth !== dob ? ['dateOfBirth'] : []),
        providerScore: null,
        listName: 'INTERPOL Red Notices',
        listAuthority: 'INTERPOL',
        jurisdiction: nationality,
        program: charge,
        sourceUpdatedAt: null,
        sourceUrl: selfLink || `https://ws-public.interpol.int/notices/v1/red/${entityId}`,
        rawPayload: JSON.stringify(notice),
        dateOfBirth: dob,
        nationality,
      }),
    );
  }
  return evidence;
}

export function subjectTypeIsOrganization(subjectType: ComplianceSubjectType): boolean {
  return subjectType === 'ORGANIZATION' || subjectType === 'LEGAL_ENTITY' || subjectType === 'BUSINESS';
}

function parseSourceTimestamp(value: string): UtcInstant {
  const trimmed = value.trim();
  if (trimmed.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(trimmed)) {
    return asUtcInstant(trimmed);
  }
  return asUtcInstant(`${trimmed}Z`);
}
