/**
 * TEST / FICTIONAL operating-scope fixtures. Not legal conclusions.
 * Every record is RESEARCH_REQUIRED unless a test overlay says otherwise.
 */

import type { ActivationDomain } from '../types.ts';
import { emptyEvidenceCatalog } from './matrix.ts';
import { FIXTURE_JURISDICTION_XA, FIXTURE_JURISDICTION_XB } from './jurisdictions.ts';
import { FIXTURE_ENTITY_XA, FIXTURE_ENTITY_XB } from './products.ts';
import type {
  OperatingScopeCatalog,
  OperatingScopeQuery,
  ScopeEvidenceClass,
  ScopeEvidenceRecord,
  ScopeEvidenceState,
} from './types.ts';

export const FIXTURE_NOW = '2026-08-20T12:00:00Z' as const;

export function defaultOperatingScopeCatalog(): OperatingScopeCatalog {
  return emptyEvidenceCatalog();
}

export function queryXa(
  activationDomain: ActivationDomain,
  extra: Partial<OperatingScopeQuery> = {},
): OperatingScopeQuery {
  return {
    jurisdiction: FIXTURE_JURISDICTION_XA,
    activationDomain,
    legalEntityRef: FIXTURE_ENTITY_XA,
    nowUtc: FIXTURE_NOW,
    ...extra,
  };
}

export function evidenceRecord(input: {
  readonly evidenceId: string;
  readonly evidenceClass: ScopeEvidenceClass;
  readonly legalEntityRef?: string;
  readonly jurisdiction?: string;
  readonly activationDomain?: ActivationDomain | '*';
  readonly state?: ScopeEvidenceState;
  readonly fixture?: boolean;
  readonly actorKind?: ScopeEvidenceRecord['actorKind'];
  readonly expiresAtUtc?: string | null;
  readonly notes?: string;
}): ScopeEvidenceRecord {
  return Object.freeze({
    evidenceId: input.evidenceId,
    evidenceClass: input.evidenceClass,
    legalEntityRef: input.legalEntityRef ?? FIXTURE_ENTITY_XA,
    jurisdiction: input.jurisdiction ?? FIXTURE_JURISDICTION_XA,
    activationDomain: input.activationDomain ?? '*',
    state: input.state ?? 'RESEARCH_REQUIRED',
    fixture: input.fixture ?? true,
    fixtureKind: input.fixture === false ? null : 'TEST_FIXTURE_NOT_LEGAL_CONCLUSION',
    actorKind: input.actorKind ?? null,
    reference: `fixture:${input.evidenceId}`,
    contentHash: null,
    expiresAtUtc: input.expiresAtUtc ?? null,
    chunk160RegistryId: 'chunk-160.fixture-registry',
    notes: input.notes ?? 'TEST_FIXTURE_NOT_LEGAL_CONCLUSION',
  });
}

export function withEvidence(
  catalog: OperatingScopeCatalog,
  evidence: readonly ScopeEvidenceRecord[],
): OperatingScopeCatalog {
  return Object.freeze({
    ...catalog,
    evidence: Object.freeze([...catalog.evidence, ...evidence]),
  });
}

export function fixtureCounselOpinion(): ScopeEvidenceRecord {
  return evidenceRecord({
    evidenceId: 'ev.counsel.fixture',
    evidenceClass: 'COUNSEL_OPINION',
    state: 'EXTERNALLY_VERIFIED',
    fixture: true,
    notes: 'fixture counsel opinion is insufficient',
  });
}

export function expiredLicense(): ScopeEvidenceRecord {
  return evidenceRecord({
    evidenceId: 'ev.license.expired',
    evidenceClass: 'LICENSE_OR_REGISTRATION',
    state: 'EXPIRED',
    expiresAtUtc: '2020-01-01T00:00:00Z',
  });
}

export function revokedApproval(): ScopeEvidenceRecord {
  return evidenceRecord({
    evidenceId: 'ev.regulatory.revoked',
    evidenceClass: 'REGULATORY_APPROVAL',
    state: 'REVOKED',
  });
}

export function engineeringTestOnly(): ScopeEvidenceRecord {
  return evidenceRecord({
    evidenceId: 'ev.engineering.test',
    evidenceClass: 'ENGINEERING_TEST',
    state: 'ENGINEERING_VERIFIED',
    activationDomain: 'PAYMENT_RAILS',
  });
}

export function fixtureExternalLicense(domain: ActivationDomain | '*' = '*'): ScopeEvidenceRecord {
  return evidenceRecord({
    evidenceId: `ev.license.fixture.${String(domain)}`,
    evidenceClass: 'LICENSE_OR_REGISTRATION',
    activationDomain: domain,
    state: 'EXTERNALLY_VERIFIED',
    fixture: true,
    notes: 'externally verified fixture flow for engineering only',
  });
}

export function corridorEndpointLicense(
  jurisdiction: string,
  legalEntityRef: string,
): ScopeEvidenceRecord {
  return evidenceRecord({
    evidenceId: `ev.license.corridor.${jurisdiction}`,
    evidenceClass: 'LICENSE_OR_REGISTRATION',
    jurisdiction,
    legalEntityRef,
    activationDomain: 'PAYMENT_RAILS',
    state: 'PROVIDED_UNVERIFIED',
    fixture: true,
  });
}

export const OTHER_ENTITY = FIXTURE_ENTITY_XB;
export const OTHER_JURISDICTION = FIXTURE_JURISDICTION_XB;
