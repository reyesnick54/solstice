import { WATER_SCHEMA_IDS } from './schemas.ts';
import { defaultWaterQualityEvidence } from './quality.ts';
import {
  defaultWaterFabricPolicy,
  type WaterFabricPolicy,
  type WaterFactType,
  type WaterGeography,
  type WaterMeasurementSemantics,
  type WaterMeterSemantics,
  type WaterParty,
  type WaterRegisterSnapshot,
  type WaterRightsReference,
  type WaterSourceClass,
  type WaterSourceRecord,
} from './types.ts';

export const WATER_FIXTURE_NOW = 1_700_000_000n;

const GEO: WaterGeography = Object.freeze({
  schemaVersion: 1,
  jurisdiction: 'SIM',
  watershed: 'river-basin-west',
  basin: 'basin-a',
  utilityServiceArea: 'utility-north',
  preciseLocationRedacted: true,
});

const OPERATOR: WaterParty = Object.freeze({
  partyId: 'party.water-operator',
  role: 'OPERATOR',
  organizationId: 'utility-org',
});

const CONTROLLER: WaterParty = Object.freeze({
  partyId: 'party.water-controller',
  role: 'CONTROLLER',
  organizationId: 'utility-org',
});

const RIGHTS: WaterRightsReference = Object.freeze({
  referenceId: 'right.water.fixture',
  role: 'WATER_RIGHT_HOLDER',
  concessionOrLicenseId: 'permit.sim.1',
  waterRightReference: 'water.right.sim.1',
  fixtureOnly: true,
  provesRealAuthorization: false,
});

export function waterRecord(overrides: {
  readonly identifier?: string;
  readonly sourceClass?: WaterSourceClass;
  readonly factType?: WaterFactType | 'REFERENCE_PRICE' | string;
  readonly numericValue?: string;
  readonly unit?: string;
  readonly measurementSemantics?: WaterMeasurementSemantics;
  readonly meterSemantics?: WaterMeterSemantics;
  readonly sourceTimestampUnix?: string;
  readonly measurementStartUnix?: string | null;
  readonly measurementEndUnix?: string | null;
  readonly schemaId?: string;
  readonly schemaVersion?: number;
  readonly controllerId?: string;
  readonly upstreamOrganizationId?: string;
  readonly sharedControlGroup?: string | null;
  readonly operatorPartyId?: string;
  readonly meterRef?: string;
  readonly registerId?: string;
  readonly geography?: WaterGeography;
  readonly identity?: Partial<WaterSourceRecord['identity']>;
  readonly parties?: readonly WaterParty[];
  readonly rightsReferences?: readonly WaterRightsReference[];
  readonly documentedMeterReset?: boolean;
  readonly equipmentReplacement?: boolean;
  readonly prior?: WaterRegisterSnapshot | null;
  readonly nowUnix?: bigint;
  readonly extras?: Readonly<Record<string, unknown>>;
  readonly includeQuality?: boolean;
}): WaterSourceRecord {
  const sourceClass = overrides.sourceClass ?? 'TREATMENT_PLANT_METER';
  const factType = (overrides.factType ??
    (sourceClass === 'RESERVOIR_REFERENCE' || sourceClass === 'AQUIFER_REFERENCE'
      ? 'WATER_AVAILABILITY'
      : 'WATER_PRODUCTION')) as WaterSourceRecord['factType'];
  const semantics =
    overrides.measurementSemantics ??
    (sourceClass === 'RESERVOIR_REFERENCE' || sourceClass === 'AQUIFER_REFERENCE'
      ? 'AVAILABLE_RESERVE'
      : sourceClass === 'IRRIGATION_METER'
        ? 'IRRIGATION_CONSUMPTION'
        : sourceClass === 'DESALINATION_PLANT_METER'
          ? 'DESALINATED_WATER_PRODUCTION'
          : sourceClass === 'WATER_QUALITY_ATTESTATION'
            ? 'WATER_QUALITY'
            : 'TREATED_WATER_PRODUCTION');
  const nowUnix = overrides.nowUnix ?? WATER_FIXTURE_NOW;
  return Object.freeze({
    identifier: overrides.identifier ?? `rec.${sourceClass.toLowerCase()}`,
    sourceClass,
    factType,
    numericValue: overrides.numericValue ?? '1000',
    unit: overrides.unit ?? 'm3',
    measurementSemantics: semantics,
    meterSemantics: overrides.meterSemantics ?? 'INTERVAL_VOLUME',
    sourceTimestampUnix: overrides.sourceTimestampUnix ?? nowUnix.toString(),
    measurementStartUnix: overrides.measurementStartUnix === undefined ? nowUnix.toString() : overrides.measurementStartUnix,
    measurementEndUnix: overrides.measurementEndUnix === undefined ? (nowUnix + 3_600n).toString() : overrides.measurementEndUnix,
    schemaId: overrides.schemaId ?? WATER_SCHEMA_IDS[sourceClass],
    schemaVersion: overrides.schemaVersion ?? 1,
    controllerId: overrides.controllerId ?? 'utility-controller',
    upstreamOrganizationId: overrides.upstreamOrganizationId ?? 'utility-org',
    sharedControlGroup: overrides.sharedControlGroup === undefined ? 'utility-control-group' : overrides.sharedControlGroup,
    operatorPartyId: overrides.operatorPartyId ?? 'party.water-operator',
    meterRef: overrides.meterRef ?? 'meter.water.1',
    registerId: overrides.registerId ?? 'register.water.a',
    geography: overrides.geography ?? GEO,
    identity: Object.freeze({
      plantSiteId: 'plant.treatment.1',
      campaignId: 'campaign.water.2026-08',
      batchId: 'batch.water.1',
      ...overrides.identity,
    }),
    parties: Object.freeze(overrides.parties ?? [OPERATOR, CONTROLLER]),
    rightsReferences: Object.freeze(overrides.rightsReferences ?? [RIGHTS]),
    qualityEvidence: overrides.includeQuality === false ? null : defaultWaterQualityEvidence(),
    prior: overrides.prior === undefined ? null : overrides.prior,
    documentedMeterReset: overrides.documentedMeterReset ?? false,
    equipmentReplacement: overrides.equipmentReplacement ?? false,
    sourceOrganization: 'utility-org',
    extras: overrides.extras,
  });
}

