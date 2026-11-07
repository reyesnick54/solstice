/**
 * Adversarial procurement timeline — JV attribution, modifications, obligations, cancellations.
 */

import { asUtcInstant } from '@solstice/domain';

import {
  attributionEntityForAward,
  resolveProcurementCounterparty,
} from '../entity-resolution.ts';
import type {
  IngestProcurementObservationInput,
  ProcurementAttributionBinding,
  ProcurementExternalObservation,
} from '../types.ts';
import { sealProcurementObservation } from '../ingest.ts';

export const ADVERSARIAL_PARENT_ENTITY = 'govctr:parent_orbital_dynamics_llc';
export const ADVERSARIAL_SUBSIDIARY_ENTITY = 'govctr:orbital_dynamics_federal_inc';
export const ADVERSARIAL_JV_ENTITY = 'govctr:orbital_atlas_joint_venture';
export const ADVERSARIAL_CONTRACTOR_ENTITY = 'govctr:north_river_systems_inc';

export const ADVERSARIAL_PIID = 'FA8801-24-C-7001';
export const ADVERSARIAL_JV_PIID = 'FA8801-24-C-7100';

const parentBinding = resolveProcurementCounterparty({
  sourceLegalName: 'Orbital Dynamics LLC',
  role: 'parent_company',
  uei: 'PARENTUEI001',
});

const subsidiaryBinding = resolveProcurementCounterparty({
  sourceLegalName: 'Orbital Dynamics Federal Inc',
  role: 'subsidiary',
  uei: 'SUBUEI002',
  parentSourceLegalName: 'Orbital Dynamics LLC',
});

const jvBinding = resolveProcurementCounterparty({
  sourceLegalName: 'Orbital Atlas Joint Venture',
  role: 'joint_venture',
  uei: 'JVUEI003',
  parentSourceLegalName: 'Orbital Dynamics LLC',
  jointVenturePartnerNames: ['North River Systems Inc'],
});

const contractorBinding = resolveProcurementCounterparty({
  sourceLegalName: 'North River Systems Inc',
  role: 'contractor',
  uei: 'CTRUEI004',
});

function attributionFor(binding: typeof parentBinding): ProcurementAttributionBinding {
  return Object.freeze({
    attributionEntityId: attributionEntityForAward(binding),
    counterpartyBinding: binding,
    rollsUpToParent: false,
  });
}

function provenance(input: {
  readonly dedupeKey: string;
  readonly knowableAt: string;
  readonly sourceId: string;
}): IngestProcurementObservationInput['provenance'] {
  return Object.freeze({
    providerId: 'sim-federal-procurement',
    providerKind: 'simulation_fixture',
    sourceId: input.sourceId,
    feedId: 'us-federal-awards-fixture',
    evidenceRef: `evidence:${input.sourceId}`,
    rawPayloadHash: `sha256:${input.dedupeKey}`,
    dedupeKey: input.dedupeKey,
    providerAvailabilityTime: asUtcInstant(input.knowableAt),
    sunreyArrivalTime: asUtcInstant(input.knowableAt),
    knowableAt: asUtcInstant(input.knowableAt),
  });
}

export const GOVT_CUSTOMER_SDA: IngestProcurementObservationInput = {
  observationId: 'proc:customer:sda',
  artifactKind: 'GOVERNMENT_CUSTOMER',
  provenance: provenance({
    dedupeKey: 'customer-sda',
    knowableAt: '2024-01-01T00:00:00.000Z',
    sourceId: 'customer-sda',
  }),
  attributionEntityId: 'gov:customer:sda',
  award: null,
  modification: null,
  obligation: null,
  contractVehicle: null,
  governmentCustomer: Object.freeze({
    customerId: 'gov:customer:sda',
    agencyCode: 'SDA',
    agencyName: 'Space Development Agency',
    program: 'Tranche 1 Transport',
    countryCode: 'US',
  }),
  backlogEstimate: null,
  supersedesObservationId: null,
  lineageRootId: 'lineage:sda-tranche1',
};

