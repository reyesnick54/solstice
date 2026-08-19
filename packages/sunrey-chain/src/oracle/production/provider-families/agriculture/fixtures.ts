import { AGRICULTURE_SCHEMA_IDS } from './schemas.ts';
import { defaultQualityEvidence } from './quality.ts';
import {
  defaultAgricultureFabricPolicy,
  type AgricultureFabricPolicy,
  type AgricultureFactType,
  type AgricultureGeography,
  type AgricultureMeasurementSemantics,
  type AgricultureMeterSemantics,
  type AgricultureParty,
  type AgricultureRegisterSnapshot,
  type AgricultureRightsReference,
  type AgricultureSourceClass,
  type AgricultureSourceRecord,
} from './types.ts';

export const AGRICULTURE_FIXTURE_NOW = 1_700_000_000n;

const GEO: AgricultureGeography = Object.freeze({
  schemaVersion: 1,
  jurisdiction: 'SIM',
  farmRegion: 'prairie',
  agriculturalDistrict: 'district-north',
  watershed: 'river-basin-west',
  basin: 'basin-a',
  preciseLocationRedacted: true,
});

const OPERATOR: AgricultureParty = Object.freeze({
  partyId: 'party.farm-operator',
  role: 'OPERATOR',
  organizationId: 'farm-org',
});

const CONTROLLER: AgricultureParty = Object.freeze({
  partyId: 'party.farm-controller',
  role: 'CONTROLLER',
  organizationId: 'farm-org',
});

const LAND: AgricultureRightsReference = Object.freeze({
  referenceId: 'right.land.fixture',
  role: 'LAND_RIGHT_HOLDER',
  concessionOrLicenseId: 'lease.sim.1',
  landRightReference: 'land.right.sim.1',
  fixtureOnly: true,
  provesRealAuthorization: false,
});

const IDENTITY = Object.freeze({
  farmSiteId: 'farm.alpha',
  fieldPlotId: 'field.12',
  cropCycleId: 'cycle.2026-wheat',
  harvestCampaignId: 'campaign.2026-08',
  harvestBatchId: 'harvest.batch.88',
  lotId: 'lot.wheat.88',
  siloBatchId: 'silo.batch.88',
  packhouseBatchId: 'pack.batch.88',
});

export function agricultureRecord(overrides: {
  readonly identifier?: string;
  readonly sourceClass?: AgricultureSourceClass;
  readonly factType?: AgricultureFactType | 'REFERENCE_PRICE' | string;
  readonly numericValue?: string;
  readonly unit?: string;
  readonly measurementSemantics?: AgricultureMeasurementSemantics;
  readonly meterSemantics?: AgricultureMeterSemantics;
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
  readonly geography?: AgricultureGeography;
  readonly identity?: Partial<AgricultureSourceRecord['identity']>;
  readonly parties?: readonly AgricultureParty[];
  readonly rightsReferences?: readonly AgricultureRightsReference[];
  readonly documentedMeterReset?: boolean;
  readonly equipmentReplacement?: boolean;
  readonly prior?: AgricultureRegisterSnapshot | null;
  readonly nowUnix?: bigint;
  readonly extras?: Readonly<Record<string, unknown>>;
  readonly includeQuality?: boolean;
}): AgricultureSourceRecord {
  const sourceClass = overrides.sourceClass ?? 'FARM_MANAGEMENT_SYSTEM';
  const factType = (overrides.factType ?? 'AGRICULTURAL_OUTPUT') as AgricultureSourceRecord['factType'];
  const semantics =
    overrides.measurementSemantics ??
    (sourceClass === 'SILO_INVENTORY_SYSTEM'
      ? 'INVENTORY'
      : sourceClass === 'PACKHOUSE_SYSTEM'
        ? 'ACCEPTED_OUTPUT'
        : 'HARVESTED');
  const nowUnix = overrides.nowUnix ?? AGRICULTURE_FIXTURE_NOW;
  return Object.freeze({
    identifier: overrides.identifier ?? `rec.${sourceClass.toLowerCase()}`,
    sourceClass,
    factType,
    numericValue: overrides.numericValue ?? '1000',
    unit: overrides.unit ?? 'kg',
    measurementSemantics: semantics,
    meterSemantics: overrides.meterSemantics ?? 'INTERVAL_MASS',
    sourceTimestampUnix: overrides.sourceTimestampUnix ?? nowUnix.toString(),
    measurementStartUnix: overrides.measurementStartUnix === undefined ? nowUnix.toString() : overrides.measurementStartUnix,
    measurementEndUnix: overrides.measurementEndUnix === undefined ? (nowUnix + 3_600n).toString() : overrides.measurementEndUnix,
    schemaId: overrides.schemaId ?? AGRICULTURE_SCHEMA_IDS[sourceClass],
    schemaVersion: overrides.schemaVersion ?? 1,
    controllerId: overrides.controllerId ?? 'farm-controller',
    upstreamOrganizationId: overrides.upstreamOrganizationId ?? 'farm-org',
    sharedControlGroup: overrides.sharedControlGroup === undefined ? 'farm-control-group' : overrides.sharedControlGroup,
    operatorPartyId: overrides.operatorPartyId ?? 'party.farm-operator',
    meterRef: overrides.meterRef ?? 'meter.harvest.1',
    registerId: overrides.registerId ?? 'register.harvest.a',
    geography: overrides.geography ?? GEO,
    identity: Object.freeze({ ...IDENTITY, ...overrides.identity }),
    parties: Object.freeze(overrides.parties ?? [OPERATOR, CONTROLLER]),
    rightsReferences: Object.freeze(overrides.rightsReferences ?? [LAND]),
    qualityEvidence: overrides.includeQuality === false ? null : defaultQualityEvidence(),
    weatherContext: null,
    prior: overrides.prior === undefined ? null : overrides.prior,
    documentedMeterReset: overrides.documentedMeterReset ?? false,
    equipmentReplacement: overrides.equipmentReplacement ?? false,
    sourceOrganization: 'farm-org',
    extras: overrides.extras,
  });
}