export function treatmentMeterRecord(nowUnix = WATER_FIXTURE_NOW): WaterSourceRecord {
  return waterRecord({
    sourceClass: 'TREATMENT_PLANT_METER',
    identifier: 'rec.treatment.1',
    nowUnix,
  });
}

export function desalinationRecord(nowUnix = WATER_FIXTURE_NOW): WaterSourceRecord {
  return waterRecord({
    sourceClass: 'DESALINATION_PLANT_METER',
    identifier: 'rec.desal.1',
    nowUnix,
  });
}

export function reservoirAvailabilityRecord(nowUnix = WATER_FIXTURE_NOW): WaterSourceRecord {
  return waterRecord({
    sourceClass: 'RESERVOIR_REFERENCE',
    identifier: 'rec.reservoir.1',
    numericValue: '25000000',
    nowUnix,
  });
}

export function irrigationConsumptionRecord(nowUnix = WATER_FIXTURE_NOW): WaterSourceRecord {
  return waterRecord({
    sourceClass: 'IRRIGATION_METER',
    identifier: 'rec.irrigation.1',
    numericValue: '80',
    controllerId: 'farm-controller',
    upstreamOrganizationId: 'farm-org',
    sharedControlGroup: 'farm-control-group',
    nowUnix,
  });
}

export function literProductionRecord(nowUnix = WATER_FIXTURE_NOW): WaterSourceRecord {
  return waterRecord({
    identifier: 'rec.liters.1',
    numericValue: '2000000',
    unit: 'L',
    nowUnix,
  });
}

export function wellRecord(nowUnix = WATER_FIXTURE_NOW): WaterSourceRecord {
  return waterRecord({
    sourceClass: 'WELL_PRODUCTION_METER',
    identifier: 'rec.well.1',
    nowUnix,
  });
}

export function cumulativeWaterPair(nowUnix = WATER_FIXTURE_NOW): {
  readonly current: WaterSourceRecord;
} {
  return Object.freeze({
    current: waterRecord({
      identifier: 'rec.cum.water',
      meterSemantics: 'CUMULATIVE_REGISTER',
      numericValue: '1500',
      prior: {
        meterRef: 'meter.water.1',
        registerId: 'register.water.a',
        readingMantissa: 1_000n,
        unit: 'm3',
        sourceTimestampUnix: nowUnix - 3_600n,
      },
      nowUnix,
    }),
  });
}

export function simulationWaterPolicy(overrides: Partial<WaterFabricPolicy> = {}): WaterFabricPolicy {
  return Object.freeze({
    ...defaultWaterFabricPolicy(),
    ...overrides,
    productionActive: false,
    realNetworkCalls: false,
    automaticIssuance: false,
  });
}
