import { RESOURCE_SCHEMA_IDS } from './schemas.ts';
import {
  defaultResourceFabricPolicy,
  type GovernedDensityEvidence,
  type ResourceFabricPolicy,
  type ResourceFactType,
  type ResourceGeography,
  type ResourceMeasurementSemantics,
  type ResourceParty,
  type ResourceRightsReference,
  type ResourceSourceClass,
  type ResourceSourceRecord,
} from './types.ts';

export const RESOURCE_FIXTURE_NOW = 1_700_000_000n;

const GEO: ResourceGeography = Object.freeze({
  schemaVersion: 1,
  jurisdiction: 'SIM',
  mineRegion: 'range-north',
  resourceZone: 'zone-a',
  preciseLocationRedacted: true,
  protectedSite: true,
});

const OPERATOR: ResourceParty = Object.freeze({
  partyId: 'party.operator',
  role: 'OPERATOR',
  organizationId: 'mine-org',
});

const CONTROLLER: ResourceParty = Object.freeze({
  partyId: 'party.controller',
  role: 'CONTROLLER',
  organizationId: 'mine-org',
});

const RIGHTS: ResourceRightsReference = Object.freeze({
  referenceId: 'right.concession.fixture',
  role: 'CONCESSION_HOLDER',
  concessionOrLicenseId: 'concession.sim.1',
  fixtureOnly: true,
  provesRealAuthorization: false,
});

const IDENTITY = Object.freeze({
  mineSiteId: 'mine.alpha',
  pitShaftZoneId: 'pit.3',
  extractionCampaignId: 'campaign.2026-08',
  shiftId: 'shift.day.1',
  haulBatchId: 'haul.batch.77',
  weighbridgeTicketId: 'ticket.wb.77',
  rawMaterialLotId: 'lot.ore.77',
  stockpileId: 'stockpile.rom.1',
});

export function resourceRecord(overrides: {
  readonly identifier?: string;
  readonly sourceClass?: ResourceSourceClass;
  readonly factType?: ResourceFactType | 'REFERENCE_PRICE' | 'RESOURCE_VALUE' | 'MINERAL_VALUE' | string;
  readonly numericValue?: string;
  readonly unit?: string;
  readonly measurementSemantics?: ResourceMeasurementSemantics;
  readonly sourceTimestampUnix?: string;
  readonly schemaId?: string;
  readonly schemaVersion?: number;
  readonly controllerId?: string;
  readonly upstreamOrganizationId?: string;
  readonly operatorPartyId?: string;
  readonly geography?: ResourceGeography;
  readonly identity?: Partial<ResourceSourceRecord['identity']>;
  readonly parties?: readonly ResourceParty[];
  readonly rightsReferences?: readonly ResourceRightsReference[];
  readonly densityEvidence?: GovernedDensityEvidence | null;
  readonly documentedMeterReset?: boolean;
  readonly priorCumulativeMantissa?: bigint | null;
  readonly effectiveDateUnix?: bigint | null;
  readonly nowUnix?: bigint;
  readonly extras?: Readonly<Record<string, unknown>>;
}): ResourceSourceRecord {
  const sourceClass = overrides.sourceClass ?? 'MINE_PRODUCTION_SYSTEM';
  const factType = (overrides.factType ??
    (sourceClass === 'RESERVE_REPORT_REFERENCE' || sourceClass === 'RESOURCE_SURVEY'
      ? 'RESOURCE_RESERVE'
      : 'RESOURCE_EXTRACTION')) as ResourceSourceRecord['factType'];
  const semantics =
    overrides.measurementSemantics ??
    (sourceClass === 'INVENTORY_STOCKPILE_SYSTEM'
      ? 'STOCKPILE_INVENTORY_MASS'
      : sourceClass === 'PROCESS_PLANT_METER'
        ? 'PROCESSED_CONCENTRATE'
        : sourceClass === 'ASSAY_LAB_ATTESTATION'
          ? 'ASSAY_GRADE_QUALITY'
          : factType === 'RESOURCE_RESERVE'
            ? 'RESERVE_ESTIMATE_MASS'
            : 'GROSS_EXTRACTED_MASS');
  const nowUnix = overrides.nowUnix ?? RESOURCE_FIXTURE_NOW;
  return Object.freeze({
    identifier: overrides.identifier ?? `rec.${sourceClass.toLowerCase()}`,
    sourceClass,
    factType,
    numericValue: overrides.numericValue ?? '1000',
    unit: overrides.unit ?? 'tonne',
    measurementSemantics: semantics,
    sourceTimestampUnix: overrides.sourceTimestampUnix ?? nowUnix.toString(),
    schemaId: overrides.schemaId ?? RESOURCE_SCHEMA_IDS[sourceClass],
    schemaVersion: overrides.schemaVersion ?? 1,
    controllerId: overrides.controllerId ?? 'mine-controller',
    upstreamOrganizationId: overrides.upstreamOrganizationId ?? 'mine-org',
    operatorPartyId: overrides.operatorPartyId ?? 'party.operator',
    geography: overrides.geography ?? GEO,
    identity: Object.freeze({ ...IDENTITY, ...overrides.identity }),
    parties: Object.freeze(overrides.parties ?? [OPERATOR, CONTROLLER]),
    rightsReferences: Object.freeze(overrides.rightsReferences ?? [RIGHTS]),
    densityEvidence: overrides.densityEvidence === undefined ? null : overrides.densityEvidence,
    assayEvidence:
      sourceClass === 'ASSAY_LAB_ATTESTATION'
        ? Object.freeze({
            gradePpm: 50_000n,
            analyte: 'Cu',
            samplingMethodologyReference: 'method.assay.sim',
            laboratoryAttestationReference: 'lab.sim.1',
            isPhysicalMass: false as const,
          })
        : null,
    environmentalEvidence: Object.freeze([]),
    reserveEngineeringClass: factType === 'RESOURCE_RESERVE' ? 'INDICATED_RESOURCE' : null,
    methodologyReference: factType === 'RESOURCE_RESERVE' ? 'method.reserve.engineering.sim' : 'method.weighbridge.sim',
    attestationReference: null,
    sourceOrganization: 'mine-org',
    effectiveDateUnix: overrides.effectiveDateUnix === undefined ? nowUnix : overrides.effectiveDateUnix,
    documentedMeterReset: overrides.documentedMeterReset ?? false,
    priorCumulativeMantissa: overrides.priorCumulativeMantissa ?? null,
    extras: overrides.extras,
  });
}

