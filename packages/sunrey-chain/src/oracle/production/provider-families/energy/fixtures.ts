/**
 * Deterministic energy fabric fixtures. Framework testing only.
 * These are not commercial providers or live meter feeds.
 */

import type { DeviceProvenance } from '../../../types.ts';
import {
  type EnergyFlowChannel,
  type EnergyGeography,
  type EnergyIndependence,
  type EnergyObservationInput,
  type EnergyRegisterSnapshot,
  type EnergySubjectRef,
} from './types.ts';
import { canonicalEnergySubject } from './provenance.ts';

export const ENERGY_NOW_UNIX = 1_700_000_000n;

export const ENERGY_GEOGRAPHY: EnergyGeography = Object.freeze({
  schemaVersion: 1,
  jurisdiction: 'US',
  region: 'sim-west',
  locality: 'grid-zone-a',
  gridZone: 'sim-zone-a',
});

export const ENERGY_DEVICE: DeviceProvenance = Object.freeze({
  schemaVersion: 1,
  deviceId: 'meter.gen.sim.1',
  ownerController: 'controller_energy_sim',
  firmwareHash: 'fw_energy_sim_v1',
  hardwareAttestation: 'attest_energy_sim_v1',
  calibrationRecord: 'cal_energy_sim_2024',
  measurementSchema: 'ENERGY_INTERVAL_V1',
});

export function energyIndependence(
  controllerId = 'controller_energy_sim',
  upstreamOrganizationId = 'org_energy_sim',
  sharedControlGroup: string | null = null,
): EnergyIndependence {
  return Object.freeze({
    controllerId,
    upstreamOrganizationId,
    sharedControlGroup,
    transportEndpointId: 'endpoint_sandbox_energy',
  });
}

export function energySubject(kind: EnergySubjectRef['kind'] = 'GENERATOR', identity = 'gen_sim_1'): EnergySubjectRef {
  return canonicalEnergySubject(kind, identity, identity);
}

function base(overrides: Partial<EnergyObservationInput> & Pick<EnergyObservationInput, 'schemaId' | 'profileId' | 'sourceClass' | 'factType' | 'meterSemantics'>): EnergyObservationInput {
  return Object.freeze({
    sourceObservationId: overrides.sourceObservationId ?? 'obs_energy_1',
    channel: overrides.channel ?? 'LOCAL_PRODUCTION',
    subject: overrides.subject ?? energySubject(),
    meterRef: overrides.meterRef ?? 'meter.gen.sim.1',
    registerId: overrides.registerId ?? 'reg.kwh.1',
    quantity: overrides.quantity ?? '100',
    unit: overrides.unit ?? 'kWh',
    sourceTimestampUnix: overrides.sourceTimestampUnix ?? ENERGY_NOW_UNIX.toString(),
    measurementStartUnix: overrides.measurementStartUnix === undefined ? (ENERGY_NOW_UNIX - 3_600n).toString() : overrides.measurementStartUnix,
    measurementEndUnix: overrides.measurementEndUnix === undefined ? ENERGY_NOW_UNIX.toString() : overrides.measurementEndUnix,
    collectionTimestampUnix: overrides.collectionTimestampUnix ?? ENERGY_NOW_UNIX.toString(),
    geography: overrides.geography ?? ENERGY_GEOGRAPHY,
    independence: overrides.independence ?? energyIndependence(),
    deviceProvenance: overrides.deviceProvenance === undefined ? ENERGY_DEVICE : overrides.deviceProvenance,
    calibrationRecordRef: overrides.calibrationRecordRef ?? 'cal_energy_sim_2024',
    prior: overrides.prior ?? null,
    relatedObservations: overrides.relatedObservations,
    referencePrice: overrides.referencePrice ?? null,
    storageInputLineageRef: overrides.storageInputLineageRef ?? null,
    extras: overrides.extras,
    schemaId: overrides.schemaId,
    profileId: overrides.profileId,
    sourceClass: overrides.sourceClass,
    factType: overrides.factType,
    meterSemantics: overrides.meterSemantics,
  });
}

