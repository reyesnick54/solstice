/**
 * Bind operating-scope rows to external evidence records.
 *
 * Chunk 160 owns the external evidence registry. This module consumes
 * references (ids / hashes / states). It does not mint evidence, mark
 * counsel confirmation, or treat fixture records as production proof.
 *
 * Evidence belonging to Entity A does not authorize Entity B.
 */

import type { ActivationDomain } from '../types.ts';
import type { ScopeEvidenceClass, ScopeEvidenceRecord, ScopeEvidenceState } from './types.ts';

export type Chunk160EvidenceReference = {
  readonly registryId: string;
  readonly evidenceId: string;
  readonly evidenceClass: string;
  readonly legalEntityRef: string;
  readonly state: string;
  readonly fixture: boolean;
  readonly expiresAtUtc: string | null;
  readonly contentHash: string | null;
  readonly reference: string | null;
};

export function bindChunk160Record(
  record: Chunk160EvidenceReference,
  activationDomain: ActivationDomain | '*',
  evidenceClass: ScopeEvidenceClass,
  jurisdiction: string,
): ScopeEvidenceRecord {
  return Object.freeze({
    evidenceId: record.evidenceId,
    evidenceClass,
    legalEntityRef: record.legalEntityRef,
    jurisdiction,
    activationDomain,
    state: asScopeEvidenceState(record.state),
    fixture: record.fixture,
    fixtureKind: record.fixture ? 'CHUNK_160_FIXTURE' : null,
    actorKind: null,
    reference: record.reference,
    contentHash: record.contentHash,
    expiresAtUtc: record.expiresAtUtc,
    chunk160RegistryId: record.registryId,
    notes: 'bound from external evidence registry; fixture records are not production proof',
  });
}

export function evidenceMatchesEntity(
  record: ScopeEvidenceRecord,
  legalEntityRef: string,
): boolean {
  return record.legalEntityRef === legalEntityRef;
}

export function evidenceCoversDomain(
  record: ScopeEvidenceRecord,
  domain: ActivationDomain,
): boolean {
  return record.activationDomain === '*' || record.activationDomain === domain;
}

export function evidenceIsExpired(record: ScopeEvidenceRecord, nowUtc: string): boolean {
  if (record.state === 'EXPIRED') {
    return true;
  }
  if (record.expiresAtUtc && record.expiresAtUtc <= nowUtc) {
    return true;
  }
  return false;
}

export function evidenceIsRevoked(record: ScopeEvidenceRecord): boolean {
  return record.state === 'REVOKED';
}

export function fixtureCounselIsInsufficient(record: ScopeEvidenceRecord): boolean {
  return record.evidenceClass === 'COUNSEL_OPINION' && (record.fixture || record.state !== 'EXTERNALLY_VERIFIED');
}

export function engineeringTestIsNotLegal(record: ScopeEvidenceRecord): boolean {
  return record.evidenceClass === 'ENGINEERING_TEST' || record.state === 'ENGINEERING_VERIFIED';
}

function asScopeEvidenceState(state: string): ScopeEvidenceState {
  const allowed: readonly ScopeEvidenceState[] = [
    'NOT_PROVIDED',
    'RESEARCH_REQUIRED',
    'PROVIDED_UNVERIFIED',
    'ENGINEERING_VERIFIED',
    'EXTERNALLY_VERIFIED',
    'EXPIRED',
    'REVOKED',
  ];
  if ((allowed as readonly string[]).includes(state)) {
    return state as ScopeEvidenceState;
  }
  return 'RESEARCH_REQUIRED';
}
