import { currentRepositoryParameterPackage, validateParameterPackage } from '../parameter-package/validation.ts';
import { completeFixturePackageInput, fixturePackageInput } from '../parameter-package/fixtures.ts';

import { evaluateProductionEconomicAuthorization } from './assemble.ts';
import { currentExternalEvidenceSlots } from './bindings.ts';
import type { RequiredExternalEvidenceClass } from './types.ts';

export function blankProductionAuthorization() {
  return evaluateProductionEconomicAuthorization({
    currentParameters: currentRepositoryParameterPackage(),
    proposedParameters: currentRepositoryParameterPackage(),
    packageId: 'sunrey.production-economic-authorization.blank.v1',
  });
}

export function rehearsalReferenceAuthorization() {
  return evaluateProductionEconomicAuthorization({
    currentParameters: currentRepositoryParameterPackage(),
    proposedParameters: validateParameterPackage(completeFixturePackageInput()).package,
    packageId: 'sunrey.production-economic-authorization.rehearsal.v1',
  });
}

export function emptyProposedAuthorization() {
  return evaluateProductionEconomicAuthorization({
    currentParameters: currentRepositoryParameterPackage(),
    proposedParameters: validateParameterPackage(fixturePackageInput([])).package,
    packageId: 'sunrey.production-economic-authorization.empty.v1',
  });
}

export function withEvidenceOverlay(
  overlays: Partial<Record<RequiredExternalEvidenceClass, { present?: boolean; revoked?: boolean; expiresAtUtc?: string | null; contentHash?: string | null; fixture?: boolean }>>,
  nowUtc = '2026-08-20T12:00:00.000Z',
) {
  return evaluateProductionEconomicAuthorization({
    currentParameters: currentRepositoryParameterPackage(),
    proposedParameters: currentRepositoryParameterPackage(),
    evidenceSlots: currentExternalEvidenceSlots(overlays),
    nowUtc,
  });
}
