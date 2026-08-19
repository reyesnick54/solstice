import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import {
  LEGAL_OWNERSHIP_INFERRED,
  type WaterFabricPolicy,
  type WaterParty,
  type WaterRefusal,
  type WaterRightsReference,
  type WaterSourceRecord,
} from './types.ts';

export function operatorIsNotLegalOwner(parties: readonly WaterParty[]): Result<true, WaterRefusal> {
  void parties;
  return ok(true);
}

export function inferLegalOwnerFromOperator(_parties: readonly WaterParty[]): Result<never, WaterRefusal> {
  return err({
    code: 'OPERATOR_IS_NOT_LEGAL_OWNER',
    detail: 'water operator is not inferred as water-right owner or legal title holder',
  });
}

export function legalOwnershipInferred(): false {
  return LEGAL_OWNERSHIP_INFERRED;
}

export function fixtureIsNotAuthorization(reference: WaterRightsReference): Result<true, WaterRefusal> {
  if (reference.fixtureOnly && reference.provesRealAuthorization !== false) {
    return err({
      code: 'FIXTURE_IS_NOT_AUTHORIZATION',
      detail: 'a fixture water-right or concession reference is not proof of a real permit',
    });
  }
  return ok(true);
}

/**
 * Well / reservoir extraction may require a rights reference under
 * policy. Missing real evidence remains missing. Fixtures never
 * fabricate permits.
 */
export function evaluateWaterRights(
  record: WaterSourceRecord,
  policy: WaterFabricPolicy,
): Result<readonly WaterRightsReference[], WaterRefusal> {
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
  const extractionClass =
    record.sourceClass === 'WELL_PRODUCTION_METER' ||
    record.sourceClass === 'RESERVOIR_REFERENCE' ||
    record.sourceClass === 'AQUIFER_REFERENCE' ||
    record.sourceClass === 'PUMPING_METER';
  if (!extractionClass) {
    return ok(record.rightsReferences);
  }
  const operating = record.rightsReferences.filter(
    (row) =>
      row.role === 'WATER_RIGHT_HOLDER' ||
      row.role === 'RIGHTS_HOLDER' ||
      row.role === 'CONCESSION_HOLDER' ||
      row.role === 'LICENSE_HOLDER' ||
      row.role === 'LEGAL_OWNER',
  );
  if (operating.length === 0) {
    return err({
      code: 'MISSING_RIGHTS_REFERENCE',
      detail: 'policy requires a water-right, concession, or license reference for well/reservoir extraction',
    });
  }
  return ok(record.rightsReferences);
}

export function separatePartyRoles(parties: readonly WaterParty[]): Readonly<Record<string, readonly string[]>> {
  const grouped: Record<string, string[]> = {
    OPERATOR: [],
    CONTROLLER: [],
    WATER_RIGHT_HOLDER: [],
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
