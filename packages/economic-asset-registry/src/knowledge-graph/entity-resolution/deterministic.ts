import type { UtcInstant } from '../../../../domain/src/time.ts';
import { canonicalEntityIdFor, entityResolutionIdFor } from '../ids.ts';
import type { CanonicalEntityId } from '../ids.ts';
import type { EntityResolutionOutcome, EntityResolutionRecord, ExternalIdentifier } from '../types.ts';
import type { AliasRegistry } from '../alias-registry.ts';

export type DeterministicResolutionInput = {
  readonly identifiers: readonly ExternalIdentifier[];
  readonly facilityId: string | null;
  readonly geographicRef: string | null;
  readonly publicationId: string | null;
  readonly organizationId: string | null;
  readonly pseudonymousRef: string | null;
  readonly createdAt: UtcInstant;
};

const HIGH_IMPACT_SYSTEMS = new Set([
  'productive_object',
  'productive_asset',
  'organization',
  'facility',
  'provider',
  'economic_claim',
  'human_contribution',
]);

export function isHighImpactIdentifier(identifier: ExternalIdentifier): boolean {
  const system = identifier.system.toLowerCase();
  return HIGH_IMPACT_SYSTEMS.has(system) || identifier.authorityClass === 'AUTHORITATIVE';
}

function deterministicKey(identifier: ExternalIdentifier): string {
  return `${identifier.system.trim().toLowerCase()}:${identifier.id.trim()}`;
}

function exactCanonicalMaterial(identifiers: readonly ExternalIdentifier[]): string {
  return identifiers.map(deterministicKey).sort().join('|');
}

export function resolveDeterministic(
  input: DeterministicResolutionInput,
  aliasRegistry: AliasRegistry,
): EntityResolutionRecord {
  const identifiers = [...input.identifiers];
  if (input.facilityId) {
    identifiers.push({ system: 'facility', id: input.facilityId, authorityClass: 'PROVIDER' });
  }
  if (input.geographicRef) {
    identifiers.push({ system: 'geography', id: input.geographicRef, authorityClass: 'DERIVED' });
  }
  if (input.publicationId) {
    identifiers.push({ system: 'publication', id: input.publicationId, authorityClass: 'AUTHORITATIVE' });
  }
  if (input.organizationId) {
    identifiers.push({ system: 'organization', id: input.organizationId, authorityClass: 'PROVIDER' });
  }
  if (input.pseudonymousRef) {
    identifiers.push({ system: 'pseudonym', id: input.pseudonymousRef, authorityClass: 'DERIVED' });
  }

  const canonicalHits = new Set<CanonicalEntityId>();
  for (const identifier of identifiers) {
    const hit = aliasRegistry.resolveIdentifier(identifier);
    if (hit) {
      canonicalHits.add(hit);
    }
  }

  let outcome: EntityResolutionOutcome = 'NO_MATCH';
  let canonicalEntityId: CanonicalEntityId | null = null;
  const candidateEntityIds: CanonicalEntityId[] = [];

  if (canonicalHits.size > 1) {
    outcome = 'CONFLICT';
    candidateEntityIds.push(...canonicalHits);
  } else if (canonicalHits.size === 1) {
    outcome = 'EXACT_MATCH';
    canonicalEntityId = canonicalHits.values().next().value ?? null;
    if (canonicalEntityId) {
      candidateEntityIds.push(canonicalEntityId);
    }
  } else if (identifiers.length > 0) {
    const material = exactCanonicalMaterial(identifiers);
    canonicalEntityId = canonicalEntityIdFor(material);
    outcome = 'EXACT_MATCH';
    candidateEntityIds.push(canonicalEntityId);
    for (const identifier of identifiers) {
      aliasRegistry.registerAlias({
        canonicalEntityId,
        externalIdentifier: identifier,
        preservedOriginalId: identifier.id,
        createdAt: input.createdAt,
        mergeStatus: 'EXACT_MATCH',
      });
    }
  }

  return Object.freeze({
    resolutionId: entityResolutionIdFor(`${outcome}:${exactCanonicalMaterial(identifiers)}:${input.createdAt}`),
    inputIdentifiers: Object.freeze(identifiers.map((id) => Object.freeze({ ...id }))),
    outcome,
    method: 'DETERMINISTIC',
    canonicalEntityId,
    candidateEntityIds: Object.freeze([...new Set(candidateEntityIds)]),
    confidence: outcome === 'EXACT_MATCH' ? 1 : outcome === 'CONFLICT' ? null : 0,
    createdAt: input.createdAt,
    autoMerged: false,
  });
}

export function scoreProbableMatch(left: ExternalIdentifier, right: ExternalIdentifier): number {
  if (deterministicKey(left) === deterministicKey(right)) {
    return 1;
  }
  const leftParts = left.id.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const rightParts = right.id.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (left.system === right.system && leftParts.length > 0 && rightParts.length > 0) {
    const overlap = leftParts.filter((part) => rightParts.includes(part)).length;
    const union = new Set([...leftParts, ...rightParts]).size;
    return union === 0 ? 0 : overlap / union;
  }
  return 0;
}

export function probabilisticOutcome(score: number): EntityResolutionOutcome {
  if (score >= 0.95) {
    return 'EXACT_MATCH';
  }
  if (score >= 0.75) {
    return 'PROBABLE_MATCH';
  }
  if (score >= 0.45) {
    return 'POSSIBLE_MATCH';
  }
  return 'NO_MATCH';
}
