/**
 * Chunk 135 — Infrastructure economic data fabric.
 *
 * Provider-neutral evidence for facility capacity and realized
 * facility-time service. Extends sunrey-production-oracles.
 *
 * Historical INFRASTRUCTURE_USAGE / INFRASTRUCTURE_CAPACITY records
 * stored as machine_h remain LEGACY_INFRASTRUCTURE_MACHINE_H_V1.
 * New family feeds use INFRASTRUCTURE_FACILITY_TIME_V2 / facility_hour.
 * machine_h is never silently reinterpreted as facility-hour.
 *
 * Physical transport services stay in the logistics family.
 */

import type { FactType, UnitCode } from '../../../types.ts';
import type { DataSourceCategory } from '../../types.ts';
import type { ClaimType, ProductiveCategory } from '../../../../productive/types.ts';
import type { ExactQuantity } from '../../../../units/types.ts';
import type { IdentityRef } from '../../../../productive/policy-governance/attribution/types.ts';

export const INFRASTRUCTURE_FABRIC_SCHEMA_VERSION = 1 as const;
export const INFRASTRUCTURE_FABRIC_POLICY_VERSION = 'sunrey.infrastructure-data-fabric.v1' as const;
export const INFRASTRUCTURE_NORMALIZATION_VERSION = 'sunrey.economic-unit.normalization.v1' as const;
export const LEGACY_INFRASTRUCTURE_MACHINE_H_V1 = 'LEGACY_INFRASTRUCTURE_MACHINE_H_V1' as const;
export const INFRASTRUCTURE_FACILITY_TIME_V2 = 'INFRASTRUCTURE_FACILITY_TIME_V2' as const;
export const INFRASTRUCTURE_PRODUCTION_ACTIVE = false as const;
export const INFRASTRUCTURE_REAL_PROVIDER_CONTACTED = false as const;
export const INFRASTRUCTURE_FACT_AUTO_MINTS = false as const;
export const INFRASTRUCTURE_CERTIFICATION_AUTHORIZES_MOONREY = false as const;
export const CAPACITY_EQUALS_REALIZED_USE = false as const;
export const LEGACY_MACHINE_H_REINTERPRETED = false as const;
export const MAINTENANCE_IS_NEGATIVE_OUTPUT = false as const;

export const INFRASTRUCTURE_SOURCE_CLASSES = [
  'FACILITY_MANAGEMENT_SYSTEM',
  'TERMINAL_USAGE_SYSTEM',
  'PORT_INFRASTRUCTURE_SYSTEM',
  'AIRPORT_INFRASTRUCTURE_SYSTEM',
  'RAIL_TERMINAL_SYSTEM',
  'DATA_CENTER_FACILITY_SYSTEM',
  'PUBLIC_ASSET_UTILIZATION_REFERENCE',
  'INDUSTRIAL_INFRASTRUCTURE_METER',
  'INDEPENDENT_INFRASTRUCTURE_ATTESTATION',
] as const;
export type InfrastructureSourceClass = (typeof INFRASTRUCTURE_SOURCE_CLASSES)[number];

export const INFRASTRUCTURE_FACT_TYPES = ['INFRASTRUCTURE_CAPACITY', 'INFRASTRUCTURE_USAGE'] as const;
export type InfrastructureFactType = (typeof INFRASTRUCTURE_FACT_TYPES)[number];

export const INFRASTRUCTURE_CLASSES = [
  'PORT_TERMINAL',
  'AIRPORT_TERMINAL',
  'RAIL_TERMINAL',
  'INDUSTRIAL_FACILITY',
  'DATA_CENTER_FACILITY',
  'UTILITY_FACILITY',
  'PUBLIC_FACILITY',
  'OTHER_GOVERNED_FACILITY',
] as const;
export type InfrastructureClass = (typeof INFRASTRUCTURE_CLASSES)[number];

export const INFRASTRUCTURE_USAGE_STATES = [
  'IN_SERVICE',
  'SERVING',
  'AVAILABLE',
  'VACANT',
  'MAINTENANCE',
  'DOWNTIME',
] as const;
export type InfrastructureUsageState = (typeof INFRASTRUCTURE_USAGE_STATES)[number];

export const REALIZED_INFRASTRUCTURE_STATES = ['IN_SERVICE', 'SERVING'] as const;
export type RealizedInfrastructureState = (typeof REALIZED_INFRASTRUCTURE_STATES)[number];

