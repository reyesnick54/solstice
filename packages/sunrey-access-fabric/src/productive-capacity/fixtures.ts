/**
 * Deterministic simulation fixtures for ACCESS-03.
 *
 * All identifiers use SIMULATION prefixes. These fixtures cannot enable
 * production and are unmistakably simulation data.
 */

import type { CapacitySlice } from './types.ts';
import { assessFreshness } from './query.ts';
import {
  SIMULATION_FIXTURE_PREFIX,
  SIMULATION_OPERATOR_PREFIX,
  SIMULATION_PROVENANCE_PREFIX,
} from './taxonomy.ts';

export const SIMULATION_NOW_UNIX_SECONDS = 1_756_468_800n; // 2026-08-29T12:00:00Z

const DAY = 86_400n;
const HOUR = 3_600n;

function simSlice(input: Omit<CapacitySlice, 'freshness'> & {
  readonly observedAtUnixSeconds: bigint;
  readonly validUntilUnixSeconds: bigint;
}): CapacitySlice {
  return Object.freeze({
    ...input,
    freshness: assessFreshness(input.observedAtUnixSeconds, input.validUntilUnixSeconds, SIMULATION_NOW_UNIX_SECONDS),
  });
}

/** Miami passenger vehicle — Ford Mustang simulation fleet. */
export const FORD_MUSTANG_MIAMI_SLICE = simSlice({
  sliceId: `${SIMULATION_FIXTURE_PREFIX}ford_mustang_miami_wk36`,
  productiveObjectRef: `${SIMULATION_FIXTURE_PREFIX}obj_ford_mustang_miami`,
  economicCategory: 'LOGISTICS_TRANSPORTATION',
  capacityAmount: 12n,
  canonicalUnit: 'service_hour',
  availabilityStartUnixSeconds: SIMULATION_NOW_UNIX_SECONDS + DAY,
  availabilityEndUnixSeconds: SIMULATION_NOW_UNIX_SECONDS + 8n * DAY,
  geography: { geographyId: 'geo_sim_us_fl_miami', jurisdiction: 'US-FL' },
  serviceLocation: 'Miami, FL, US',
  serviceQualityClass: 'PASSENGER_VEHICLE',
  utilization: {
    utilizedAmount: 3n,
    basisAmount: 12n,
    ratioScaled: 250_000n,
    independentlyEvidenced: true,
  },
  availabilityAmount: 9n,
  providerOperatorRef: `${SIMULATION_OPERATOR_PREFIX}ford_rental_sim`,
  rightsRestrictions: Object.freeze([
    { restrictionId: 'sim_rights_us_fl_rental', description: 'Simulation rental corridor only', jurisdiction: 'US-FL' },
  ]),
  provenance: Object.freeze({
    provenanceId: `${SIMULATION_PROVENANCE_PREFIX}ford_mustang_miami_claim`,
    sourceClass: 'SIMULATION_FIXTURE',
    claimId: 'sim_productive_claim_ford_mustang_miami',
    objectId: `${SIMULATION_FIXTURE_PREFIX}obj_ford_mustang_miami`,
    evidenceVaultRef: 'sim_evidence_vault_access_ford_mustang',
  }),
  observedAtUnixSeconds: SIMULATION_NOW_UNIX_SECONDS - HOUR,
  validUntilUnixSeconds: SIMULATION_NOW_UNIX_SECONDS + 7n * DAY,
  verificationStatus: 'VERIFIED',
});

