/**
 * Chunk 135 demo — real-estate use and infrastructure data fabric.
 *
 * Commercial space: 100 m2 used for 4 hours → exact 400 m2_hour.
 * Terminal facility: 2 governed facility units used for 3 hours → 6 facility-hours.
 * Capacity-only records stay separate.
 *
 * No real providers. No production activation. No MoonRey mint.
 */

import { ingestInfrastructureRecord } from './infrastructure/adapter.ts';
import { certifyInfrastructureSandbox, infrastructureCertificationCannotAuthorizeMoonRey } from './infrastructure/certification.ts';
import { simulationPolicy as infrastructurePolicy, terminalCapacityRecord, terminalUsageRecord } from './infrastructure/fixtures.ts';
import { legacyMachineHReinterpreted } from './infrastructure/types.ts';
import { ingestRealEstateRecord } from './real-estate/adapter.ts';
import { certifyRealEstateSandbox, realEstateCertificationCannotAuthorizeMoonRey } from './real-estate/certification.ts';
import { occupiedSpaceRecord, simulationPolicy as realEstatePolicy, vacantCapacityRecord } from './real-estate/fixtures.ts';
import { realEstateFactCannotAutoMint } from './real-estate/types.ts';
import {
  CAPACITY_EQUALS_REALIZED_USE,
  PROPERTY_OWNERSHIP_EQUALS_PRODUCTIVE_USE,
  REAL_ESTATE_PRODUCTION_ACTIVE,
  REAL_ESTATE_REAL_PROVIDER_CONTACTED,
  VACANCY_EQUALS_PRODUCTIVE_USE,
} from './real-estate/types.ts';

const NOW = 1_700_000_000n;

export function runRealEstateInfrastructureDataFabricDemo(): {
  readonly areaTimeMantissa: string;
  readonly facilityTimeMantissa: string;
  readonly flags: Readonly<Record<string, boolean>>;
} {
  const occupied = ingestRealEstateRecord(occupiedSpaceRecord(NOW), NOW, realEstatePolicy());
  if (!occupied.ok) {
    throw new Error(`${occupied.error.code}: ${occupied.error.detail}`);
  }
  const vacant = ingestRealEstateRecord(vacantCapacityRecord(NOW), NOW, realEstatePolicy());
  if (!vacant.ok) {
    throw new Error(`${vacant.error.code}: ${vacant.error.detail}`);
  }
  const terminal = ingestInfrastructureRecord(terminalUsageRecord(NOW), NOW, infrastructurePolicy());
  if (!terminal.ok) {
    throw new Error(`${terminal.error.code}: ${terminal.error.detail}`);
  }
  const capacity = ingestInfrastructureRecord(terminalCapacityRecord(NOW), NOW, infrastructurePolicy());
  if (!capacity.ok) {
    throw new Error(`${capacity.error.code}: ${capacity.error.detail}`);
  }
  const realEstateCert = certifyRealEstateSandbox('valid_realized_area_time', NOW);
  const infrastructureCert = certifyInfrastructureSandbox('valid_facility_time_usage', NOW);
  console.log('CHUNK-135 real-estate use and infrastructure economic data fabric');
  console.log(`commercial_space_area_m2=${occupied.value.observation.areaMantissa.toString()}`);
  console.log(`commercial_space_duration_hours=${(occupied.value.observation.durationSeconds / 3600n).toString()}`);
  console.log(`commercial_space_area_time=${occupied.value.observation.canonicalQuantity.mantissa.toString()} ${occupied.value.observation.canonicalUnit}`);
  console.log(`capacity_only_property=${vacant.value.observation.factType} ${vacant.value.observation.canonicalQuantity.mantissa.toString()} ${vacant.value.observation.canonicalUnit}`);
  console.log(`terminal_facility_units=${terminal.value.observation.facilityUnits.toString()}`);
  console.log(`terminal_duration_hours=${(terminal.value.observation.durationSeconds / 3600n).toString()}`);
  console.log(`terminal_facility_time=${terminal.value.observation.canonicalQuantity.mantissa.toString()} ${terminal.value.observation.canonicalUnit}`);
  console.log(`infrastructure_capacity_only=${capacity.value.observation.factType}`);
  console.log(`sandbox_real_estate_status=${realEstateCert.record.status}`);
  console.log(`sandbox_infrastructure_status=${infrastructureCert.record.status}`);
  console.log(`PROPERTY_OWNERSHIP_EQUALS_PRODUCTIVE_USE=${PROPERTY_OWNERSHIP_EQUALS_PRODUCTIVE_USE}`);
  console.log(`VACANCY_EQUALS_PRODUCTIVE_USE=${VACANCY_EQUALS_PRODUCTIVE_USE}`);
  console.log(`CAPACITY_EQUALS_REALIZED_USE=${CAPACITY_EQUALS_REALIZED_USE}`);
  console.log(`LEGACY_MACHINE_H_REINTERPRETED=${legacyMachineHReinterpreted()}`);
  console.log(`REAL_PROVIDER_CONTACTED=${REAL_ESTATE_REAL_PROVIDER_CONTACTED}`);
  console.log(`PRODUCTION_ACTIVE=${REAL_ESTATE_PRODUCTION_ACTIVE}`);
  console.log(`REAL_ESTATE_FACT_AUTO_MINT=${realEstateFactCannotAutoMint()}`);
  console.log(`CERTIFICATION_AUTHORIZES_MOONREY=${realEstateCertificationCannotAuthorizeMoonRey() || infrastructureCertificationCannotAuthorizeMoonRey()}`);
  return Object.freeze({
    areaTimeMantissa: occupied.value.observation.canonicalQuantity.mantissa.toString(),
    facilityTimeMantissa: terminal.value.observation.canonicalQuantity.mantissa.toString(),
    flags: Object.freeze({
      PROPERTY_OWNERSHIP_EQUALS_PRODUCTIVE_USE,
      VACANCY_EQUALS_PRODUCTIVE_USE,
      CAPACITY_EQUALS_REALIZED_USE,
      LEGACY_MACHINE_H_REINTERPRETED: legacyMachineHReinterpreted(),
      REAL_PROVIDER_CONTACTED: REAL_ESTATE_REAL_PROVIDER_CONTACTED,
      PRODUCTION_ACTIVE: REAL_ESTATE_PRODUCTION_ACTIVE,
    }),
  });
}

const invokedDirectly = (process.argv[1] ?? '').includes('real-estate-infrastructure-demo');
if (invokedDirectly) {
  runRealEstateInfrastructureDataFabricDemo();
}