export const INFRASTRUCTURE_UNIT_SEMANTICS = [
  LEGACY_INFRASTRUCTURE_MACHINE_H_V1,
  INFRASTRUCTURE_FACILITY_TIME_V2,
] as const;
export type InfrastructureUnitSemantics = (typeof INFRASTRUCTURE_UNIT_SEMANTICS)[number];

export const INFRASTRUCTURE_INDEPENDENCE_CLASSES = [
  'SAME_CONTROLLER',
  'SAME_UPSTREAM_ORGANIZATION',
  'INDEPENDENT_ORGANIZATION',
] as const;
export type InfrastructureIndependenceClass = (typeof INFRASTRUCTURE_INDEPENDENCE_CLASSES)[number];

export const INFRASTRUCTURE_REJECTION_CODES = [
  'CAPACITY_IS_NOT_USAGE',
  'MACHINE_H_USED_FOR_FACILITY_HOUR',
  'LEGACY_MACHINE_H_REINTERPRETED',
  'FACILITY_TIME_INEXACT',
  'FLOAT_QUANTITY_FORBIDDEN',
  'FLOAT_DURATION_FORBIDDEN',
  'SAME_CONTROLLER_FAKE_QUORUM',
  'SCHEMA_DRIFT',
  'WRONG_UNIT',
  'WRONG_FACT_TYPE',
  'UNKNOWN_SOURCE_CLASS',
  'UNKNOWN_INFRASTRUCTURE_CLASS',
  'UNKNOWN_USAGE_STATE',
  'MISSING_FACILITY_REF',
  'MISSING_MEASUREMENT_WINDOW',
  'MAINTENANCE_IS_NOT_NEGATIVE_OUTPUT',
  'ENERGY_INPUT_CLAIMED_AS_OUTPUT',
  'WATER_INPUT_CLAIMED_AS_OUTPUT',
  'LOGISTICS_TRANSPORT_MERGED',
  'DUPLICATE_FACILITY_SERVICE',
  'UTILIZATION_DENOMINATOR_INVENTED',
  'UTILIZATION_DIMENSION_MISMATCH',
  'STALE_UTILIZATION',
  'AUTO_MINT_FORBIDDEN',
  'CERTIFICATION_CANNOT_AUTHORIZE_MOONREY',
  'REAL_NETWORK_FORBIDDEN',
  'PRODUCTION_ACTIVATION_FORBIDDEN',
  'CAPACITY_CANNOT_PRODUCE_GPUV',
  'INCOMPATIBLE_UNIT',
] as const;
export type InfrastructureRejectionCode = (typeof INFRASTRUCTURE_REJECTION_CODES)[number];

export type InfrastructureRefusal = {
  readonly code: InfrastructureRejectionCode;
  readonly detail: string;
};

export type InfrastructureIdentity = {
  readonly facilityId: string;
  readonly terminalId: string | null;
};

export type InfrastructureIdentityRefs = {
  readonly facilityRef: IdentityRef;
  readonly terminalRef: IdentityRef | null;
};

export type InfrastructureSourceRecord = {
  readonly identifier: string;
  readonly sourceClass: InfrastructureSourceClass;
  readonly factType: FactType;
  readonly numericValue: string;
  readonly unit: string;
  readonly facilityUnits: string;
  readonly measurementStartUnix: string;
  readonly measurementEndUnix: string;
  readonly usageState: InfrastructureUsageState;
  readonly infrastructureClass: InfrastructureClass;
  readonly unitSemantics: InfrastructureUnitSemantics;
  readonly schemaId: string;
  readonly schemaVersion: number;
  readonly controllerId: string;
  readonly upstreamOrganizationId: string;
  readonly operatorPartyId: string;
  readonly identity: InfrastructureIdentity;
  readonly sourceTimestampUnix: string;
  readonly extras?: Readonly<Record<string, unknown>> | undefined;
};

export type InfrastructureFabricPolicy = {
  readonly policyVersion: typeof INFRASTRUCTURE_FABRIC_POLICY_VERSION;
  readonly preferFacilityTime: true;
  readonly allowLegacyMachineHReproduction: boolean;
  readonly maximumObservationAgeSeconds: number;
  readonly productionActive: false;
  readonly realNetworkCalls: false;
  readonly automaticIssuance: false;
};