export const CONTRACT_VEHICLE_IDIQ: IngestProcurementObservationInput = {
  observationId: 'proc:vehicle:idiq-8801',
  artifactKind: 'CONTRACT_VEHICLE',
  provenance: provenance({
    dedupeKey: 'vehicle-idiq-8801',
    knowableAt: '2024-01-01T00:00:00.000Z',
    sourceId: 'vehicle-idiq',
  }),
  attributionEntityId: 'gov:vehicle:idiq-8801',
  award: null,
  modification: null,
  obligation: null,
  contractVehicle: Object.freeze({
    vehicleId: 'gov:vehicle:idiq-8801',
    vehicleLabel: 'FA8801 IDIQ Space Transport',
    contractType: 'IDIQ',
    parentVehicleId: null,
    governmentCustomerId: 'gov:customer:sda',
  }),
  governmentCustomer: null,
  backlogEstimate: null,
  supersedesObservationId: null,
  lineageRootId: 'lineage:sda-tranche1',
};

export const AWARD_SUBSIDIARY_INITIAL: IngestProcurementObservationInput = {
  observationId: 'proc:award:sub:v1',
  artifactKind: 'PROCUREMENT_AWARD',
  provenance: provenance({
    dedupeKey: 'award-sub-initial',
    knowableAt: '2024-03-15T17:00:00.000Z',
    sourceId: 'award-sub-initial',
  }),
  attributionEntityId: subsidiaryBinding.canonicalEntityId,
  award: Object.freeze({
    awardId: 'award:sub:7001',
    contractPiid: ADVERSARIAL_PIID,
    title: 'SDA Tranche 1 Bus Integration',
    awardDate: '2024-03-15',
    periodOfPerformanceStart: '2024-04-01',
    periodOfPerformanceEnd: '2027-03-31',
    contractDurationDays: 1095,
    optionPeriods: Object.freeze(['2027-04-01/2028-03-31']),
    awardCeiling: Object.freeze({
      kind: 'AWARD_CEILING',
      currency: 'USD',
      amountMinor: 450_000_000_00n,
    }),
    governmentCustomerId: 'gov:customer:sda',
    agency: 'Space Development Agency',
    program: 'Tranche 1 Transport',
    contractType: 'CPFF',
    contractVehicleId: 'gov:vehicle:idiq-8801',
    attribution: attributionFor(subsidiaryBinding),
    cancelled: false,
  }),
  modification: null,
  obligation: null,
  contractVehicle: null,
  governmentCustomer: null,
  backlogEstimate: null,
  supersedesObservationId: null,
  lineageRootId: 'lineage:award-sub-7001',
};

export const MODIFICATION_SUBSIDIARY_FUNDING: IngestProcurementObservationInput = {
  observationId: 'proc:mod:sub:p0001',
  artifactKind: 'PROCUREMENT_MODIFICATION',
  provenance: provenance({
    dedupeKey: 'mod-sub-p0001',
    knowableAt: '2024-06-01T18:00:00.000Z',
    sourceId: 'mod-sub-p0001',
  }),
  attributionEntityId: subsidiaryBinding.canonicalEntityId,
  award: null,
  modification: Object.freeze({
    modificationId: 'mod:sub:p0001',
    awardId: 'award:sub:7001',
    modificationNumber: 'P00001',
    modificationKind: 'funding',
    effectiveDate: '2024-06-01',
    deltaCeilingMinor: 25_000_000_00n,
    deltaObligationMinor: 10_000_000_00n,
    cancellation: false,
    description: 'Incremental ceiling for payload integration',
  }),
  obligation: null,
  contractVehicle: null,
  governmentCustomer: null,
  backlogEstimate: null,
  supersedesObservationId: null,
  lineageRootId: 'lineage:award-sub-7001',
};