export function validGeneratorIntervalFeed(overrides: Partial<EnergyObservationInput> = {}): EnergyObservationInput {
  return base({
    schemaId: 'ENERGY_INTERVAL_V1',
    profileId: 'generator_interval_production',
    sourceClass: 'GENERATOR_METER',
    factType: 'ENERGY_PRODUCTION',
    meterSemantics: 'INTERVAL_ENERGY',
    channel: 'LOCAL_PRODUCTION',
    ...overrides,
  });
}

export function validUtilityConsumptionFeed(overrides: Partial<EnergyObservationInput> = {}): EnergyObservationInput {
  return base({
    schemaId: 'ENERGY_CONSUMPTION_INTERVAL_V1',
    profileId: 'utility_consumption_interval',
    sourceClass: 'UTILITY_METER',
    factType: 'ENERGY_CONSUMPTION',
    meterSemantics: 'INTERVAL_ENERGY',
    channel: 'LOCAL_CONSUMPTION',
    subject: energySubject('BUILDING_FACILITY', 'bldg_sim_1'),
    meterRef: 'meter.util.sim.1',
    quantity: '20',
    ...overrides,
  });
}

export function validCumulativeMeterFeed(overrides: Partial<EnergyObservationInput> = {}): EnergyObservationInput {
  const prior: EnergyRegisterSnapshot = overrides.prior ?? {
    meterRef: 'meter.gen.sim.1',
    registerId: 'reg.kwh.1',
    readingMantissa: 9_000n,
    unit: 'kWh',
    sourceTimestampUnix: ENERGY_NOW_UNIX - 3_600n,
    subjectCanonicalRef: energySubject().canonicalRef,
  };
  return base({
    schemaId: 'ENERGY_CUMULATIVE_REGISTER_V1',
    profileId: 'generator_cumulative_register',
    sourceClass: 'GENERATOR_METER',
    factType: 'ENERGY_PRODUCTION',
    meterSemantics: 'CUMULATIVE_REGISTER',
    channel: 'LOCAL_PRODUCTION',
    quantity: '9100',
    prior,
    ...overrides,
  });
}

export function firstCumulativeRegisterReading(): EnergyObservationInput {
  return validCumulativeMeterFeed({
    prior: null,
    quantity: '9100',
    measurementStartUnix: null,
    measurementEndUnix: null,
  });
}

export function validReferencePriceFeed(overrides: Partial<EnergyObservationInput> = {}): EnergyObservationInput {
  return base({
    schemaId: 'ENERGY_REFERENCE_PRICE_V1',
    profileId: 'energy_market_reference_price',
    sourceClass: 'ENERGY_MARKET_REFERENCE',
    factType: 'REFERENCE_PRICE',
    meterSemantics: 'INTERVAL_ENERGY',
    channel: null,
    unit: 'units_produced',
    quantity: '4500',
    subject: energySubject('GRID_REGION', 'zone_sim_a'),
    meterRef: 'ref.price.zone.a',
    registerId: 'reg.lmp.1',
    deviceProvenance: null,
    referencePrice: {
      sourceReference: 'sandbox.energy.lmp.v1',
      baseDenomination: 'USD_CENTS',
      quoteDenomination: 'MWh',
      methodologyReference: 'method.energy.lmp.sandbox.v1',
      geography: ENERGY_GEOGRAPHY,
      window: {
        sourceTimestampUnix: ENERGY_NOW_UNIX,
        measurementStartUnix: ENERGY_NOW_UNIX - 3_600n,
        measurementEndUnix: ENERGY_NOW_UNIX,
        collectionTimestampUnix: ENERGY_NOW_UNIX,
      },
    },
    ...overrides,
  });
}

