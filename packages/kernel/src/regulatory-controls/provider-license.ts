/**
 * Wave 7 — Provider license enforcement.
 *
 * Restrictions propagate through policy decisions. A provider may allow
 * query but not persistence, internal computation but not redistribution,
 * or non-commercial use only.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import { LEGAL_REVIEW_STATUS, type ProviderLicenseCapability } from './taxonomy.ts';
import type { ProviderLicenseRestriction } from './types.ts';

export const DEFAULT_PROVIDER_LICENSES: readonly ProviderLicenseRestriction[] = Object.freeze([
  Object.freeze({
    providerId: 'open-sanctions',
    licenseRef: 'license:open-sanctions-odbl',
    permitted: Object.freeze(['QUERY', 'INTERNAL_COMPUTATION', 'NON_COMMERCIAL_USE']),
    denied: Object.freeze(['PERSIST', 'REDISTRIBUTE', 'COMMERCIAL_USE']),
    jurisdictions: Object.freeze(['GB', 'US', 'EU']),
    effectiveFrom: '2026-01-01T00:00:00.000Z' as UtcInstant,
    legalStatus: LEGAL_REVIEW_STATUS,
  }),
  Object.freeze({
    providerId: 'fred-economic',
    licenseRef: 'license:fred-public-domain',
    permitted: Object.freeze(['QUERY', 'PERSIST', 'INTERNAL_COMPUTATION', 'REDISTRIBUTE', 'NON_COMMERCIAL_USE']),
    denied: Object.freeze(['COMMERCIAL_USE']),
    jurisdictions: Object.freeze(['US']),
    effectiveFrom: '2026-01-01T00:00:00.000Z' as UtcInstant,
    legalStatus: LEGAL_REVIEW_STATUS,
  }),
  Object.freeze({
    providerId: 'fixture-oracle-alpha',
    licenseRef: 'license:fixture-query-only',
    permitted: Object.freeze(['QUERY', 'INTERNAL_COMPUTATION']),
    denied: Object.freeze(['PERSIST', 'REDISTRIBUTE', 'COMMERCIAL_USE', 'NON_COMMERCIAL_USE']),
    jurisdictions: Object.freeze(['GB', 'US', 'EU', 'SA']),
    effectiveFrom: '2026-01-01T00:00:00.000Z' as UtcInstant,
    legalStatus: LEGAL_REVIEW_STATUS,
  }),
  Object.freeze({
    providerId: 'fixture-health-provider',
    licenseRef: 'license:fixture-health-restricted',
    permitted: Object.freeze(['QUERY', 'INTERNAL_COMPUTATION']),
    denied: Object.freeze(['PERSIST', 'REDISTRIBUTE']),
    jurisdictions: Object.freeze(['US', 'EU']),
    effectiveFrom: '2026-01-01T00:00:00.000Z' as UtcInstant,
    legalStatus: LEGAL_REVIEW_STATUS,
  }),
]);

export type ProviderLicenseEvaluationInput = {
  readonly providerId: string;
  readonly capability: ProviderLicenseCapability;
  readonly jurisdiction: string;
  readonly at: UtcInstant;
};

export type ProviderLicenseEvaluationResult = {
  readonly allowed: boolean;
  readonly reasonCode: string;
  readonly reason: string;
  readonly licenseRef: string | null;
};

export class ProviderLicenseRegistry {
  private readonly licenses: Map<string, ProviderLicenseRestriction>;

  constructor(seed: readonly ProviderLicenseRestriction[] = DEFAULT_PROVIDER_LICENSES) {
    this.licenses = new Map(seed.map((license) => [license.providerId, license]));
  }

  get(providerId: string): ProviderLicenseRestriction | undefined {
    return this.licenses.get(providerId);
  }

  evaluate(input: ProviderLicenseEvaluationInput): ProviderLicenseEvaluationResult {
    const license = this.licenses.get(input.providerId);
    if (!license) {
      return Object.freeze({
        allowed: false,
        reasonCode: 'PROVIDER_LICENSE_UNKNOWN',
        reason: `no license restriction configured for provider ${input.providerId}`,
        licenseRef: null,
      });
    }

    if (!license.jurisdictions.includes(input.jurisdiction)) {
      return Object.freeze({
        allowed: false,
        reasonCode: 'PROVIDER_LICENSE_JURISDICTION_DENIED',
        reason: `provider ${input.providerId} not licensed for jurisdiction ${input.jurisdiction}`,
        licenseRef: license.licenseRef,
      });
    }

    if (license.denied.includes(input.capability)) {
      return Object.freeze({
        allowed: false,
        reasonCode: 'PROVIDER_LICENSE_CAPABILITY_DENIED',
        reason: `provider ${input.providerId} denies capability ${input.capability}`,
        licenseRef: license.licenseRef,
      });
    }

    if (license.permitted.length > 0 && !license.permitted.includes(input.capability)) {
      return Object.freeze({
        allowed: false,
        reasonCode: 'PROVIDER_LICENSE_CAPABILITY_NOT_PERMITTED',
        reason: `capability ${input.capability} not in permitted set for provider ${input.providerId}`,
        licenseRef: license.licenseRef,
      });
    }

    return Object.freeze({
      allowed: true,
      reasonCode: 'PROVIDER_LICENSE_ALLOWED',
      reason: `provider ${input.providerId} permits capability ${input.capability}`,
      licenseRef: license.licenseRef,
    });
  }
}
