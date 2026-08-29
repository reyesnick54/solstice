/**
 * Simulation fixtures for vehicle, hotel, compute, energy, and food domains.
 */

import type { OpenAccessSessionInput } from './engine.ts';

const BASE = {
  reservedFromUtc: '2026-08-29T08:00:00.000Z',
  reservedUntilUtc: '2026-08-29T20:00:00.000Z',
  policyRef: 'access.policy.simulation.v1',
  purpose: 'service_consumption',
} as const;

export function vehicleRentalSession(sessionId = 'vehicle_sess_1'): OpenAccessSessionInput {
  return {
    reservation: {
      reservationId: `res_${sessionId}`,
      sessionId,
      subjectRef: 'subject.traveler_1',
      providerRef: 'provider.fleet_alpha',
      serviceDomain: 'VEHICLE_RENTAL',
      reservedQuantity: 500n,
      unit: 'km',
      ...BASE,
    },
    grant: {
      grantId: `grant_${sessionId}`,
      reservationId: `res_${sessionId}`,
      sessionId,
      grantedAtUtc: '2026-08-29T07:55:00.000Z',
      policyRef: BASE.policyRef,
      purpose: BASE.purpose,
      considerationRef: 'payment.auth.vehicle_1',
      considerationMinorUnits: 25_000n,
      considerationCurrency: 'SAR',
    },
  };
}

export function hotelSession(sessionId = 'hotel_sess_1'): OpenAccessSessionInput {
  return {
    reservation: {
      reservationId: `res_${sessionId}`,
      sessionId,
      subjectRef: 'subject.guest_1',
      providerRef: 'provider.hotel_beta',
      serviceDomain: 'HOSPITALITY',
      reservedQuantity: 2n,
      unit: 'room_night',
      ...BASE,
    },
    grant: {
      grantId: `grant_${sessionId}`,
      reservationId: `res_${sessionId}`,
      sessionId,
      grantedAtUtc: '2026-08-29T14:00:00.000Z',
      policyRef: BASE.policyRef,
      purpose: BASE.purpose,
      considerationRef: 'payment.auth.hotel_1',
      considerationMinorUnits: 8_000n,
      considerationCurrency: 'SAR',
    },
  };
}

export function computeSession(sessionId = 'compute_sess_1'): OpenAccessSessionInput {
  return {
    reservation: {
      reservationId: `res_${sessionId}`,
      sessionId,
      subjectRef: 'subject.dev_1',
      providerRef: 'provider.gpu_cloud',
      serviceDomain: 'COMPUTE',
      reservedQuantity: 10n,
      unit: 'gpu_hour',
      ...BASE,
    },
    grant: {
      grantId: `grant_${sessionId}`,
      reservationId: `res_${sessionId}`,
      sessionId,
      grantedAtUtc: '2026-08-29T09:00:00.000Z',
      policyRef: BASE.policyRef,
      purpose: BASE.purpose,
      considerationRef: 'payment.auth.compute_1',
      considerationMinorUnits: 50_000n,
      considerationCurrency: 'SAR',
    },
  };
}

export function energySession(sessionId = 'energy_sess_1'): OpenAccessSessionInput {
  return {
    reservation: {
      reservationId: `res_${sessionId}`,
      sessionId,
      subjectRef: 'subject.site_1',
      providerRef: 'provider.grid_gamma',
      serviceDomain: 'ENERGY',
      reservedQuantity: 1_000n,
      unit: 'kwh',
      ...BASE,
    },
    grant: {
      grantId: `grant_${sessionId}`,
      reservationId: `res_${sessionId}`,
      sessionId,
      grantedAtUtc: '2026-08-29T06:00:00.000Z',
      policyRef: BASE.policyRef,
      purpose: BASE.purpose,
      considerationRef: 'payment.auth.energy_1',
      considerationMinorUnits: 12_000n,
      considerationCurrency: 'SAR',
    },
  };
}

export function foodDeliverySession(sessionId = 'food_sess_1'): OpenAccessSessionInput {
  return {
    reservation: {
      reservationId: `res_${sessionId}`,
      sessionId,
      subjectRef: 'subject.customer_1',
      providerRef: 'provider.kitchen_delta',
      serviceDomain: 'FOOD_DELIVERY',
      reservedQuantity: 1n,
      unit: 'fulfilment',
      ...BASE,
    },
    grant: {
      grantId: `grant_${sessionId}`,
      reservationId: `res_${sessionId}`,
      sessionId,
      grantedAtUtc: '2026-08-29T12:30:00.000Z',
      policyRef: BASE.policyRef,
      purpose: BASE.purpose,
      considerationRef: 'payment.auth.food_1',
      considerationMinorUnits: 4_500n,
      considerationCurrency: 'SAR',
    },
  };
}

export const ORACLE_GPU_FACT = Object.freeze({
  factId: 'oracle_fact_gpu_1',
  sessionId: 'compute_sess_1',
  quantity: 8n,
  unit: 'gpu_hour',
  source: 'ORACLE_NETWORK' as const,
  finalized: true,
  conflicted: false,
  oracleRefs: Object.freeze(['oracle.compute.meter_1']),
});

export const CONFLICTING_ORACLE_FACT = Object.freeze({
  factId: 'oracle_fact_conflict_1',
  sessionId: 'compute_sess_1',
  quantity: 4n,
  unit: 'gpu_hour',
  source: 'ORACLE_NETWORK' as const,
  finalized: true,
  conflicted: true,
  oracleRefs: Object.freeze(['oracle.compute.meter_2']),
});

export const SELF_REPORT_GPU_FACT = Object.freeze({
  factId: 'self_fact_gpu_1',
  sessionId: 'compute_sess_1',
  quantity: 10n,
  unit: 'gpu_hour',
  source: 'PROVIDER_SELF_REPORT' as const,
  finalized: true,
  conflicted: false,
  oracleRefs: Object.freeze([]),
});