/** Tokyo hotel room-night capacity — October window. */
export const HOTEL_TOKYO_OCTOBER_SLICE = simSlice({
  sliceId: `${SIMULATION_FIXTURE_PREFIX}hotel_tokyo_oct_2026`,
  productiveObjectRef: `${SIMULATION_FIXTURE_PREFIX}obj_hotel_tokyo_shinjuku`,
  economicCategory: 'REAL_ESTATE_USE',
  capacityAmount: 450n,
  canonicalUnit: 'm2_hour',
  availabilityStartUnixSeconds: 1_759_392_000n, // 2026-10-01
  availabilityEndUnixSeconds: 1_761_984_000n, // 2026-10-31
  geography: { geographyId: 'geo_sim_jp_tokyo', jurisdiction: 'JP-13' },
  serviceLocation: 'Shinjuku, Tokyo, JP',
  serviceQualityClass: 'HOTEL_ROOM_NIGHT',
  utilization: {
    utilizedAmount: 120n,
    basisAmount: 450n,
    ratioScaled: 266_666n,
    independentlyEvidenced: true,
  },
  availabilityAmount: 330n,
  providerOperatorRef: `${SIMULATION_OPERATOR_PREFIX}hotel_tokyo_sim`,
  rightsRestrictions: Object.freeze([
    { restrictionId: 'sim_rights_jp_hospitality', description: 'Simulation hospitality license', jurisdiction: 'JP' },
  ]),
  provenance: Object.freeze({
    provenanceId: `${SIMULATION_PROVENANCE_PREFIX}hotel_tokyo_claim`,
    sourceClass: 'SIMULATION_FIXTURE',
    claimId: 'sim_productive_claim_hotel_tokyo',
    objectId: `${SIMULATION_FIXTURE_PREFIX}obj_hotel_tokyo_shinjuku`,
    oracleFactId: 'sim_oracle_fact_hotel_tokyo_capacity',
    evidenceVaultRef: 'sim_evidence_vault_access_hotel_tokyo',
  }),
  observedAtUnixSeconds: SIMULATION_NOW_UNIX_SECONDS - 2n * HOUR,
  validUntilUnixSeconds: 1_762_070_400n,
  verificationStatus: 'VERIFIED',
});

/** Airline / transport seat capacity — Miami to NYC corridor. */
export const AIRLINE_TRANSPORT_SLICE = simSlice({
  sliceId: `${SIMULATION_FIXTURE_PREFIX}airline_mia_nyc_wk36`,
  productiveObjectRef: `${SIMULATION_FIXTURE_PREFIX}obj_airline_mia_nyc`,
  economicCategory: 'LOGISTICS_TRANSPORTATION',
  capacityAmount: 180n,
  canonicalUnit: 'service_hour',
  availabilityStartUnixSeconds: SIMULATION_NOW_UNIX_SECONDS + DAY,
  availabilityEndUnixSeconds: SIMULATION_NOW_UNIX_SECONDS + 14n * DAY,
  geography: { geographyId: 'geo_sim_us_mia_nyc', jurisdiction: 'US' },
  serviceLocation: 'MIA-NYC corridor, US',
  serviceQualityClass: 'AIRLINE_SEAT',
  utilization: {
    utilizedAmount: 45n,
    basisAmount: 180n,
    ratioScaled: 250_000n,
    independentlyEvidenced: true,
  },
  availabilityAmount: 135n,
  providerOperatorRef: `${SIMULATION_OPERATOR_PREFIX}airline_sim`,
  rightsRestrictions: Object.freeze([
    { restrictionId: 'sim_rights_us_dot_air', description: 'Simulation DOT air corridor', jurisdiction: 'US' },
  ]),
  provenance: Object.freeze({
    provenanceId: `${SIMULATION_PROVENANCE_PREFIX}airline_mia_nyc_claim`,
    sourceClass: 'SIMULATION_FIXTURE',
    claimId: 'sim_productive_claim_airline_mia_nyc',
    objectId: `${SIMULATION_FIXTURE_PREFIX}obj_airline_mia_nyc`,
    oracleFactId: 'sim_oracle_fact_airline_capacity',
    evidenceVaultRef: 'sim_evidence_vault_access_airline',
  }),
  observedAtUnixSeconds: SIMULATION_NOW_UNIX_SECONDS - HOUR,
  validUntilUnixSeconds: SIMULATION_NOW_UNIX_SECONDS + 14n * DAY,
  verificationStatus: 'VERIFIED',
});

