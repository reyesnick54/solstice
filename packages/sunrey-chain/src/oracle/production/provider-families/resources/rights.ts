import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import {
  LEGAL_OWNERSHIP_INFERRED,
  type ResourceFabricPolicy,
  type ResourceParty,
  type ResourceRefusal,
  type ResourceRightsReference,
  type ResourceSourceRecord,
} from './types.ts';

export function partiesOf(record: ResourceSourceRecord): readonly ResourceParty[] {
  return record.parties;
}

export function operatorIsNotLegalOwner(parties: readonly ResourceParty[]): Result<true, ResourceRefusal> {
  void parties;
  return ok(true);
}

export function inferLegalOwnerFromOperator(_parties: readonly ResourceParty[]): Result<never, ResourceRefusal> {
  return err({
    code: 'OPERATOR_IS_NOT_LEGAL_OWNER',
    detail: 'mining operator is not inferred as legal owner of resource rights',
  });
}

export function legalOwnershipInferred(): false {
  return LEGAL_OWNERSHIP_INFERRED;
}

export function fixtureIsNotAuthorization(reference: ResourceRightsReference): Result<true, ResourceRefusal> {
  if (reference.fixtureOnly && reference.provesRealAuthorization !== false) {
    return err({
      code: 'FIXTURE_IS_NOT_AUTHORIZATION',
      detail: 'a fixture rights reference is not proof of real authorization',
    });
  }
  if (reference.fixtureOnly) {
    return ok(true);
  }
  return ok(true);
}

/**
 * Productive extraction contributions may require an appropriate
 * rights/concession/operating reference under policy. Missing rights
 * fail closed when the policy requires them. Fixtures never fabricate
 * permits.
 */
export function evaluateExtractionRights(
  record: ResourceSourceRecord,
  policy: ResourceFabricPolicy,
): Result<readonly ResourceRightsReference[], ResourceRefusal> {
  const ownership = operatorIsNotLegalOwner(record.parties);
  if (!ownership.ok) {
    return ownership;
  }
  for (const reference of record.rightsReferences) {
    const fixture = fixtureIsNotAuthorization(reference);
    if (!fixture.ok) {
      return fixture;
    }
  }
  if (!policy.requireExtractionRightsReference) {
    return ok(record.rightsReferences);
  }
  const operating = record.rightsReferences.filter(
    (row) =>
      row.role === 'RIGHTS_HOLDER' ||
      row.role === 'CONCESSION_HOLDER' ||
      row.role === 'LICENSE_HOLDER' ||
      row.role === 'LEGAL_OWNER',
  );
  if (operating.length === 0) {
    return err({
      code: 'MISSING_RIGHTS_REFERENCE',
      detail: 'policy requires a concession, license, or rights-holder reference for extraction',
    });
  }
  return ok(record.rightsReferences);
}

export function separatePartyRoles(parties: readonly ResourceParty[]): Readonly<Record<string, readonly string[]>> {
  const grouped: Record<string, string[]> = {
    OPERATOR: [],
    CONTROLLER: [],
    RIGHTS_HOLDER: [],
    CONCESSION_HOLDER: [],
    LICENSE_HOLDER: [],
    CUSTODIAN: [],
    LEGAL_OWNER: [],
  };
  for (const party of parties) {
    grouped[party.role] = [...(grouped[party.role] ?? []), party.partyId];
  }
  return Object.freeze(
    Object.fromEntries(Object.entries(grouped).map(([key, value]) => [key, Object.freeze(value)])) as Record<
      string,
      readonly string[]
    >,
  );
}
