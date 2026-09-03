// @ts-nocheck
/**
 * Wave 6 — pseudonymous HumanEconomicActor model.
 *
 * Represents an economic participant without making raw legal identity the
 * default graph identifier. Forbidden identity fields stay off-chain.
 */

import { FORBIDDEN_IDENTITY_FIELDS } from '../../../../human-economic-contribution/src/taxonomy.ts';
import { HUMAN_ONTOLOGY_VERSION } from './constants.ts';
import type { HumanEconomicActor, HumanIdentityAssuranceLevel, HumanOntologyResult } from './types.ts';

export type CreateHumanEconomicActorInput = {
  readonly humanActorId: string;
  readonly pseudonymousId: string;
  readonly identityAssuranceLevel: HumanIdentityAssuranceLevel;
  readonly jurisdiction: string;
  readonly credentialRefs?: readonly string[];
  readonly rightsControllerRefs?: readonly string[];
  readonly status?: HumanEconomicActor['status'];
  readonly createdAtUtc: string;
  readonly updatedAtUtc?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
};

function ok<T>(value: T): HumanOntologyResult<T> {
  return Object.freeze({ ok: true, value });
}

function fail<T>(
  code: HumanOntologyResult<T> extends { ok: false; code: infer C } ? C : never,
  message: string,
): HumanOntologyResult<T> {
  return Object.freeze({ ok: false, code, message });
}

export function validateActorMetadata(
  metadata: Readonly<Record<string, unknown>> | undefined,
): HumanOntologyResult<true> {
  if (!metadata) {
    return ok(true);
  }
  for (const key of Object.keys(metadata)) {
    if ((FORBIDDEN_IDENTITY_FIELDS as readonly string[]).includes(key)) {
      return fail('FORBIDDEN_IDENTITY_FIELD', `human actor metadata must not include ${key}`);
    }
  }
  return ok(true);
}

export function createHumanEconomicActor(input: CreateHumanEconomicActorInput): HumanOntologyResult<HumanEconomicActor> {
  if (!input.pseudonymousId || input.pseudonymousId.trim().length === 0) {
    return fail('FORBIDDEN_IDENTITY_FIELD', 'human actor requires a pseudonymous identifier');
  }
  const metadataCheck = validateActorMetadata(input.metadata);
  if (!metadataCheck.ok) {
    return metadataCheck as HumanOntologyResult<HumanEconomicActor>;
  }
  return ok(
    Object.freeze({
      schemaVersion: HUMAN_ONTOLOGY_VERSION,
      humanActorId: input.humanActorId,
      pseudonymousId: input.pseudonymousId,
      identityAssuranceLevel: input.identityAssuranceLevel,
      jurisdiction: input.jurisdiction,
      credentialRefs: Object.freeze([...(input.credentialRefs ?? [])]),
      rightsControllerRefs: Object.freeze([...(input.rightsControllerRefs ?? [])]),
      status: input.status ?? 'ACTIVE',
      createdAtUtc: input.createdAtUtc,
      updatedAtUtc: input.updatedAtUtc ?? input.createdAtUtc,
      containsRawLegalIdentity: false,
      humanWorthScore: false,
    }),
  );
}

export function actorPseudonymCommitment(actor: HumanEconomicActor): string {
  return `hec:actor:${actor.humanActorId}:${actor.pseudonymousId}`;
}
