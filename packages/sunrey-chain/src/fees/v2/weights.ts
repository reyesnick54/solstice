import { commitCanonical } from '../../hash.ts';
import { RESOURCE_WEIGHT_DOMAIN, type ResourceWeightSchedule } from './types.ts';

/**
 * Development / rehearsal weight fixture.
 *
 * Production weights remain unconfigured until a governed approval.
 * These numbers are engineering fixtures, not copied production
 * constants from another chain.
 */
export function developmentResourceWeightSchedule(activationHeight = 0): ResourceWeightSchedule {
  return Object.freeze({
    version: 1,
    activationHeight,
    status: 'DEVELOPMENT_FIXTURE',
    weights: Object.freeze({
      TRANSACTION_BYTE_UNITS: 1n,
      SIGNATURE_VERIFY_CLASSICAL: 20n,
      SIGNATURE_VERIFY_HYBRID: 80n,
      SIGNATURE_VERIFY_PQ: 200n,
      STATE_READ_UNITS: 3n,
      STATE_WRITE_UNITS: 5n,
      CRYPTOGRAPHIC_PROOF_UNITS: 25n,
      ORACLE_VERIFY: 40n,
      EXCHANGE_DVP_LEG: 75n,
      INTEROP_PROOF: 150n,
      OTHER_GOVERNED_RESOURCE: 2n,
    }),
  });
}

export function productionUnconfiguredWeightSchedule(): ResourceWeightSchedule {
  return Object.freeze({
    ...developmentResourceWeightSchedule(),
    status: 'PRODUCTION_UNCONFIGURED',
  });
}

export function hashResourceWeightSchedule(schedule: ResourceWeightSchedule): string {
  return commitCanonical({
    domain: RESOURCE_WEIGHT_DOMAIN,
    version: schedule.version,
    activationHeight: schedule.activationHeight,
    status: schedule.status,
    weights: Object.fromEntries(
      Object.entries(schedule.weights).map(([key, value]) => [key, value.toString()]),
    ),
  });
}

export function validateResourceWeightSchedule(schedule: ResourceWeightSchedule): string | null {
  for (const [key, value] of Object.entries(schedule.weights)) {
    if (value < 0n) {
      return `weight ${key} must be unsigned`;
    }
  }
  return null;
}