export function haulTelemetryRecord(nowUnix = RESOURCE_FIXTURE_NOW): ResourceSourceRecord {
  return resourceRecord({
    sourceClass: 'HAULAGE_TELEMETRY',
    identifier: 'rec.haul.77',
    nowUnix,
  });
}

export function weighbridgeRecord(nowUnix = RESOURCE_FIXTURE_NOW): ResourceSourceRecord {
  return resourceRecord({
    sourceClass: 'WEIGHBRIDGE',
    identifier: 'rec.wb.77',
    nowUnix,
  });
}

export function mineProductionRecord(nowUnix = RESOURCE_FIXTURE_NOW): ResourceSourceRecord {
  return resourceRecord({
    sourceClass: 'MINE_PRODUCTION_SYSTEM',
    identifier: 'rec.mine.77',
    nowUnix,
  });
}

export function concentrateRecord(nowUnix = RESOURCE_FIXTURE_NOW): ResourceSourceRecord {
  return resourceRecord({
    sourceClass: 'PROCESS_PLANT_METER',
    identifier: 'rec.conc.77',
    numericValue: '100',
    nowUnix,
  });
}

export function stockpileRecord(nowUnix = RESOURCE_FIXTURE_NOW): ResourceSourceRecord {
  return resourceRecord({
    sourceClass: 'INVENTORY_STOCKPILE_SYSTEM',
    identifier: 'rec.stock.77',
    nowUnix,
  });
}

export function reserveReportRecord(nowUnix = RESOURCE_FIXTURE_NOW): ResourceSourceRecord {
  return resourceRecord({
    sourceClass: 'RESERVE_REPORT_REFERENCE',
    identifier: 'rec.reserve.77',
    numericValue: '25000000',
    nowUnix,
  });
}

export function referencePriceRecord(nowUnix = RESOURCE_FIXTURE_NOW): ResourceSourceRecord {
  return resourceRecord({
    identifier: 'rec.price.cu',
    factType: 'REFERENCE_PRICE',
    numericValue: '9200',
    unit: 'units_produced',
    nowUnix,
  });
}

export function independentAssayRecord(nowUnix = RESOURCE_FIXTURE_NOW): ResourceSourceRecord {
  return resourceRecord({
    sourceClass: 'ASSAY_LAB_ATTESTATION',
    identifier: 'rec.assay.77',
    controllerId: 'lab-controller',
    upstreamOrganizationId: 'lab-org',
    nowUnix,
  });
}

export function kgExtractionRecord(nowUnix = RESOURCE_FIXTURE_NOW): ResourceSourceRecord {
  return resourceRecord({
    identifier: 'rec.kg.77',
    numericValue: '2000000',
    unit: 'kg',
    nowUnix,
  });
}

export function simulationPolicy(overrides: Partial<ResourceFabricPolicy> = {}): ResourceFabricPolicy {
  return Object.freeze({
    ...defaultResourceFabricPolicy(),
    ...overrides,
    productionActive: false,
    realNetworkCalls: false,
    automaticIssuance: false,
  });
}