/** Food production and delivery capacity — South Florida region. */
export const FOOD_CAPACITY_SLICE = simSlice({
  sliceId: `${SIMULATION_FIXTURE_PREFIX}food_south_florida`,
  productiveObjectRef: `${SIMULATION_FIXTURE_PREFIX}obj_food_kitchen_sfl`,
  economicCategory: 'FOOD_AGRICULTURE',
  capacityAmount: 5_000n,
  canonicalUnit: 'kg',
  availabilityStartUnixSeconds: SIMULATION_NOW_UNIX_SECONDS,
  availabilityEndUnixSeconds: SIMULATION_NOW_UNIX_SECONDS + 30n * DAY,
  geography: { geographyId: 'geo_sim_us_fl_south', jurisdiction: 'US-FL' },
  serviceLocation: 'South Florida region, US',
  serviceQualityClass: 'FOOD_DELIVERY',
  utilization: {
    utilizedAmount: 1_200n,
    basisAmount: 5_000n,
    ratioScaled: 240_000n,
    independentlyEvidenced: true,
  },
  availabilityAmount: 3_800n,
  providerOperatorRef: `${SIMULATION_OPERATOR_PREFIX}food_delivery_sim`,
  rightsRestrictions: Object.freeze([
    { restrictionId: 'sim_rights_us_fda_food', description: 'Simulation food handling license', jurisdiction: 'US-FL' },
  ]),
  provenance: Object.freeze({
    provenanceId: `${SIMULATION_PROVENANCE_PREFIX}food_sfl_claim`,
    sourceClass: 'SIMULATION_FIXTURE',
    claimId: 'sim_productive_claim_food_sfl',
    objectId: `${SIMULATION_FIXTURE_PREFIX}obj_food_kitchen_sfl`,
    oracleFactId: 'sim_oracle_fact_food_production',
    evidenceVaultRef: 'sim_evidence_vault_access_food',
  }),
  observedAtUnixSeconds: SIMULATION_NOW_UNIX_SECONDS - 30n * 60n,
  validUntilUnixSeconds: SIMULATION_NOW_UNIX_SECONDS + 30n * DAY,
  verificationStatus: 'VERIFIED',
});

/** GPU-hour compute capacity — lab-east simulation cluster. */
export const GPU_COMPUTE_SLICE = simSlice({
  sliceId: `${SIMULATION_FIXTURE_PREFIX}gpu_a100_lab_east`,
  productiveObjectRef: `${SIMULATION_FIXTURE_PREFIX}obj_gpu_cluster_lab_east`,
  economicCategory: 'COMPUTE',
  capacityAmount: 10_000n,
  canonicalUnit: 'gpu_s',
  availabilityStartUnixSeconds: SIMULATION_NOW_UNIX_SECONDS,
  availabilityEndUnixSeconds: SIMULATION_NOW_UNIX_SECONDS + 7n * DAY,
  geography: { geographyId: 'geo_sim_lab_east', jurisdiction: 'SIM' },
  serviceLocation: 'lab-east simulation datacenter',
  serviceQualityClass: 'GPU_A100',
  utilization: {
    utilizedAmount: 6_500n,
    basisAmount: 10_000n,
    ratioScaled: 650_000n,
    independentlyEvidenced: true,
  },
  availabilityAmount: 3_500n,
  providerOperatorRef: `${SIMULATION_OPERATOR_PREFIX}compute_sim`,
  rightsRestrictions: Object.freeze([
    { restrictionId: 'sim_rights_compute_sandbox', description: 'Simulation compute sandbox only', jurisdiction: 'SIM' },
  ]),
  provenance: Object.freeze({
    provenanceId: `${SIMULATION_PROVENANCE_PREFIX}gpu_lab_east_claim`,
    sourceClass: 'SIMULATION_FIXTURE',
    claimId: 'sim_productive_claim_gpu_lab_east',
    objectId: `${SIMULATION_FIXTURE_PREFIX}obj_gpu_cluster_lab_east`,
    oracleFactId: 'sim_oracle_fact_compute_capacity',
    evidenceVaultRef: 'sim_evidence_vault_access_gpu',
  }),
  observedAtUnixSeconds: SIMULATION_NOW_UNIX_SECONDS - 15n * 60n,
  validUntilUnixSeconds: SIMULATION_NOW_UNIX_SECONDS + 7n * DAY,
  verificationStatus: 'VERIFIED',
});

