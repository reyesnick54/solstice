import { economicProofDigest } from '../hash.ts';
import { entityCommitmentFromRefs } from '../entity-identity.ts';
import type { EntityAliasRef, EntityAliasResolver } from '../types.ts';
import { asUtcInstant } from '../../../../domain/src/time.ts';

export const HUMAN_FIXTURE_NOW = asUtcInstant('2026-09-01T12:00:00.000Z');

export const RESEARCH_PAPER_COMMITMENT = entityCommitmentFromRefs([
  'doi:10.1000/research-paper-wave3',
  'title-hash:abc123',
]);

export const ORCID_ALIAS: EntityAliasRef = Object.freeze({
  aliasKind: 'ORCID',
  aliasValueCommitment: entityCommitmentFromRefs(['orcid:0000-0002-1825-0097']),
});

export const PUBMED_ALIAS: EntityAliasRef = Object.freeze({
  aliasKind: 'PUBMED_AUTHOR',
  aliasValueCommitment: entityCommitmentFromRefs(['pubmed-author:smith-j-2024']),
});

export const UNIVERSITY_ALIAS: EntityAliasRef = Object.freeze({
  aliasKind: 'UNIVERSITY_ID',
  aliasValueCommitment: entityCommitmentFromRefs(['uni:stanford:contributor:wave3']),
});

export const HIN_ALIAS: EntityAliasRef = Object.freeze({
  aliasKind: 'HIN_SUBJECT',
  aliasValueCommitment: entityCommitmentFromRefs(['hin:subject:wave3-research']),
});

export function createHumanAliasResolver(): EntityAliasResolver {
  const canonical = entityCommitmentFromRefs(['canonical-researcher-wave3']);
  const map = new Map<string, string>([
    [aliasKey(ORCID_ALIAS), canonical],
    [aliasKey(PUBMED_ALIAS), canonical],
    [aliasKey(UNIVERSITY_ALIAS), canonical],
    [aliasKey(HIN_ALIAS), canonical],
  ]);
  return Object.freeze({
    resolveAlias(alias: EntityAliasRef) {
      return (map.get(aliasKey(alias)) ?? null) as ReturnType<EntityAliasResolver['resolveAlias']>;
    },
  });
}

function aliasKey(alias: EntityAliasRef): string {
  return `${alias.aliasKind}:${alias.aliasValueCommitment}`;
}

export function researchPayloadDigest(source: string): string {
  return economicProofDigest(['research-contribution', source, RESEARCH_PAPER_COMMITMENT]);
}

export function employmentPayloadDigest(attempt: number): string {
  return economicProofDigest(['employment-activity', 'employer:acme', `attempt:${attempt}`]);
}

export function computationReceiptDigest(receiptId: string): string {
  return economicProofDigest(['computation-receipt', receiptId]);
}

export function attestationDigest(attestationId: string): string {
  return economicProofDigest(['attestation', attestationId]);
}
