import { PRODUCTION_PARAMETER_IDS, type ProductionParameterId } from '../types.ts';
import {
  FORBIDDEN_PARAMETER_SOURCE_CLASSES,
  type ParameterSourceClass,
  type ProductionEconomicParameterPackage,
  type ProductionParameterCandidate,
} from '../parameter-package/types.ts';

import type { AuthorizationParameterClass, AuthorizationParameterStatusRow } from './types.ts';

const REHEARSAL_SOURCES = new Set(['REHEARSAL_FIXTURE', 'ENGINEERING_SIMULATION']);

export function classifyCandidate(candidate: ProductionParameterCandidate | undefined): AuthorizationParameterClass {
  if (!candidate) {
    return 'UNCONFIGURED';
  }
  if ((FORBIDDEN_PARAMETER_SOURCE_CLASSES as readonly string[]).includes(candidate.sourceClass)) {
    return 'REJECTED_SOURCE';
  }
  if (candidate.fixture || candidate.rehearsalOnly || REHEARSAL_SOURCES.has(candidate.sourceClass)) {
    return 'REHEARSAL_REFERENCE';
  }
  if (candidate.sourceClass === 'UNCONFIGURED') {
    return 'UNCONFIGURED';
  }
  if (candidate.value === null) {
    return 'MISSING';
  }
  if (
    candidate.sourceClass === 'HUMAN_GOVERNANCE_CANDIDATE' ||
    candidate.sourceClass === 'PROTOCOL_GOVERNANCE_CANDIDATE' ||
    candidate.sourceClass === 'EXTERNAL_REVIEWED_CANDIDATE'
  ) {
    return 'PRODUCTION_CANDIDATE';
  }
  return 'REJECTED_SOURCE';
}

export function rehearsalReferenceCannotPromote(authorizationClass: AuthorizationParameterClass): boolean {
  return authorizationClass === 'REHEARSAL_REFERENCE';
}

export function parameterStatusesFromPackage(
  pkg: ProductionEconomicParameterPackage,
): readonly AuthorizationParameterStatusRow[] {
  const byId = new Map(pkg.parameters.map((row) => [row.parameterId, row]));
  return Object.freeze(
    PRODUCTION_PARAMETER_IDS.map((parameterId) => statusRow(parameterId, byId.get(parameterId))),
  );
}

export function statusRow(
  parameterId: ProductionParameterId,
  candidate: ProductionParameterCandidate | undefined,
): AuthorizationParameterStatusRow {
  const authorizationClass = classifyCandidate(candidate);
  const rehearsalReference = authorizationClass === 'REHEARSAL_REFERENCE';
  return Object.freeze({
    parameterId,
    firewallStatus:
      authorizationClass === 'PRODUCTION_CANDIDATE'
        ? 'CONFIGURED'
        : authorizationClass === 'REJECTED_SOURCE'
          ? 'REJECTED_SOURCE'
          : 'UNCONFIGURED',
    authorizationClass,
    sourceClass: (candidate?.sourceClass as ParameterSourceClass | undefined) ?? 'UNCONFIGURED',
    rehearsalReference,
    productionEligible: authorizationClass === 'PRODUCTION_CANDIDATE',
  });
}

export function missingProductionParameters(rows: readonly AuthorizationParameterStatusRow[]): readonly ProductionParameterId[] {
  return rows.filter((row) => row.authorizationClass !== 'PRODUCTION_CANDIDATE').map((row) => row.parameterId);
}

export function rehearsalParametersPresent(rows: readonly AuthorizationParameterStatusRow[]): boolean {
  return rows.some((row) => row.rehearsalReference);
}

export function productionParametersConfigured(rows: readonly AuthorizationParameterStatusRow[]): boolean {
  return rows.length > 0 && rows.every((row) => row.productionEligible);
}