export function harvestTelemetryRecord(nowUnix = AGRICULTURE_FIXTURE_NOW): AgricultureSourceRecord {
  return agricultureRecord({
    sourceClass: 'AGRICULTURAL_EQUIPMENT_TELEMETRY',
    identifier: 'rec.combine.88',
    nowUnix,
  });
}

export function grainScaleRecord(nowUnix = AGRICULTURE_FIXTURE_NOW): AgricultureSourceRecord {
  return agricultureRecord({
    sourceClass: 'GRAIN_SCALE',
    identifier: 'rec.scale.88',
    nowUnix,
  });
}

export function farmSystemRecord(nowUnix = AGRICULTURE_FIXTURE_NOW): AgricultureSourceRecord {
  return agricultureRecord({
    sourceClass: 'FARM_MANAGEMENT_SYSTEM',
    identifier: 'rec.fms.88',
    nowUnix,
  });
}

export function dairyMassRecord(nowUnix = AGRICULTURE_FIXTURE_NOW): AgricultureSourceRecord {
  return agricultureRecord({
    sourceClass: 'DAIRY_PRODUCTION_METER',
    factType: 'FOOD_PRODUCTION',
    identifier: 'rec.dairy.88',
    numericValue: '250',
    unit: 'kg',
    nowUnix,
  });
}

export function plantedFieldRecord(nowUnix = AGRICULTURE_FIXTURE_NOW): AgricultureSourceRecord {
  return agricultureRecord({
    identifier: 'rec.planted.88',
    measurementSemantics: 'PLANTED',
    unit: 'm2',
    numericValue: '40000',
    nowUnix,
  });
}

export function forecastYieldRecord(nowUnix = AGRICULTURE_FIXTURE_NOW): AgricultureSourceRecord {
  return agricultureRecord({
    identifier: 'rec.forecast.88',
    measurementSemantics: 'EXPECTED_YIELD',
    numericValue: '1200',
    nowUnix,
  });
}

export function inventoryMovementRecord(nowUnix = AGRICULTURE_FIXTURE_NOW): AgricultureSourceRecord {
  return agricultureRecord({
    sourceClass: 'SILO_INVENTORY_SYSTEM',
    identifier: 'rec.silo.88',
    nowUnix,
  });
}

export function processedFlourRecord(nowUnix = AGRICULTURE_FIXTURE_NOW): AgricultureSourceRecord {
  return agricultureRecord({
    sourceClass: 'PACKHOUSE_SYSTEM',
    identifier: 'rec.flour.88',
    numericValue: '750',
    measurementSemantics: 'PROCESSED_FOOD',
    nowUnix,
  });
}

export function tonneHarvestRecord(nowUnix = AGRICULTURE_FIXTURE_NOW): AgricultureSourceRecord {
  return agricultureRecord({
    identifier: 'rec.tonne.88',
    numericValue: '2',
    unit: 'tonne',
    nowUnix,
  });
}

export function cumulativeHarvestPair(nowUnix = AGRICULTURE_FIXTURE_NOW): {
  readonly prior: AgricultureSourceRecord;
  readonly current: AgricultureSourceRecord;
} {
  const priorSnap: AgricultureRegisterSnapshot = Object.freeze({
    meterRef: 'meter.harvest.1',
    registerId: 'register.harvest.a',
    readingMantissa: 4_000n,
    unit: 'kg',
    sourceTimestampUnix: nowUnix - 3_600n,
  });
  return Object.freeze({
    prior: agricultureRecord({
      identifier: 'rec.cum.prior',
      sourceClass: 'HARVEST_METER',
      meterSemantics: 'CUMULATIVE_REGISTER',
      numericValue: '4000',
      sourceTimestampUnix: (nowUnix - 3_600n).toString(),
      nowUnix: nowUnix - 3_600n,
    }),
    current: agricultureRecord({
      identifier: 'rec.cum.current',
      sourceClass: 'HARVEST_METER',
      meterSemantics: 'CUMULATIVE_REGISTER',
      numericValue: '5000',
      prior: priorSnap,
      nowUnix,
    }),
  });
}

export function simulationAgriculturePolicy(overrides: Partial<AgricultureFabricPolicy> = {}): AgricultureFabricPolicy {
  return Object.freeze({
    ...defaultAgricultureFabricPolicy(),
    ...overrides,
    productionActive: false,
    realNetworkCalls: false,
    automaticIssuance: false,
  });
}