/** Robot-hour manufacturing capacity. */
export const ROBOT_HOUR_SLICE = simSlice({
  sliceId: `${SIMULATION_FIXTURE_PREFIX}robot_industrial_lab_central`,
  productiveObjectRef: `${SIMULATION_FIXTURE_PREFIX}obj_robot_line_lab_central`,
  economicCategory: 'MANUFACTURING',
  capacityAmount: 2_400n,
  canonicalUnit: 'machine_h',
  availabilityStartUnixSeconds: SIMULATION_NOW_UNIX_SECONDS,
  availabilityEndUnixSeconds: SIMULATION_NOW_UNIX_SECONDS + 14n * DAY,
  geography: { geographyId: 'geo_sim_lab_central', jurisdiction: 'SIM' },
  serviceLocation: 'lab-central simulation factory',
  serviceQualityClass: 'ROBOT_INDUSTRIAL',
  utilization: {
    utilizedAmount: 800n,
    basisAmount: 2_400n,
    ratioScaled: 333_333n,
    independentlyEvidenced: true,
  },
  availabilityAmount: 1_600n,
  providerOperatorRef: `${SIMULATION_OPERATOR_PREFIX}manufacturing_sim`,
  rightsRestrictions: Object.freeze([
    { restrictionId: 'sim_rights_robot_sandbox', description: 'Simulation robotics sandbox only', jurisdiction: 'SIM' },
  ]),
  provenance: Object.freeze({
    provenanceId: `${SIMULATION_PROVENANCE_PREFIX}robot_lab_central_claim`,
    sourceClass: 'SIMULATION_FIXTURE',
    claimId: 'sim_productive_claim_robot_lab_central',
    objectId: `${SIMULATION_FIXTURE_PREFIX}obj_robot_line_lab_central`,
    oracleFactId: 'sim_oracle_fact_manufacturing_capacity',
    evidenceVaultRef: 'sim_evidence_vault_access_robot',
  }),
  observedAtUnixSeconds: SIMULATION_NOW_UNIX_SECONDS - HOUR,
  validUntilUnixSeconds: SIMULATION_NOW_UNIX_SECONDS + 14n * DAY,
  verificationStatus: 'VERIFIED',
});

/** Energy grid capacity — simulation only. */
export const ENERGY_CAPACITY_SLICE = simSlice({
  sliceId: `${SIMULATION_FIXTURE_PREFIX}energy_grid_lab_west`,
  productiveObjectRef: `${SIMULATION_FIXTURE_PREFIX}obj_energy_grid_lab_west`,
  economicCategory: 'ENERGY',
  capacityAmount: 500_000n,
  canonicalUnit: 'kWh',
  availabilityStartUnixSeconds: SIMULATION_NOW_UNIX_SECONDS,
  availabilityEndUnixSeconds: SIMULATION_NOW_UNIX_SECONDS + 30n * DAY,
  geography: { geographyId: 'geo_sim_lab_west', jurisdiction: 'SIM' },
  serviceLocation: 'lab-west simulation grid',
  serviceQualityClass: 'ENERGY_GRID',
  utilization: {
    utilizedAmount: 320_000n,
    basisAmount: 500_000n,
    ratioScaled: 640_000n,
    independentlyEvidenced: true,
  },
  availabilityAmount: 180_000n,
  providerOperatorRef: `${SIMULATION_OPERATOR_PREFIX}energy_sim`,
  rightsRestrictions: Object.freeze([
    { restrictionId: 'sim_rights_energy_sandbox', description: 'Simulation energy sandbox only', jurisdiction: 'SIM' },
  ]),
  provenance: Object.freeze({
    provenanceId: `${SIMULATION_PROVENANCE_PREFIX}energy_lab_west_claim`,
    sourceClass: 'SIMULATION_FIXTURE',
    claimId: 'sim_productive_claim_energy_lab_west',
    objectId: `${SIMULATION_FIXTURE_PREFIX}obj_energy_grid_lab_west`,
    oracleFactId: 'sim_oracle_fact_energy_capacity',
    evidenceVaultRef: 'sim_evidence_vault_access_energy',
  }),
  observedAtUnixSeconds: SIMULATION_NOW_UNIX_SECONDS - 2n * HOUR,
  validUntilUnixSeconds: SIMULATION_NOW_UNIX_SECONDS + 30n * DAY,
  verificationStatus: 'VERIFIED',
});

