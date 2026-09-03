/**
 * Wave 7 — Data residency architecture.
 *
 * Vendor-neutral region model. No hard-coded cloud provider assumptions.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import { LEGAL_REVIEW_STATUS, type StorageRegion } from './taxonomy.ts';
import type { DataResidencyConstraint } from './types.ts';

export const DEFAULT_RESIDENCY_CONSTRAINTS: readonly DataResidencyConstraint[] = Object.freeze([
  Object.freeze({
    constraintId: 'residency.eu.data_at_rest.v1',
    mode: 'ALLOWED_REGIONS',
    jurisdictions: Object.freeze(['EU', 'DE', 'FR', 'IE']),
    allowedRegions: Object.freeze(['EU_WEST', 'EU_CENTRAL']),
    prohibitedRegions: Object.freeze(['US_EAST', 'US_WEST', 'ME_CENTRAL']),
    crossBorderRestricted: true,
    processingOnlyNoPersist: false,
    effectiveFrom: '2026-01-01T00:00:00.000Z' as UtcInstant,
    legalStatus: LEGAL_REVIEW_STATUS,
  }),
  Object.freeze({
    constraintId: 'residency.gb.uk_south.v1',
    mode: 'ALLOWED_REGIONS',
    jurisdictions: Object.freeze(['GB']),
    allowedRegions: Object.freeze(['UK_SOUTH', 'EU_WEST']),
    prohibitedRegions: Object.freeze(['US_EAST', 'US_WEST']),
    crossBorderRestricted: true,
    processingOnlyNoPersist: false,
    effectiveFrom: '2026-01-01T00:00:00.000Z' as UtcInstant,
    legalStatus: LEGAL_REVIEW_STATUS,
  }),
  Object.freeze({
    constraintId: 'residency.sa.me_central.v1',
    mode: 'ALLOWED_REGIONS',
    jurisdictions: Object.freeze(['SA', 'AE']),
    allowedRegions: Object.freeze(['ME_CENTRAL']),
    prohibitedRegions: Object.freeze(['US_EAST', 'US_WEST', 'EU_WEST']),
    crossBorderRestricted: true,
    processingOnlyNoPersist: false,
    effectiveFrom: '2026-01-01T00:00:00.000Z' as UtcInstant,
    legalStatus: LEGAL_REVIEW_STATUS,
  }),
  Object.freeze({
    constraintId: 'residency.us.domestic.v1',
    mode: 'ALLOWED_REGIONS',
    jurisdictions: Object.freeze(['US']),
    allowedRegions: Object.freeze(['US_EAST', 'US_WEST']),
    prohibitedRegions: Object.freeze([]),
    crossBorderRestricted: false,
    processingOnlyNoPersist: false,
    effectiveFrom: '2026-01-01T00:00:00.000Z' as UtcInstant,
    legalStatus: LEGAL_REVIEW_STATUS,
  }),
  Object.freeze({
    constraintId: 'residency.processing_only.v1',
    mode: 'PROCESSING_ONLY_NO_PERSIST',
    jurisdictions: Object.freeze(['XA']),
    allowedRegions: Object.freeze(['PROCESSING_ONLY']),
    prohibitedRegions: Object.freeze([]),
    crossBorderRestricted: true,
    processingOnlyNoPersist: true,
    effectiveFrom: '2026-01-01T00:00:00.000Z' as UtcInstant,
    legalStatus: LEGAL_REVIEW_STATUS,
  }),
]) as readonly DataResidencyConstraint[];

export type ResidencyEvaluationInput = {
  readonly jurisdiction: string;
  readonly storageRegion: StorageRegion;
  readonly persist: boolean;
  readonly at: UtcInstant;
};

export type ResidencyEvaluationResult = {
  readonly allowed: boolean;
  readonly reasonCode: string;
  readonly reason: string;
  readonly constraintId: string | null;
  readonly processingOnly: boolean;
};

export class DataResidencyRegistry {
  private readonly constraints: readonly DataResidencyConstraint[];

  constructor(seed: readonly DataResidencyConstraint[] = DEFAULT_RESIDENCY_CONSTRAINTS) {
    this.constraints = Object.freeze([...seed]);
  }

  list(): readonly DataResidencyConstraint[] {
    return this.constraints;
  }

  evaluate(input: ResidencyEvaluationInput): ResidencyEvaluationResult {
    const applicable = this.constraints.filter(
      (constraint) =>
        constraint.effectiveFrom <= input.at &&
        constraint.jurisdictions.includes(input.jurisdiction),
    );

    if (applicable.length === 0) {
      return Object.freeze({
        allowed: true,
        reasonCode: 'RESIDENCY_NO_CONSTRAINT',
        reason: 'no residency constraint configured for jurisdiction',
        constraintId: null,
        processingOnly: false,
      });
    }

    for (const constraint of applicable) {
      if (constraint.processingOnlyNoPersist && input.persist) {
        return Object.freeze({
          allowed: false,
          reasonCode: 'RESIDENCY_PROCESSING_ONLY',
          reason: 'jurisdiction requires processing-only — persistence prohibited',
          constraintId: constraint.constraintId,
          processingOnly: true,
        });
      }

      if (constraint.prohibitedRegions.includes(input.storageRegion)) {
        return Object.freeze({
          allowed: false,
          reasonCode: 'RESIDENCY_REGION_PROHIBITED',
          reason: `storage region ${input.storageRegion} prohibited for jurisdiction ${input.jurisdiction}`,
          constraintId: constraint.constraintId,
          processingOnly: false,
        });
      }

      if (
        constraint.mode === 'ALLOWED_REGIONS' &&
        constraint.allowedRegions.length > 0 &&
        !constraint.allowedRegions.includes(input.storageRegion) &&
        input.storageRegion !== 'PROCESSING_ONLY'
      ) {
        return Object.freeze({
          allowed: false,
          reasonCode: 'RESIDENCY_REGION_NOT_ALLOWED',
          reason: `storage region ${input.storageRegion} not in allowed regions for jurisdiction ${input.jurisdiction}`,
          constraintId: constraint.constraintId,
          processingOnly: false,
        });
      }
    }

    const processingOnly = applicable.some((constraint) => constraint.processingOnlyNoPersist);
    return Object.freeze({
      allowed: true,
      reasonCode: 'RESIDENCY_ALLOWED',
      reason: 'storage region satisfies residency constraints',
      constraintId: applicable[0]?.constraintId ?? null,
      processingOnly,
    });
  }
}