export const OBLIGATION_SUBSIDIARY_Q2: IngestProcurementObservationInput = {
  observationId: 'proc:obl:sub:2024q2',
  artifactKind: 'PROCUREMENT_OBLIGATION',
  provenance: provenance({
    dedupeKey: 'obl-sub-2024q2',
    knowableAt: '2024-07-10T12:00:00.000Z',
    sourceId: 'obl-sub-2024q2',
  }),
  attributionEntityId: subsidiaryBinding.canonicalEntityId,
  award: null,
  modification: null,
  obligation: Object.freeze({
    obligationId: 'obl:sub:2024q2',
    awardId: 'award:sub:7001',
    obligationDate: '2024-07-01',
    obligatedValue: Object.freeze({
      kind: 'OBLIGATION',
      currency: 'USD',
      amountMinor: 85_000_000_00n,
    }),
    paidValue: Object.freeze({
      kind: 'PAID',
      currency: 'USD',
      amountMinor: 12_000_000_00n,
    }),
  }),
  contractVehicle: null,
  governmentCustomer: null,
  backlogEstimate: null,
  supersedesObservationId: null,
  lineageRootId: 'lineage:award-sub-7001',
};

/** Joint venture award — must not attribute ceiling to parent company. */
export const AWARD_JV_INITIAL: IngestProcurementObservationInput = {
  observationId: 'proc:award:jv:v1',
  artifactKind: 'PROCUREMENT_AWARD',
  provenance: provenance({
    dedupeKey: 'award-jv-initial',
    knowableAt: '2024-05-01T16:00:00.000Z',
    sourceId: 'award-jv-initial',
  }),
  attributionEntityId: jvBinding.canonicalEntityId,
  award: Object.freeze({
    awardId: 'award:jv:7100',
    contractPiid: ADVERSARIAL_JV_PIID,
    title: 'SDA Ground Segment JV',
    awardDate: '2024-05-01',
    periodOfPerformanceStart: '2024-06-01',
    periodOfPerformanceEnd: '2026-05-31',
    contractDurationDays: 730,
    optionPeriods: Object.freeze([]),
    awardCeiling: Object.freeze({
      kind: 'AWARD_CEILING',
      currency: 'USD',
      amountMinor: 120_000_000_00n,
    }),
    governmentCustomerId: 'gov:customer:sda',
    agency: 'Space Development Agency',
    program: 'Tranche 1 Transport',
    contractType: 'FFP',
    contractVehicleId: 'gov:vehicle:idiq-8801',
    attribution: attributionFor(jvBinding),
    cancelled: false,
  }),
  modification: null,
  obligation: null,
  contractVehicle: null,
  governmentCustomer: null,
  backlogEstimate: null,
  supersedesObservationId: null,
  lineageRootId: 'lineage:award-jv-7100',
};

/** Future-dated award publication (must not leak before knowableAt). */
export const AWARD_FUTURE_LEAK: IngestProcurementObservationInput = {
  observationId: 'proc:award:future:leak',
  artifactKind: 'PROCUREMENT_AWARD',
  provenance: provenance({
    dedupeKey: 'award-future-leak',
    knowableAt: '2025-01-15T12:00:00.000Z',
    sourceId: 'award-future-leak',
  }),
  attributionEntityId: contractorBinding.canonicalEntityId,
  award: Object.freeze({
    awardId: 'award:future:9000',
    contractPiid: 'FA8801-25-C-9000',
    title: 'Future award (not yet public)',
    awardDate: '2025-01-10',
    periodOfPerformanceStart: '2025-02-01',
    periodOfPerformanceEnd: '2026-01-31',
    contractDurationDays: 365,
    optionPeriods: Object.freeze([]),
    awardCeiling: Object.freeze({
      kind: 'AWARD_CEILING',
      currency: 'USD',
      amountMinor: 50_000_000_00n,
    }),
    governmentCustomerId: 'gov:customer:sda',
    agency: 'Space Development Agency',
    program: 'Tranche 2',
    contractType: 'IDIQ',
    contractVehicleId: null,
    attribution: attributionFor(contractorBinding),
    cancelled: false,
  }),
  modification: null,
  obligation: null,
  contractVehicle: null,
  governmentCustomer: null,
  backlogEstimate: null,
  supersedesObservationId: null,
  lineageRootId: 'lineage:award-future-9000',
};