/** Exhausted capacity — zero availability for exhaustion tests. */
export const EXHAUSTED_VEHICLE_SLICE = simSlice({
  sliceId: `${SIMULATION_FIXTURE_PREFIX}ford_mustang_miami_exhausted`,
  productiveObjectRef: `${SIMULATION_FIXTURE_PREFIX}obj_ford_mustang_miami_exhausted`,
  economicCategory: 'LOGISTICS_TRANSPORTATION',
  capacityAmount: 5n,
  canonicalUnit: 'service_hour',
  availabilityStartUnixSeconds: SIMULATION_NOW_UNIX_SECONDS + DAY,
  availabilityEndUnixSeconds: SIMULATION_NOW_UNIX_SECONDS + 8n * DAY,
  geography: { geographyId: 'geo_sim_us_fl_miami', jurisdiction: 'US-FL' },
  serviceLocation: 'Miami, FL, US',
  serviceQualityClass: 'PASSENGER_VEHICLE',
  utilization: {
    utilizedAmount: 5n,
    basisAmount: 5n,
    ratioScaled: 1_000_000n,
    independentlyEvidenced: true,
  },
  availabilityAmount: 0n,
  providerOperatorRef: `${SIMULATION_OPERATOR_PREFIX}ford_rental_sim`,
  rightsRestrictions: Object.freeze([]),
  provenance: Object.freeze({
    provenanceId: `${SIMULATION_PROVENANCE_PREFIX}ford_mustang_miami_exhausted_claim`,
    sourceClass: 'SIMULATION_FIXTURE',
    claimId: 'sim_productive_claim_ford_mustang_exhausted',
    objectId: `${SIMULATION_FIXTURE_PREFIX}obj_ford_mustang_miami_exhausted`,
    evidenceVaultRef: 'sim_evidence_vault_access_ford_exhausted',
  }),
  observedAtUnixSeconds: SIMULATION_NOW_UNIX_SECONDS - HOUR,
  validUntilUnixSeconds: SIMULATION_NOW_UNIX_SECONDS + 7n * DAY,
  verificationStatus: 'VERIFIED',
});

/** Stale evidence slice — observed too long ago. */
export const STALE_GPU_SLICE: CapacitySlice = Object.freeze({
  ...GPU_COMPUTE_SLICE,
  sliceId: `${SIMULATION_FIXTURE_PREFIX}gpu_stale_evidence`,
  productiveObjectRef: `${SIMULATION_FIXTURE_PREFIX}obj_gpu_stale`,
  freshness: assessFreshness(
    SIMULATION_NOW_UNIX_SECONDS - 200_000n,
    SIMULATION_NOW_UNIX_SECONDS - 100_000n,
    SIMULATION_NOW_UNIX_SECONDS,
  ),
  verificationStatus: 'STALE',
});

/** Marketing data without provenance — must be rejected. */
export const MARKETING_UNPROVENANCED_SLICE: CapacitySlice = Object.freeze({
  ...FORD_MUSTANG_MIAMI_SLICE,
  sliceId: `${SIMULATION_FIXTURE_PREFIX}marketing_unprovenanced_vehicle`,
  productiveObjectRef: `${SIMULATION_FIXTURE_PREFIX}obj_marketing_vehicle`,
  provenance: Object.freeze({
    provenanceId: 'marketing_brochure_only',
    sourceClass: 'SIMULATION_FIXTURE',
  }),
  verificationStatus: 'MARKETING_UNPROVENANCED',
});

/** Invalid zero capacity — rejected at query time. */
export const ZERO_CAPACITY_SLICE: CapacitySlice = Object.freeze({
  ...GPU_COMPUTE_SLICE,
  sliceId: `${SIMULATION_FIXTURE_PREFIX}zero_capacity_invalid`,
  productiveObjectRef: `${SIMULATION_FIXTURE_PREFIX}obj_zero_capacity`,
  capacityAmount: 0n,
  availabilityAmount: 0n,
});

export const SIMULATION_CAPACITY_FIXTURES: readonly CapacitySlice[] = Object.freeze([
  FORD_MUSTANG_MIAMI_SLICE,
  HOTEL_TOKYO_OCTOBER_SLICE,
  AIRLINE_TRANSPORT_SLICE,
  FOOD_CAPACITY_SLICE,
  GPU_COMPUTE_SLICE,
  ROBOT_HOUR_SLICE,
  ENERGY_CAPACITY_SLICE,
  EXHAUSTED_VEHICLE_SLICE,
  STALE_GPU_SLICE,
  MARKETING_UNPROVENANCED_SLICE,
  ZERO_CAPACITY_SLICE,
]);

export function simulationCapacityFixtures(): readonly CapacitySlice[] {
  return SIMULATION_CAPACITY_FIXTURES;
}
