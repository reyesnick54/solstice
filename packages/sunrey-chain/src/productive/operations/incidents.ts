/**
 * Wave 5 — Oracle / provider incident handling.
 *
 * Incidents classify operational failures and apply containment without
 * pausing the entire blockchain when one provider fails.
 */

import { err, ok, type Result } from '../../../../domain/src/result.ts';
import { asUtcInstant, type UtcInstant } from '../../../../domain/src/time.ts';
import type { ProductiveCategory } from '../types.ts';
import type {
  IncidentContainmentAction,
  ProductiveOperationsRejection,
  ProviderIncident,
  ProviderIncidentClass,
} from './types.ts';
import { PRODUCTIVE_OPERATIONS_SCHEMA_VERSION } from './types.ts';

const DEFAULT_CONTAINMENT: Readonly<Record<ProviderIncidentClass, readonly IncidentContainmentAction[]>> =
  Object.freeze({
    PROVIDER_OUTAGE: ['DISABLE_PROVIDER', 'REQUIRE_MANUAL_REVIEW'],
    AUTH_FAILURE: ['DISABLE_PROVIDER', 'QUARANTINE_DATA'],
    SCHEMA_BREAK: ['QUARANTINE_DATA', 'STOP_DOMAIN_VERIFICATION', 'REQUIRE_MANUAL_REVIEW'],
    DATA_INTEGRITY_FAILURE: ['QUARANTINE_DATA', 'STOP_DOMAIN_VERIFICATION', 'REQUIRE_MANUAL_REVIEW'],
    SOURCE_COMPROMISE_SUSPECTED: ['DISABLE_PROVIDER', 'QUARANTINE_DATA', 'STOP_DOMAIN_VERIFICATION', 'REQUIRE_MANUAL_REVIEW'],
    LICENSE_CHANGE: ['REQUIRE_MANUAL_REVIEW', 'STOP_DOMAIN_VERIFICATION'],
    EXTREME_OUTLIER: ['QUARANTINE_DATA', 'REQUIRE_MANUAL_REVIEW'],
    SYSTEMATIC_BIAS_SUSPECTED: ['QUARANTINE_DATA', 'STOP_DOMAIN_VERIFICATION', 'REQUIRE_MANUAL_REVIEW'],
  });

export function containmentForIncident(
  classification: ProviderIncidentClass,
): readonly IncidentContainmentAction[] {
  return DEFAULT_CONTAINMENT[classification];
}

export function openProviderIncident(input: {
  readonly incidentId: string;
  readonly providerId: string;
  readonly sourceClass?: string;
  readonly classification: ProviderIncidentClass;
  readonly domainScope?: ProductiveCategory | 'ALL_DOMAINS';
  readonly evidenceCommitment: string;
  readonly openedAtUtc?: UtcInstant;
  readonly containmentActions?: readonly IncidentContainmentAction[];
}): ProviderIncident {
  return Object.freeze({
    schemaVersion: PRODUCTIVE_OPERATIONS_SCHEMA_VERSION,
    incidentId: input.incidentId,
    providerId: input.providerId,
    sourceClass: input.sourceClass ?? null,
    classification: input.classification,
    containmentActions: input.containmentActions ?? containmentForIncident(input.classification),
    domainScope: input.domainScope ?? 'ALL_DOMAINS',
    evidenceCommitment: input.evidenceCommitment,
    openedAtUtc: input.openedAtUtc ?? asUtcInstant(new Date().toISOString()),
    resolvedAtUtc: null,
    blockchainPaused: false,
  });
}

export class ProviderIncidentRegistry {
  private readonly incidents = new Map<string, ProviderIncident>();
  private readonly disabledProviders = new Set<string>();
  private readonly quarantinedProviders = new Set<string>();

  open(input: Parameters<typeof openProviderIncident>[0]): ProviderIncident {
    const incident = openProviderIncident(input);
    this.incidents.set(incident.incidentId, incident);
    this.applyContainment(incident);
    return incident;
  }

  private applyContainment(incident: ProviderIncident): void {
    for (const action of incident.containmentActions) {
      if (action === 'DISABLE_PROVIDER') {
        this.disabledProviders.add(incident.providerId);
      }
      if (action === 'QUARANTINE_DATA') {
        this.quarantinedProviders.add(incident.providerId);
      }
    }
  }

  resolve(incidentId: string, resolvedAtUtc?: UtcInstant): Result<ProviderIncident, ProductiveOperationsRejection> {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      return err({ code: 'CLAIM_NOT_FOUND', detail: `incident ${incidentId} not found` });
    }
    const resolved = Object.freeze({
      ...incident,
      resolvedAtUtc: resolvedAtUtc ?? asUtcInstant(new Date().toISOString()),
    });
    this.incidents.set(incidentId, resolved);
    return ok(resolved);
  }

  isProviderDisabled(providerId: string): boolean {
    return this.disabledProviders.has(providerId);
  }

  isProviderQuarantined(providerId: string): boolean {
    return this.quarantinedProviders.has(providerId);
  }

  reEnableProvider(providerId: string): Result<true, ProductiveOperationsRejection> {
    if (!this.disabledProviders.has(providerId) && !this.quarantinedProviders.has(providerId)) {
      return err({ code: 'PROVIDER_ALREADY_DISABLED', detail: `provider ${providerId} is not under incident containment` });
    }
    this.disabledProviders.delete(providerId);
    this.quarantinedProviders.delete(providerId);
    return ok(true);
  }

  listOpen(): readonly ProviderIncident[] {
    return [...this.incidents.values()].filter((row) => row.resolvedAtUtc === null);
  }

  list(): readonly ProviderIncident[] {
    return [...this.incidents.values()];
  }
}
