/**
 * Chunk 131 — manufacturing, industrial automation, and robotics
 * economic-data fabric types.
 *
 * Read-only economic evidence. This path never commands industrial
 * equipment and never mints MoonRey.
 */

import type { FactType, UnitCode } from '../../../types.ts';
import type { ProductiveCategory } from '../../../../productive/types.ts';

export const MANUFACTURING_FABRIC_VERSION = 'sunrey.manufacturing-robotics-data-fabric.v1' as const;

export const INDUSTRIAL_CONTROL_COMMANDS_AVAILABLE = false as const;
export const SAME_BATCH_MULTIPLE_FULL_CREDITS = false as const;
export const MACHINE_RUNTIME_EQUALS_OUTPUT = false as const;
export const REAL_FACTORY_CONTACTED = false as const;
export const PRODUCTION_ACTIVE = false as const;
export const MANUFACTURING_FACT_AUTO_MINTS = false as const;
export const QUALITY_SYSTEM_CAN_MINT = false as const;

export const MANUFACTURING_SOURCE_CLASSES = [
  'MES',
  'ERP_PRODUCTION_LEDGER',
  'SCADA_READ_ONLY_GATEWAY',
  'PLC_READ_ONLY_TELEMETRY',
  'ROBOT_CONTROLLER_TELEMETRY',
  'MACHINE_DATA_HISTORIAN',
  'QUALITY_MANAGEMENT_SYSTEM',
  'WEIGH_SCALE',
  'VISION_INSPECTION_ATTESTATION',
  'WAREHOUSE_PRODUCTION_HANDOFF',
] as const;
export type ManufacturingSourceClass = (typeof MANUFACTURING_SOURCE_CLASSES)[number];

export const MANUFACTURING_OUTPUT_FACT_TYPES = [
  'MANUFACTURING_OUTPUT',
  'AUTOMATED_MACHINE_OUTPUT',
] as const;
export type ManufacturingOutputFactType = (typeof MANUFACTURING_OUTPUT_FACT_TYPES)[number];

export const MANUFACTURING_FACT_TYPES = [
  'MANUFACTURING_CAPACITY',
  'MANUFACTURING_OUTPUT',
  'AUTOMATED_MACHINE_OUTPUT',
] as const;
export type ManufacturingFactType = (typeof MANUFACTURING_FACT_TYPES)[number];

export const GOODS_LINEAGE_FACT_TYPE = 'GOODS_OUTPUT' as const;

export const OUTPUT_STATES = ['GOOD_OUTPUT', 'SCRAP', 'REWORK', 'WORK_IN_PROGRESS'] as const;
export type OutputState = (typeof OUTPUT_STATES)[number];

export const REALIZED_EVIDENCE_KINDS = [
  'COMPLETED_QUANTITY',
  'OUTPUT_MEASUREMENT',
  'BATCH_COMPLETION',
  'WEIGH_SCALE_READING',
  'ACCEPTED_PRODUCTION_RECORD',
  'GOVERNED_MEASUREMENT',
] as const;
export type RealizedEvidenceKind = (typeof REALIZED_EVIDENCE_KINDS)[number];

export const ORDER_LIFECYCLE_STATES = ['CREATED', 'SCHEDULED', 'RELEASED'] as const;
export type OrderLifecycleState = (typeof ORDER_LIFECYCLE_STATES)[number];

export const COUNTER_KINDS = ['INTERVAL_OUTPUT', 'CUMULATIVE_LIFETIME'] as const;
export type CounterKind = (typeof COUNTER_KINDS)[number];

export const MACHINE_ACTIVITY_KINDS = ['ONLINE', 'RUNTIME', 'MOTION', 'CYCLE_TIME'] as const;
export type MachineActivityKind = (typeof MACHINE_ACTIVITY_KINDS)[number];

export const MANUFACTURING_IDENTITY_KINDS = [
  'factory',
  'production_line',
  'work_center',
  'machine',
  'robot',
  'production_order',
  'batch',
  'lot',
  'output_batch',
] as const;
export type ManufacturingIdentityKind = (typeof MANUFACTURING_IDENTITY_KINDS)[number];

export const FORBIDDEN_INDUSTRIAL_CONTROL_METHODS = [
  'writePlc',
  'writeRegister',
  'commandRobot',
  'commandScada',
  'startMachine',
  'stopMachine',
  'actuate',
  'updateFirmware',
  'overrideSafety',
] as const;

export const FORBIDDEN_PAYLOAD_KEYS = [
  'plcMemoryDump',
  'machineRecipe',
  'cadFile',
  'processSettings',
  'robotProgram',
  'factoryCredential',
  'apiKey',
  'password',
  'secret',
  'plcWrite',
  'motionCommand',
  'scadaCommand',
  'actuatorCommand',
] as const;

