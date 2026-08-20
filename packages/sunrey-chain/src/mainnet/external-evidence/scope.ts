/**
 * Strict scope matching. Evidence is not globally reusable unless its
 * scope genuinely says so. A PAYMENT_RAIL contract in one jurisdiction
 * does not authorize FX, custody, KYC, or another country.
 */

import type { ExternalEvidenceQuery, ExternalEvidenceScope, ExternalProductionEvidenceRecord } from './types.ts';

export function freezeScope(scope: ExternalEvidenceScope): ExternalEvidenceScope {
  return Object.freeze({
    label: scope.label,
    global: scope.global,
    jurisdictions: Object.freeze([...scope.jurisdictions]),
    activationDomains: Object.freeze([...scope.activationDomains]),
    providerDomains: Object.freeze([...scope.providerDomains]),
  });
}

export function scopeFromParts(input: {
  readonly label: string;
  readonly global?: boolean;
  readonly jurisdictions?: readonly string[];
  readonly activationDomains?: ExternalEvidenceScope['activationDomains'];
  readonly providerDomains?: ExternalEvidenceScope['providerDomains'];
}): ExternalEvidenceScope {
  const jurisdictions = input.jurisdictions ?? [];
  const activationDomains = input.activationDomains ?? [];
  const providerDomains = input.providerDomains ?? [];
  const global =
    input.global === true &&
    jurisdictions.length === 0 &&
    activationDomains.length === 0 &&
    providerDomains.length === 0;
  return freezeScope({
    label: input.label,
    global,
    jurisdictions,
    activationDomains,
    providerDomains,
  });
}

function includesOrUnrestricted(haystack: readonly string[], needle: string | undefined): boolean {
  if (needle === undefined) {
    return true;
  }
  return haystack.includes(needle);
}

export function scopeMatchesQuery(
  scope: ExternalEvidenceScope,
  query: Pick<ExternalEvidenceQuery, 'jurisdiction' | 'activationDomain' | 'providerDomain'>,
): boolean {
  if (scope.global) {
    return (
      scope.jurisdictions.length === 0 &&
      scope.activationDomains.length === 0 &&
      scope.providerDomains.length === 0
    );
  }
  if (query.jurisdiction !== undefined && scope.jurisdictions.length === 0) {
    return false;
  }
  if (query.activationDomain !== undefined && scope.activationDomains.length === 0) {
    return false;
  }
  if (query.providerDomain !== undefined && scope.providerDomains.length === 0) {
    return false;
  }
  return (
    includesOrUnrestricted(scope.jurisdictions, query.jurisdiction) &&
    includesOrUnrestricted(scope.activationDomains, query.activationDomain) &&
    includesOrUnrestricted(scope.providerDomains, query.providerDomain)
  );
}

export function recordMatchesQuery(
  record: ExternalProductionEvidenceRecord,
  query: ExternalEvidenceQuery,
): boolean {
  if (record.evidenceClass !== query.evidenceClass) {
    return false;
  }
  if (query.subjectType !== undefined && record.subjectType !== query.subjectType) {
    return false;
  }
  if (query.subjectId !== undefined && record.subjectId !== query.subjectId) {
    return false;
  }
  return scopeMatchesQuery(record.scope, query);
}

export function inferClassFromAnotherClass(): never {
  throw new TypeError('external evidence classes are not inferred from one another');
}