export const MODIFICATION_CANCELLATION: IngestProcurementObservationInput = {
  observationId: 'proc:mod:cancel:v1',
  artifactKind: 'PROCUREMENT_MODIFICATION',
  provenance: provenance({
    dedupeKey: 'mod-cancel-v1',
    knowableAt: '2024-09-01T14:00:00.000Z',
    sourceId: 'mod-cancel-v1',
  }),
  attributionEntityId: contractorBinding.canonicalEntityId,
  award: null,
  modification: Object.freeze({
    modificationId: 'mod:ctr:terminate',
    awardId: 'award:ctr:legacy',
    modificationNumber: 'P00099',
    modificationKind: 'termination',
    effectiveDate: '2024-09-01',
    deltaCeilingMinor: null,
    deltaObligationMinor: null,
    cancellation: true,
    description: 'Termination for convenience',
  }),
  obligation: null,
  contractVehicle: null,
  governmentCustomer: null,
  backlogEstimate: null,
  supersedesObservationId: null,
  lineageRootId: 'lineage:award-ctr-legacy',
};

export const BACKLOG_SUBSIDIARY_ESTIMATE: IngestProcurementObservationInput = {
  observationId: 'proc:backlog:sub:q3',
  artifactKind: 'PROCUREMENT_BACKLOG_ESTIMATE',
  provenance: provenance({
    dedupeKey: 'backlog-sub-q3',
    knowableAt: '2024-10-01T10:00:00.000Z',
    sourceId: 'backlog-sub-q3',
  }),
  attributionEntityId: subsidiaryBinding.canonicalEntityId,
  award: null,
  modification: null,
  obligation: null,
  contractVehicle: null,
  governmentCustomer: null,
  backlogEstimate: Object.freeze({
    backlogId: 'backlog:sub:2024q3',
    attributionEntityId: subsidiaryBinding.canonicalEntityId,
    asOfDate: '2024-09-30',
    remainingCeilingMinor: 390_000_000_00n,
    remainingObligationMinor: 300_000_000_00n,
    currency: 'USD',
  }),
  supersedesObservationId: null,
  lineageRootId: 'lineage:backlog-sub',
};

export const ADVERSARIAL_PROCUREMENT_TIMELINE: readonly ProcurementExternalObservation[] = Object.freeze(
  [
    GOVT_CUSTOMER_SDA,
    CONTRACT_VEHICLE_IDIQ,
    AWARD_SUBSIDIARY_INITIAL,
    MODIFICATION_SUBSIDIARY_FUNDING,
    OBLIGATION_SUBSIDIARY_Q2,
    AWARD_JV_INITIAL,
    AWARD_FUTURE_LEAK,
    MODIFICATION_CANCELLATION,
    BACKLOG_SUBSIDIARY_ESTIMATE,
  ].map((row) => sealProcurementObservation(row)),
);

export const DUPLICATE_AWARD_SUBSIDIARY: IngestProcurementObservationInput = {
  ...AWARD_SUBSIDIARY_INITIAL,
  observationId: 'proc:award:sub:dup',
  provenance: provenance({
    dedupeKey: 'award-sub-initial',
    knowableAt: '2024-03-15T17:00:00.000Z',
    sourceId: 'award-sub-dup-feed',
  }),
};

/** Map resolved ids for tests (stable with fixture bindings). */
export const ENTITY_IDS = Object.freeze({
  parent: parentBinding.canonicalEntityId,
  subsidiary: subsidiaryBinding.canonicalEntityId,
  jointVenture: jvBinding.canonicalEntityId,
  contractor: contractorBinding.canonicalEntityId,
});
