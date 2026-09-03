/**
 * Wave 4 Task 6 — materialization rules.
 *
 * Differentiates queried data, cached data, persisted observation,
 * Evidence Vault record, and graph projection. A successful federated
 * query does not automatically authorize permanent storage.
 */

import type {
  FederatedQueryRequest,
  FederationQueryPurpose,
  FederationRejection,
  FederationRightsContext,
  MaterializationLevel,
} from './types.ts';
import { federationRejection } from './types.ts';

const PURPOSE_DEFAULT_MATERIALIZATION: Readonly<Record<FederationQueryPurpose, MaterializationLevel>> =
  Object.freeze({
    RESEARCH: 'QUERIED_ONLY',
    OPERATIONAL_MONITORING: 'CACHED',
    FEDERATED_CORRELATION: 'QUERIED_ONLY',
    ECONOMIC_AWARENESS: 'OBSERVATION',
    PRODUCT_IMPROVEMENT: 'CACHED',
    AGGREGATED_ANALYTICS: 'QUERIED_ONLY',
    ECONOMIC_VALUATION: 'OBSERVATION',
    MONETARY_PROPOSAL: 'EVIDENCE_VAULT',
  });

const LICENSE_MATERIALIZATION_CEILING = Object.freeze({
  QUERIED_ONLY: ['QUERIED_ONLY'] as const,
  CACHED: ['QUERIED_ONLY', 'CACHED'] as const,
  OBSERVATION: ['QUERIED_ONLY', 'CACHED', 'OBSERVATION'] as const,
  EVIDENCE_VAULT: ['QUERIED_ONLY', 'CACHED', 'OBSERVATION', 'EVIDENCE_VAULT'] as const,
  GRAPH_PROJECTION: ['QUERIED_ONLY', 'CACHED', 'GRAPH_PROJECTION'] as const,
}) as Readonly<Record<MaterializationLevel, readonly MaterializationLevel[]>>;

export function defaultMaterializationForPurpose(
  purpose: FederationQueryPurpose,
): MaterializationLevel {
  return PURPOSE_DEFAULT_MATERIALIZATION[purpose];
}

export function resolveMaterialization(input: {
  readonly request: FederatedQueryRequest;
  readonly rightsContext: FederationRightsContext;
}): Readonly<{
  readonly level: MaterializationLevel;
  readonly persistenceAuthorized: boolean;
  readonly rejection: FederationRejection | null;
}> {
  const requested = input.request.requestedMaterialization;
  const purposeDefault = defaultMaterializationForPurpose(input.request.purpose);
  const level = requested ?? purposeDefault;

  if (input.rightsContext.permittedMaterialization.length === 0) {
    if (level !== 'QUERIED_ONLY') {
      return Object.freeze({
        level: 'QUERIED_ONLY',
        persistenceAuthorized: false,
        rejection: federationRejection(
          'PERSISTENCE_DENIED',
          'no permitted materialization levels in rights context; defaulting to QUERIED_ONLY',
        ),
      });
    }
    return Object.freeze({ level, persistenceAuthorized: false, rejection: null });
  }

  const permitted = new Set(input.rightsContext.permittedMaterialization);
  if (!permitted.has(level)) {
    const ceiling = [...input.rightsContext.permittedMaterialization].sort((left, right) => {
      const order: MaterializationLevel[] = [
        'QUERIED_ONLY',
        'CACHED',
        'GRAPH_PROJECTION',
        'OBSERVATION',
        'EVIDENCE_VAULT',
      ];
      return order.indexOf(right) - order.indexOf(left);
    })[0];
    return Object.freeze({
      level: ceiling ?? 'QUERIED_ONLY',
      persistenceAuthorized: ceiling !== 'QUERIED_ONLY',
      rejection: federationRejection(
        'PERSISTENCE_DENIED',
        `requested materialization ${level} not permitted; capped at ${ceiling ?? 'QUERIED_ONLY'}`,
      ),
    });
  }

  const persistenceAuthorized = level !== 'QUERIED_ONLY';
  return Object.freeze({ level, persistenceAuthorized, rejection: null });
}

export function materializationAllowed(
  rightsContext: FederationRightsContext,
  level: MaterializationLevel,
): boolean {
  if (rightsContext.permittedMaterialization.length === 0) {
    return level === 'QUERIED_ONLY';
  }
  return rightsContext.permittedMaterialization.includes(level);
}

export function describeMaterialization(level: MaterializationLevel): string {
  switch (level) {
    case 'QUERIED_ONLY':
      return 'Ephemeral query result; not persisted beyond request scope.';
    case 'CACHED':
      return 'Short-lived cache with TTL; not durable observation.';
    case 'OBSERVATION':
      return 'Durable fabric observation journal entry; not Evidence Vault.';
    case 'EVIDENCE_VAULT':
      return 'Hash-chained evidence record; requires explicit authorization.';
    case 'GRAPH_PROJECTION':
      return 'Non-authoritative graph projection; not ledger truth.';
  }
}

export function maxMaterializationFromRights(
  rightsContext: FederationRightsContext,
): MaterializationLevel {
  const order: MaterializationLevel[] = [
    'QUERIED_ONLY',
    'CACHED',
    'GRAPH_PROJECTION',
    'OBSERVATION',
    'EVIDENCE_VAULT',
  ];
  let max: MaterializationLevel = 'QUERIED_ONLY';
  for (const level of order) {
    if (rightsContext.permittedMaterialization.includes(level)) {
      max = level;
    }
  }
  return max;
}

export function isWithinLicenseCeiling(
  permitted: readonly MaterializationLevel[],
  requested: MaterializationLevel,
): boolean {
  for (const ceiling of permitted) {
    if (LICENSE_MATERIALIZATION_CEILING[ceiling]?.includes(requested)) {
      return true;
    }
  }
  return requested === 'QUERIED_ONLY';
}
