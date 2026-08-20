import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import {
  LEGAL_OWNERSHIP_INFERRED,
  type AgricultureFabricPolicy,
  type AgricultureParty,
  type AgricultureRefusal,
  type AgricultureRightsReference,
  type AgricultureSourceRecord,
} from './types.ts';

export function operatorIsNotLegalOwner(parties: readonly AgricultureParty[]): Result<true, AgricultureRefusal> {
  void parties;
  return ok(true);
}

export function inferLegalOwnerFromOperator(_parties: readonly AgricultureParty[]): Result<never, AgricultureRefusal> {
  return err({
    code: 'OPERATOR_IS_NOT_LEGAL_OWNER',
    detail: 'farm operator is not inferred as landowner or legal owner of agricultural rights',
  });
}

export function legalOwnershipInferred(): false {
  return LEGAL_OWNERSHIP_INFERRED;
}

export function fixtureIsNotAuthorization(reference: AgricultureRightsReference): Result<true, AgricultureRefusal> {
  if (reference.fixtureOnly && reference.provesRealAuthorization !== false) {
    return err({
      code: 'FIXTURE_IS_NOT_AUTHORIZATION',
      detail: 'a fixture land-right or concession reference is not proof of real authorization',
    });
  }
  return ok(true);
}

export function evaluateHarvestRights(
  record: AgricultureSourceRecord,
  policy: AgricultureFabricPolicy,
): Result<readonly AgricultureRightsReference[], AgricultureRefusal> {
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
  if (!policy.requireHarvestRightsReference) {
    return ok(record.rightsReferences);
  }
  const operating = record.rightsReferences.filter(
    (row) =>
      row.role === 'LAND_RIGHT_HOLDER' ||
      row.role === 'RIGHTS_HOLDER' ||
      row.role === 'CONCESSION_HOLDER' ||
      row.role === 'LICENSE_HOLDER' ||
      row.role === 'LEGAL_OWNER',
  );
  if (operating.length === 0) {
    return err({
      code: 'MISSING_RIGHTS_REFERENCE',
      detail: 'policy requires a land-right, concession, license, or rights-holder reference for harvest output',
    });
  }
  return ok(record.rightsReferences);
}

export function separatePartyRoles(parties: readonly AgricultureParty[]): Readonly<Record<string, readonly string[]>> {
  const grouped: Record<string, string[]> = {
    OPERATOR: [],
    CONTROLLER: [],
    LAND_RIGHT_HOLDER: [],
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