export type NormalizedInfrastructureObservation = {
  readonly schemaVersion: typeof INFRASTRUCTURE_FABRIC_SCHEMA_VERSION;
  readonly observationId: string;
  readonly sourceClass: InfrastructureSourceClass;
  readonly factType: InfrastructureFactType;
  readonly sourceCategory: DataSourceCategory;
  readonly productiveCategory: ProductiveCategory;
  readonly proposedClaimType: ClaimType | null;
  readonly usageState: InfrastructureUsageState;
  readonly infrastructureClass: InfrastructureClass;
  readonly unitSemantics: InfrastructureUnitSemantics;
  readonly sourceQuantity: ExactQuantity;
  readonly canonicalQuantity: ExactQuantity;
  readonly canonicalUnit: 'machine_h' | 'facility_hour';
  readonly facilityUnits: bigint;
  readonly durationSeconds: bigint;
  readonly identityRefs: InfrastructureIdentityRefs;
  readonly controllerId: string;
  readonly upstreamOrganizationId: string;
  readonly operatorPartyId: string;
  readonly independenceClass: InfrastructureIndependenceClass;
  readonly createsUsageEvent: boolean;
  readonly createsCapacityReference: boolean;
  readonly canCreateUsageClaim: boolean;
  readonly canMintMoonRey: false;
  readonly canAutomaticallyProduceGpuv: false;
  readonly legacyMachineHReinterpreted: false;
  readonly productionActive: false;
};

export type InfrastructureEvidenceRecord = {
  readonly schemaVersion: typeof INFRASTRUCTURE_FABRIC_SCHEMA_VERSION;
  readonly fabricPolicyVersion: typeof INFRASTRUCTURE_FABRIC_POLICY_VERSION;
  readonly observation: NormalizedInfrastructureObservation;
  readonly eventId: string | null;
  readonly claimType: ClaimType | null;
  readonly automaticIssuance: false;
  readonly verified: false;
  readonly issued: false;
  readonly certificationAuthorizesMoonRey: false;
  readonly realProviderContacted: false;
  readonly productionActive: false;
};

export function defaultInfrastructureFabricPolicy(): InfrastructureFabricPolicy {
  return Object.freeze({
    policyVersion: INFRASTRUCTURE_FABRIC_POLICY_VERSION,
    preferFacilityTime: true,
    allowLegacyMachineHReproduction: true,
    maximumObservationAgeSeconds: 86_400,
    productionActive: false,
    realNetworkCalls: false,
    automaticIssuance: false,
  });
}

export function isInfrastructureSourceClass(value: string): value is InfrastructureSourceClass {
  return (INFRASTRUCTURE_SOURCE_CLASSES as readonly string[]).includes(value);
}

export function isInfrastructureFactType(value: string): value is InfrastructureFactType {
  return (INFRASTRUCTURE_FACT_TYPES as readonly string[]).includes(value);
}

export function isInfrastructureClass(value: string): value is InfrastructureClass {
  return (INFRASTRUCTURE_CLASSES as readonly string[]).includes(value);
}

export function isInfrastructureUsageState(value: string): value is InfrastructureUsageState {
  return (INFRASTRUCTURE_USAGE_STATES as readonly string[]).includes(value);
}

export function isRealizedInfrastructureState(value: string): value is RealizedInfrastructureState {
  return (REALIZED_INFRASTRUCTURE_STATES as readonly string[]).includes(value);
}

export function infrastructureFactCannotAutoMint(): false {
  return INFRASTRUCTURE_FACT_AUTO_MINTS;
}

export function infrastructureProductionIsActive(): false {
  return INFRASTRUCTURE_PRODUCTION_ACTIVE;
}

export function infrastructureRealProviderContacted(): false {
  return INFRASTRUCTURE_REAL_PROVIDER_CONTACTED;
}

export function legacyMachineHReinterpreted(): false {
  return LEGACY_MACHINE_H_REINTERPRETED;
}

export function capacityEqualsRealizedUse(): false {
  return CAPACITY_EQUALS_REALIZED_USE;
}

export function unitCodeIsFacilityHour(unit: string): unit is Extract<UnitCode, 'facility_hour'> {
  return unit === 'facility_hour';
}

export function unitCodeIsLegacyMachineH(unit: string): unit is Extract<UnitCode, 'machine_h'> {
  return unit === 'machine_h';
}