export function validGridExportFeed(): EnergyObservationInput {
  return base({
    schemaId: 'ENERGY_EXPORT_INTERVAL_V1',
    profileId: 'grid_export_interval',
    sourceClass: 'GENERATOR_METER',
    factType: 'ENERGY_PRODUCTION',
    meterSemantics: 'INTERVAL_ENERGY',
    channel: 'GRID_EXPORT',
    quantity: '80',
    meterRef: 'meter.gen.export.1',
    registerId: 'reg.export.1',
  });
}

export function validGridImportFeed(): EnergyObservationInput {
  return base({
    schemaId: 'ENERGY_CONSUMPTION_INTERVAL_V1',
    profileId: 'grid_import_interval',
    sourceClass: 'UTILITY_METER',
    factType: 'ENERGY_CONSUMPTION',
    meterSemantics: 'INTERVAL_ENERGY',
    channel: 'GRID_IMPORT',
    quantity: '15',
    meterRef: 'meter.util.import.1',
    registerId: 'reg.import.1',
    subject: energySubject('BUILDING_FACILITY', 'bldg_sim_1'),
  });
}

export function validStorageChargeFeed(overrides: Partial<EnergyObservationInput> = {}): EnergyObservationInput {
  return base({
    schemaId: 'ENERGY_CONSUMPTION_INTERVAL_V1',
    profileId: 'storage_charge',
    sourceClass: 'ENERGY_STORAGE_METER',
    factType: 'ENERGY_CONSUMPTION',
    meterSemantics: 'INTERVAL_ENERGY',
    channel: 'STORAGE_CHARGE',
    quantity: '40',
    meterRef: 'meter.storage.sim.1',
    registerId: 'reg.charge.1',
    subject: energySubject('METER', 'storage_sim_1'),
    ...overrides,
  });
}

export function validStorageDischargeFeed(lineageRef: string | null = 'energy.input.charge.1'): EnergyObservationInput {
  return base({
    schemaId: 'ENERGY_INTERVAL_V1',
    profileId: 'storage_discharge',
    sourceClass: 'ENERGY_STORAGE_METER',
    factType: 'ENERGY_PRODUCTION',
    meterSemantics: 'INTERVAL_ENERGY',
    channel: 'STORAGE_DISCHARGE',
    quantity: '36',
    meterRef: 'meter.storage.sim.1',
    registerId: 'reg.discharge.1',
    subject: energySubject('METER', 'storage_sim_1'),
    storageInputLineageRef: lineageRef,
  });
}

export function meterResetFixture(): EnergyObservationInput {
  return validCumulativeMeterFeed({
    quantity: '12',
    extras: { meterReset: true },
  });
}

export function duplicateIntervalFixture(): EnergyObservationInput {
  return validGeneratorIntervalFeed({ sourceObservationId: 'obs_energy_dup' });
}

export function staleReadingFixture(): EnergyObservationInput {
  return validGeneratorIntervalFeed({
    sourceTimestampUnix: (ENERGY_NOW_UNIX - 10_000n).toString(),
    measurementStartUnix: (ENERGY_NOW_UNIX - 13_600n).toString(),
    measurementEndUnix: (ENERGY_NOW_UNIX - 10_000n).toString(),
  });
}

export function invalidIntervalFixture(): EnergyObservationInput {
  return validGeneratorIntervalFeed({
    measurementStartUnix: ENERGY_NOW_UNIX.toString(),
    measurementEndUnix: (ENERGY_NOW_UNIX - 60n).toString(),
  });
}

export function wrongUnitFixture(): EnergyObservationInput {
  return validGeneratorIntervalFeed({ unit: 'tonne' });
}

export function floatQuantityFixture(): EnergyObservationInput {
  return validGeneratorIntervalFeed({ quantity: '12.5' });
}

export function negativeProductionFixture(): EnergyObservationInput {
  return validGeneratorIntervalFeed({ quantity: '-40' });
}

