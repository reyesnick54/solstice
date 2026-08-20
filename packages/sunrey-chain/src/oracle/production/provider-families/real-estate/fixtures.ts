import { defaultFactFor, REAL_ESTATE_SCHEMA_IDS } from './schemas.ts';
import {
  defaultRealEstateFabricPolicy,
  type RealEstateFabricPolicy,
  type RealEstateFactType,
  type RealEstateParty,
  type RealEstateRightsReference,
  type RealEstateSourceClass,
  type RealEstateSourceRecord,
  type RealEstateUsageState,
} from './types.ts';

export const REAL_ESTATE_FIXTURE_NOW = 1_700_000_000n;

const OWNER: RealEstateParty = Object.freeze({
  partyId: 'party.owner',
  role: 'LEGAL_OWNER',
  organizationId: 'owner-org',
});

const CONTROLLER: RealEstateParty = Object.freeze({
  partyId: 'party.controller',
  role: 'CONTROLLER',
  organizationId: 'manager-org',
});

const OPERATOR: RealEstateParty = Object.freeze({
  partyId: 'party.operator',
  role: 'OPERATOR',
  organizationId: 'manager-org',
});

const USE_RIGHT: RealEstateRightsReference = Object.freeze({
  referenceId: 'right.lease.fixture',
  role: 'USE_RIGHT_HOLDER',
  leaseOrUseCommitment: 'commit.lease.sim.1',
  fixtureOnly: true,
  provesLegalTitle: false,
});

const IDENTITY = Object.freeze({
  spaceId: 'space.floor3.suite-a',
  propertyId: 'property.harbor-tower',
  facilityId: 'facility.harbor-tower',
});

export function realEstateRecord(overrides: {
  readonly identifier?: string;
  readonly sourceClass?: RealEstateSourceClass;
  readonly factType?: RealEstateFactType | FactTypeLike;
  readonly numericValue?: string;
  readonly unit?: string;
  readonly areaMantissa?: string;
  readonly measurementStartUnix?: string;
  readonly measurementEndUnix?: string;
  readonly usageState?: RealEstateUsageState;
  readonly schemaId?: string;
  readonly schemaVersion?: number;
  readonly controllerId?: string;
  readonly upstreamOrganizationId?: string;
  readonly operatorPartyId?: string;
  readonly identity?: Partial<RealEstateSourceRecord['identity']>;
  readonly parties?: readonly RealEstateParty[];
  readonly rightsReferences?: readonly RealEstateRightsReference[];
  readonly nowUnix?: bigint;
  readonly sourceTimestampUnix?: string;
  readonly extras?: Readonly<Record<string, unknown>>;
}): RealEstateSourceRecord {
  const sourceClass = overrides.sourceClass ?? 'COMMERCIAL_SPACE_METER';
  const factType = (overrides.factType ?? defaultFactFor(sourceClass)) as RealEstateSourceRecord['factType'];
  const nowUnix = overrides.nowUnix ?? REAL_ESTATE_FIXTURE_NOW;
  const durationHours = 4;
  const area = overrides.areaMantissa ?? '100';
  return Object.freeze({
    identifier: overrides.identifier ?? `rec.${sourceClass.toLowerCase()}`,
    sourceClass,
    factType,
    numericValue: overrides.numericValue ?? (factType === 'REAL_ESTATE_USAGE' ? '400' : area),
    unit: overrides.unit ?? (factType === 'REAL_ESTATE_USAGE' ? 'm2_hour' : 'm2'),
    areaMantissa: area,
    areaUnit: 'm2',
    measurementStartUnix: overrides.measurementStartUnix ?? nowUnix.toString(),
    measurementEndUnix: overrides.measurementEndUnix ?? (nowUnix + BigInt(durationHours * 3_600)).toString(),
    usageState: overrides.usageState ?? (factType === 'REAL_ESTATE_USE_CAPACITY' ? 'VACANT' : 'OCCUPIED'),
    schemaId: overrides.schemaId ?? REAL_ESTATE_SCHEMA_IDS[sourceClass],
    schemaVersion: overrides.schemaVersion ?? 1,
    controllerId: overrides.controllerId ?? 'building-controller',
    upstreamOrganizationId: overrides.upstreamOrganizationId ?? 'manager-org',
    operatorPartyId: overrides.operatorPartyId ?? 'party.operator',
    identity: Object.freeze({ ...IDENTITY, ...overrides.identity }),
    parties: Object.freeze(overrides.parties ?? [OWNER, CONTROLLER, OPERATOR]),
    rightsReferences: Object.freeze(overrides.rightsReferences ?? [USE_RIGHT]),
    sourceTimestampUnix: overrides.sourceTimestampUnix ?? nowUnix.toString(),
    extras: overrides.extras,
  });
}

type FactTypeLike = RealEstateFactType | 'REFERENCE_PRICE' | 'ENERGY_PRODUCTION' | string;

export function occupiedSpaceRecord(nowUnix = REAL_ESTATE_FIXTURE_NOW): RealEstateSourceRecord {
  return realEstateRecord({ sourceClass: 'COMMERCIAL_SPACE_METER', nowUnix });
}

export function vacantCapacityRecord(nowUnix = REAL_ESTATE_FIXTURE_NOW): RealEstateSourceRecord {
  return realEstateRecord({
    sourceClass: 'WAREHOUSE_SPACE_REFERENCE',
    factType: 'REAL_ESTATE_USE_CAPACITY',
    usageState: 'VACANT',
    nowUnix,
  });
}

export function listingRecord(nowUnix = REAL_ESTATE_FIXTURE_NOW): RealEstateSourceRecord {
  return realEstateRecord({
    factType: 'REAL_ESTATE_USAGE',
    usageState: 'LISTED',
    nowUnix,
  });
}

export function ownedOnlyRecord(nowUnix = REAL_ESTATE_FIXTURE_NOW): RealEstateSourceRecord {
  return realEstateRecord({
    factType: 'REAL_ESTATE_USAGE',
    usageState: 'OWNED_ONLY',
    nowUnix,
  });
}

export function bookingSystemRecord(nowUnix = REAL_ESTATE_FIXTURE_NOW): RealEstateSourceRecord {
  return realEstateRecord({
    sourceClass: 'SPACE_BOOKING_SYSTEM',
    identifier: 'rec.booking.suite-a',
    nowUnix,
  });
}

export function accessControlRecord(nowUnix = REAL_ESTATE_FIXTURE_NOW): RealEstateSourceRecord {
  return realEstateRecord({
    sourceClass: 'AGGREGATE_ACCESS_CONTROL',
    identifier: 'rec.access.suite-a',
    nowUnix,
  });
}

export function independentAttestationRecord(nowUnix = REAL_ESTATE_FIXTURE_NOW): RealEstateSourceRecord {
  return realEstateRecord({
    sourceClass: 'INDEPENDENT_OCCUPANCY_ATTESTATION',
    controllerId: 'auditor-controller',
    upstreamOrganizationId: 'auditor-org',
    nowUnix,
  });
}

export function simulationPolicy(overrides: Partial<RealEstateFabricPolicy> = {}): RealEstateFabricPolicy {
  return Object.freeze({
    ...defaultRealEstateFabricPolicy(),
    ...overrides,
    productionActive: false,
    realNetworkCalls: false,
    automaticIssuance: false,
  });
}
