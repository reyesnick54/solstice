import { createHash } from 'node:crypto';

import type { IdentityAssuranceLevel } from './assurance.ts';

type CommitField = string | number | boolean | null;

function sortedFields(fields: Readonly<Record<string, CommitField>>): Readonly<Record<string, CommitField>> {
  return Object.fromEntries(Object.entries(fields).sort(([left], [right]) => left.localeCompare(right)));
}

export function commitIdentityDomain(
  domain: string,
  fields: Readonly<Record<string, CommitField>>,
): string {
  const canonical = JSON.stringify({ domain, fields: sortedFields(fields) });
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Pseudonymous identity commitment for economic proof contexts.
 * Uses domain separation — not naïve hashing of low-entropy identifiers alone.
 */
export function humanEconomicIdentityCommitment(input: {
  readonly humanActorId: string;
  readonly pseudonymousSubjectRef: string;
  readonly assuranceLevel: IdentityAssuranceLevel;
  readonly jurisdiction: string;
}): string {
  return commitIdentityDomain('sunrey.human-economic.identity.v1', {
    schemaVersion: 1,
    humanActorId: input.humanActorId,
    pseudonymousSubjectRef: input.pseudonymousSubjectRef,
    assuranceLevel: input.assuranceLevel,
    jurisdiction: input.jurisdiction,
  });
}

/**
 * Provider uniqueness commitment. `providerSubjectToken` must be an opaque provider token,
 * never a raw email, legal name, or government identifier.
 */
export function providerUniquenessCommitment(input: {
  readonly providerRef: string;
  readonly providerSubjectToken: string;
  readonly jurisdiction: string;
  readonly saltRef: string;
}): string {
  return commitIdentityDomain('sunrey.human-economic.uniqueness.v1', {
    providerRef: input.providerRef,
    providerSubjectToken: input.providerSubjectToken,
    jurisdiction: input.jurisdiction,
    saltRef: input.saltRef,
  });
}

export function credentialOwnershipCommitment(input: {
  readonly credentialCommitment: string;
  readonly humanActorId: string;
  readonly observedAt: string;
}): string {
  return commitIdentityDomain('sunrey.human-economic.credential-ownership.v1', {
    credentialCommitment: input.credentialCommitment,
    humanActorId: input.humanActorId,
    observedAt: input.observedAt,
  });
}

export function externalIdentityCommitment(input: {
  readonly providerRef: string;
  readonly externalSubjectRef: string;
  readonly saltRef: string;
}): string {
  return commitIdentityDomain('sunrey.human-economic.external-identity.v1', {
    providerRef: input.providerRef,
    externalSubjectRef: input.externalSubjectRef,
    saltRef: input.saltRef,
  });
}

export const LOW_ENTROPY_IDENTITY_PATTERNS = [
  /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i,
  /^\d{3}-\d{2}-\d{4}$/,
  /^[A-Z][a-z]+ [A-Z][a-z]+$/,
] as const;

export function rejectsLowEntropyIdentityMaterial(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 16) {
    return LOW_ENTROPY_IDENTITY_PATTERNS.some((pattern) => pattern.test(trimmed));
  }
  return LOW_ENTROPY_IDENTITY_PATTERNS.some((pattern) => pattern.test(trimmed));
}
