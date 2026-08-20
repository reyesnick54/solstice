import { defaultFactFor, INFRASTRUCTURE_SCHEMA_IDS } from './schemas.ts';
import {
  INFRASTRUCTURE_FACILITY_TIME_V2,
  LEGACY_INFRASTRUCTURE_MACHINE_H_V1,
  defaultInfrastructureFabricPolicy,
  type InfrastructureClass,
  type InfrastructureFabricPolicy,
  type InfrastructureFactType,
  type InfrastructureSourceClass,
  type InfrastructureSourceRecord,
  type InfrastructureUnitSemantics,
  type InfrastructureUsageState,
} from './types.ts';

export const INFRASTRUCTURE_FIXTURE_NOW = 1_700_000_000n;

const IDENTITY = Object.freeze({
  facilityId: 'facility.port-terminal-a',
  terminalId: 'terminal.berth-3',
});

export function infrastructureRecord(overrides: {
  readonly identifier?: string;
  readonly sourceClass?: InfrastructureSourceClass;
  readonly factType?: InfrastructureFactType | string;
  readonly numericValue?: string;
  readonly unit?: string;
  readonly facilityUnits?: string;
  readonly measurementStartUnix?: string;
  readonly measurementEndUnix?: string;
  readonly usageState?: InfrastructureUsageState;
  readonly infrastructureClass?: InfrastructureClass;
  readonly unitSemantics?: InfrastructureUnitSemantics;
  readonly schemaId?: string;
  readonly schemaVersion?: number;
  readonly controllerId?: string;
  readonly upstreamOrganizationId?: string;
  readonly operatorPartyId?: string;
  readonly identity?: Partial<InfrastructureSourceRecord['identity']>;
  readonly nowUnix?: bigint;
  readonly sourceTimestampUnix?: string;
  readonly extras?: Readonly<Record<string, unknown>>;
}): InfrastructureSourceRecord {
  const sourceClass = overrides.sourceClass ?? 'TERMINAL_USAGE_SYSTEM';
  const factType = (overrides.factType ?? defaultFactFor(sourceClass)) as InfrastructureSourceRecord['factType'];
  const nowUnix = overrides.nowUnix ?? INFRASTRUCTURE_FIXTURE_NOW;
  const unitSemantics = overrides.unitSemantics ?? INFRASTRUCTURE_FACILITY_TIME_V2;
  const hours = 3;
  const facilityUnits = overrides.facilityUnits ?? '2';
  const legacy = unitSemantics === LEGACY_INFRASTRUCTURE_MACHINE_H_V1;
  return Object.freeze({
    identifier: overrides.identifier ?? `rec.${sourceClass.toLowerCase()}`,
    sourceClass,
    factType,
    numericValue: overrides.numericValue ?? (legacy ? '6' : String(Number(facilityUnits) * hours)),
    unit: overrides.unit ?? (legacy ? 'machine_h' : 'facility_hour'),
    facilityUnits,
    measurementStartUnix: overrides.measurementStartUnix ?? nowUnix.toString(),
    measurementEndUnix: overrides.measurementEndUnix ?? (nowUnix + BigInt(hours * 3_600)).toString(),
    usageState:
      overrides.usageState ?? (factType === 'INFRASTRUCTURE_CAPACITY' ? 'AVAILABLE' : 'SERVING'),
    infrastructureClass: overrides.infrastructureClass ?? 'PORT_TERMINAL',
    unitSemantics,
    schemaId:
      overrides.schemaId ??
      (legacy
        ? factType === 'INFRASTRUCTURE_CAPACITY'
          ? INFRASTRUCTURE_SCHEMA_IDS.LEGACY_INFRASTRUCTURE_CAPACITY_V1
          : INFRASTRUCTURE_SCHEMA_IDS.LEGACY_INFRASTRUCTURE_USAGE_V1
        : INFRASTRUCTURE_SCHEMA_IDS[sourceClass]),
    schemaVersion: overrides.schemaVersion ?? (legacy ? 1 : 2),
    controllerId: overrides.controllerId ?? 'terminal-controller',
    upstreamOrganizationId: overrides.upstreamOrganizationId ?? 'port-org',
    operatorPartyId: overrides.operatorPartyId ?? 'party.operator',
    identity: Object.freeze({ ...IDENTITY, ...overrides.identity }),
    sourceTimestampUnix: overrides.sourceTimestampUnix ?? nowUnix.toString(),
    extras: overrides.extras,
  });
}

export function terminalUsageRecord(nowUnix = INFRASTRUCTURE_FIXTURE_NOW): InfrastructureSourceRecord {
  return infrastructureRecord({ sourceClass: 'TERMINAL_USAGE_SYSTEM', nowUnix });
}

export function terminalCapacityRecord(nowUnix = INFRASTRUCTURE_FIXTURE_NOW): InfrastructureSourceRecord {
  return infrastructureRecord({
    sourceClass: 'PUBLIC_ASSET_UTILIZATION_REFERENCE',
    factType: 'INFRASTRUCTURE_CAPACITY',
    usageState: 'AVAILABLE',
    nowUnix,
  });
}

export function legacyMachineHUsageRecord(nowUnix = INFRASTRUCTURE_FIXTURE_NOW): InfrastructureSourceRecord {
  return infrastructureRecord({
    identifier: 'rec.legacy.machine-h',
    unitSemantics: LEGACY_INFRASTRUCTURE_MACHINE_H_V1,
    unit: 'machine_h',
    numericValue: '6',
    nowUnix,
  });
}

export function independentAttestationRecord(nowUnix = INFRASTRUCTURE_FIXTURE_NOW): InfrastructureSourceRecord {
  return infrastructureRecord({
    sourceClass: 'INDEPENDENT_INFRASTRUCTURE_ATTESTATION',
    controllerId: 'auditor-controller',
    upstreamOrganizationId: 'auditor-org',
    nowUnix,
  });
}

export function simulationPolicy(overrides: Partial<InfrastructureFabricPolicy> = {}): InfrastructureFabricPolicy {
  return Object.freeze({
    ...defaultInfrastructureFabricPolicy(),
    ...overrides,
    preferFacilityTime: true,
    productionActive: false,
    realNetworkCalls: false,
    automaticIssuance: false,
  });
}