export const MANUFACTURING_REJECTION_CODES = [
  'PRODUCTION_ORDER_IS_NOT_OUTPUT',
  'MACHINE_RUNTIME_IS_NOT_OUTPUT',
  'MACHINE_TIME_CANNOT_BECOME_UNIT',
  'MACHINE_ONLINE_IS_NOT_OUTPUT',
  'SCRAP_IS_NOT_ACCEPTED_OUTPUT',
  'REWORK_IS_NOT_COMPLETED_OUTPUT',
  'WIP_IS_NOT_COMPLETED_OUTPUT',
  'COUNTER_RESET',
  'COUNTER_LIFETIME_IS_NOT_PERIOD',
  'SAME_CONTROLLER_FAKE_QUORUM',
  'INDEPENDENT_OUTPUT_SAME_BATCH',
  'RAW_INDUSTRIAL_CONTROL_PAYLOAD',
  'MACHINE_SECRET_FORBIDDEN',
  'SCHEMA_DRIFT',
  'FLOAT_FORBIDDEN',
  'UNBOUNDED_ARRAY',
  'CREDENTIAL_LEAK',
  'PUBLIC_INDUSTRIAL_NETWORK_FORBIDDEN',
  'QUALITY_CANNOT_MINT',
  'BATCH_SPLIT_OVERALLOCATION',
  'MISSING_MACHINE_IDENTITY',
  'MISSING_MEASUREMENT_PERIOD',
  'MISSING_OUTPUT_QUANTITY',
  'MISSING_OUTPUT_SEMANTIC',
  'MISSING_ECONOMIC_EVENT_REF',
  'MISSING_REALIZED_EVIDENCE',
  'FACT_TYPES_MUST_REMAIN_DISTINCT',
  'WRONG_UNIT',
  'WRONG_NUMERIC_REPRESENTATION',
  'INVALID_IDENTIFIER',
  'RECORD_OVERSIZED',
] as const;
export type ManufacturingRejectionCode = (typeof MANUFACTURING_REJECTION_CODES)[number];

export type ManufacturingRejection = {
  readonly code: ManufacturingRejectionCode;
  readonly detail: string;
};

export type ManufacturingIdentityRefs = {
  readonly factoryRef: string | null;
  readonly productionLineRef: string | null;
  readonly workCenterRef: string | null;
  readonly machineRef: string | null;
  readonly robotRef: string | null;
  readonly productionOrderRef: string | null;
  readonly batchRef: string | null;
  readonly lotRef: string | null;
  readonly outputBatchRef: string | null;
};

export type MeasurementWindow = {
  readonly fromUnixSeconds: bigint;
  readonly untilUnixSeconds: bigint;
};

export type MachineCounter = {
  readonly kind: CounterKind;
  readonly reading: bigint;
  readonly previousReading?: bigint | undefined;
  readonly rolloverMax?: bigint | undefined;
  readonly resetDocumented?: boolean | undefined;
};

export type DeviceProvenance = {
  readonly machineIdentityRef: string | null;
  readonly gatewayIdentityRef: string | null;
  readonly firmwareHash: string | null;
  readonly calibrationRef: string | null;
  readonly deviceAttestationRef: string | null;
  readonly attestationFabricated: false;
};

export type QualityAttestation = {
  readonly attestationRef: string;
  readonly accepted: boolean;
  readonly inspectorControllerId: string | null;
  readonly authorizesMint: false;
};

export type MassBalanceEvidence = {
  readonly inputMassCanonicalG: bigint;
  readonly outputMassCanonicalG: bigint;
  readonly scrapOrWasteCanonicalG: bigint;
  readonly toleranceCanonicalG: bigint;
  readonly requiresPerfectEquality: false;
};

export type ManufacturingObservation = {
  readonly observationId: string;
  readonly sourceClass: ManufacturingSourceClass;
  readonly factType: FactType;
  readonly productiveCategory: ProductiveCategory;
  readonly schemaId: string;
  readonly schemaVersion: number;
  readonly identifier: string;
  readonly numericValue: string;
  readonly unit: UnitCode | string;
  readonly sourceTimestampUnix: string;
  readonly outputState: OutputState;
  readonly realizedEvidenceKind: RealizedEvidenceKind | null;
  readonly orderLifecycleState: OrderLifecycleState | null;
  readonly machineActivityKind: MachineActivityKind | null;
  readonly identities: ManufacturingIdentityRefs;
  readonly measurementPeriod: MeasurementWindow | null;
  readonly controllerId: string;
  readonly upstreamOrganizationId: string;
  readonly sourceSystemId: string;
  readonly counter?: MachineCounter | undefined;
  readonly quality?: QualityAttestation | undefined;
  readonly deviceProvenance?: DeviceProvenance | undefined;
  readonly massBalance?: MassBalanceEvidence | undefined;
  readonly extras?: Readonly<Record<string, unknown>> | undefined;
  readonly rawPayloadPresent: false;
};

export function isManufacturingSourceClass(value: string): value is ManufacturingSourceClass {
  return (MANUFACTURING_SOURCE_CLASSES as readonly string[]).includes(value);
}

export function isManufacturingFactType(value: string): value is ManufacturingFactType {
  return (MANUFACTURING_FACT_TYPES as readonly string[]).includes(value);
}

export function industrialControlCommandsAvailable(): false {
  return INDUSTRIAL_CONTROL_COMMANDS_AVAILABLE;
}

export function manufacturingFactCannotAutoMint(): true {
  if (MANUFACTURING_FACT_AUTO_MINTS) {
    throw new Error('MANUFACTURING_FACT_AUTO_MINTS');
  }
  return true;
}

export function qualitySystemCannotMint(): true {
  if (QUALITY_SYSTEM_CAN_MINT) {
    throw new Error('QUALITY_SYSTEM_CAN_MINT');
  }
  return true;
}
