import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import type {
  RealEstateFabricPolicy,
  RealEstateParty,
  RealEstateRefusal,
  RealEstateRightsReference,
  RealEstateSourceRecord,
} from './types.ts';
import { PROPERTY_OWNERSHIP_EQUALS_PRODUCTIVE_USE } from './types.ts';

export function partiesOf(record: RealEstateSourceRecord): readonly RealEstateParty[] {
  return record.parties;
}

export function separatePartyRoles(parties: readonly RealEstateParty[]): {
  readonly ownerIds: readonly string[];
  readonly operatorIds: readonly string[];
  readonly managerIds: readonly string[];
  readonly useRightHolderIds: readonly string[];
} {
  return Object.freeze({
    ownerIds: Object.freeze(parties.filter((row) => row.role === 'LEGAL_OWNER').map((row) => row.partyId)),
    operatorIds: Object.freeze(parties.filter((row) => row.role === 'OPERATOR').map((row) => row.partyId)),
    managerIds: Object.freeze(parties.filter((row) => row.role === 'PROPERTY_MANAGER').map((row) => row.partyId)),
    useRightHolderIds: Object.freeze(parties.filter((row) => row.role === 'USE_RIGHT_HOLDER').map((row) => row.partyId)),
  });
}

export function inferOwnerFromOperator(_parties: readonly RealEstateParty[]): Result<never, RealEstateRefusal> {
  return err({
    code: 'OWNERSHIP_IS_NOT_USAGE',
    detail: 'operator or manager records do not infer legal ownership',
  });
}

export function legalOwnershipInferred(): false {
  return PROPERTY_OWNERSHIP_EQUALS_PRODUCTIVE_USE;
}

export function evaluateUseRights(
  record: RealEstateSourceRecord,
  policy: RealEstateFabricPolicy,
): Result<readonly RealEstateRightsReference[], RealEstateRefusal> {
  if (!policy.requireUseRightReference) {
    return ok(record.rightsReferences);
  }
  if (record.factType !== 'REAL_ESTATE_USAGE') {
    return ok(record.rightsReferences);
  }
  const useRight = record.rightsReferences.find(
    (row) => row.role === 'USE_RIGHT_HOLDER' || row.leaseOrUseCommitment !== null,
  );
  if (!useRight) {
    return err({
      code: 'OWNERSHIP_IS_NOT_USAGE',
      detail: 'realized usage requires an explicit use-right or lease reference',
    });
  }
  return ok(record.rightsReferences);
}