export function missingSourceTimestampFixture(): EnergyObservationInput {
  return validGeneratorIntervalFeed({ sourceTimestampUnix: '' });
}

export function sameControllerQuorumFixture(): EnergyObservationInput {
  const alias = validGeneratorIntervalFeed({
    sourceObservationId: 'obs_energy_alias',
    meterRef: 'meter.reseller.2',
    independence: energyIndependence('controller_energy_sim', 'org_energy_sim', 'shared-grid-feed'),
  });
  return validGeneratorIntervalFeed({
    extras: { requireIndependentQuorum: true },
    independence: energyIndependence('controller_energy_sim', 'org_energy_sim', 'shared-grid-feed'),
    relatedObservations: [alias],
  });
}

export function schemaDriftFixture(): EnergyObservationInput {
  return validGeneratorIntervalFeed({ schemaId: 'ENERGY_CONSUMPTION_INTERVAL_V1' });
}

export function wrongFactTypeFixture(): EnergyObservationInput {
  return validGeneratorIntervalFeed({ factType: 'ENERGY_CONSUMPTION' });
}

export function referencePricePretendingProduction(): EnergyObservationInput {
  return validReferencePriceFeed({ extras: { pretendProduction: true } });
}

export function capacityPowerDimensionFixture(): EnergyObservationInput {
  return base({
    schemaId: 'ENERGY_CAPACITY_REFERENCE_V1',
    profileId: 'nameplate_capacity_reference',
    sourceClass: 'PLANT_TELEMETRY',
    factType: 'ENERGY_CAPACITY',
    meterSemantics: 'INSTANTANEOUS_CAPACITY_REFERENCE',
    channel: null,
    unit: 'MW',
    quantity: '50',
  });
}

export function capacityMwhAsMwFixture(): EnergyObservationInput {
  return base({
    schemaId: 'ENERGY_CAPACITY_REFERENCE_V1',
    profileId: 'nameplate_capacity_reference',
    sourceClass: 'PLANT_TELEMETRY',
    factType: 'ENERGY_CAPACITY',
    meterSemantics: 'INSTANTANEOUS_CAPACITY_REFERENCE',
    channel: null,
    unit: 'MWh',
    quantity: '50',
  });
}

export function credentialLeakFixture(): EnergyObservationInput {
  return validGeneratorIntervalFeed({
    extras: { apiKey: 'sandbox-not-a-real-secret' },
  });
}

export function unitAliasRetransmission(original: EnergyObservationInput): EnergyObservationInput {
  return validGeneratorIntervalFeed({
    sourceObservationId: original.sourceObservationId,
    quantity: '100000',
    unit: 'Wh',
    meterRef: original.meterRef,
    registerId: original.registerId,
    measurementStartUnix: original.measurementStartUnix,
    measurementEndUnix: original.measurementEndUnix,
  });
}

export function plantTelemetrySameEvent(): EnergyObservationInput {
  return validGeneratorIntervalFeed({
    profileId: 'plant_telemetry_production',
    sourceClass: 'PLANT_TELEMETRY',
    sourceObservationId: 'obs_plant_telemetry_1',
    meterRef: 'telemetry.plant.sim.1',
    registerId: 'reg.plant.1',
  });
}

export function behindTheMeterPair(): { readonly production: EnergyObservationInput; readonly consumption: EnergyObservationInput } {
  return {
    production: validGeneratorIntervalFeed({
      channel: 'LOCAL_PRODUCTION',
      quantity: '100',
      registerId: 'reg.prod.1',
    }),
    consumption: validUtilityConsumptionFeed({
      channel: 'LOCAL_CONSUMPTION',
      quantity: '20',
      subject: energySubject('BUILDING_FACILITY', 'site_btm_1'),
      meterRef: 'meter.btm.consume.1',
      registerId: 'reg.cons.1',
    }),
  };
}
