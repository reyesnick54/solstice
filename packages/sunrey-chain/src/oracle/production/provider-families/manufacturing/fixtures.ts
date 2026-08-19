/**
 * Sandbox factory fixtures. Not commercial providers and not live plants.
 */

import { manufacturingIdentityRef } from './lineage.ts';
import { MANUFACTURING_SCHEMA_IDS } from './schemas.ts';
import type { ManufacturingObservation, OutputState, RealizedEvidenceKind } from './types.ts';

export const SANDBOX_NOW = 1_800_000_000n;
export const SANDBOX_UNTIL = 1_800_003_600n;
export const SANDBOX_FACTORY = 'factory.sandbox.1';
export const SANDBOX_LINE = 'line.sandbox.a';
export const SANDBOX_BATCH = 'batch.sandbox.B1';
export const SANDBOX_CONTROLLER = 'controller.sandbox.plant';
export const SANDBOX_ORG = 'org.sandbox.manufacturer';
export const INDEPENDENT_AUDITOR = 'controller.sandbox.weigh-auditor';

function identities(overrides: Partial<ManufacturingObservation['identities']> = {}) {
  return Object.freeze({
    factoryRef: manufacturingIdentityRef('factory', SANDBOX_FACTORY),
    productionLineRef: manufacturingIdentityRef('production_line', SANDBOX_LINE),
    workCenterRef: manufacturingIdentityRef('work_center', 'wc.7'),
    machineRef: manufacturingIdentityRef('machine', 'machine.cell-3'),
    robotRef: manufacturingIdentityRef('robot', 'robot.R1'),
    productionOrderRef: manufacturingIdentityRef('production_order', 'po.1001'),
    batchRef: manufacturingIdentityRef('batch', SANDBOX_BATCH),
    lotRef: manufacturingIdentityRef('lot', 'lot.B1'),
    outputBatchRef: manufacturingIdentityRef('output_batch', SANDBOX_BATCH),
    ...overrides,
  });
}

export function manufacturingObservation(
  overrides: Partial<ManufacturingObservation> & {
    readonly observationId: string;
    readonly sourceClass: ManufacturingObservation['sourceClass'];
    readonly factType?: ManufacturingObservation['factType'];
    readonly numericValue?: string;
    readonly unit?: string;
    readonly outputState?: OutputState;
    readonly realizedEvidenceKind?: RealizedEvidenceKind | null;
  },
): ManufacturingObservation {
  const sourceClass = overrides.sourceClass;
  return Object.freeze({
    observationId: overrides.observationId,
    sourceClass,
    factType: overrides.factType ?? 'MANUFACTURING_OUTPUT',
    productiveCategory: overrides.productiveCategory ?? 'MANUFACTURING',
    schemaId: overrides.schemaId ?? MANUFACTURING_SCHEMA_IDS[sourceClass],
    schemaVersion: overrides.schemaVersion ?? 1,
    identifier: overrides.identifier ?? 'factory_sandbox_1',
    numericValue: overrides.numericValue ?? '100',
    unit: overrides.unit ?? 'units_produced',
    sourceTimestampUnix: overrides.sourceTimestampUnix ?? SANDBOX_NOW.toString(),
    outputState: overrides.outputState ?? 'GOOD_OUTPUT',
    realizedEvidenceKind: overrides.realizedEvidenceKind === undefined ? 'COMPLETED_QUANTITY' : overrides.realizedEvidenceKind,
    orderLifecycleState: overrides.orderLifecycleState ?? null,
    machineActivityKind: overrides.machineActivityKind ?? null,
    identities: overrides.identities ?? identities(),
    measurementPeriod: overrides.measurementPeriod ?? {
      fromUnixSeconds: SANDBOX_NOW,
      untilUnixSeconds: SANDBOX_UNTIL,
    },
    controllerId: overrides.controllerId ?? SANDBOX_CONTROLLER,
    upstreamOrganizationId: overrides.upstreamOrganizationId ?? SANDBOX_ORG,
    sourceSystemId: overrides.sourceSystemId ?? `sys.${sourceClass.toLowerCase()}`,
    counter: overrides.counter,
    quality: overrides.quality,
    deviceProvenance: overrides.deviceProvenance,
    massBalance: overrides.massBalance,
    extras: overrides.extras,
    rawPayloadPresent: false,
  });
}

export function validMesUnitOutput(): ManufacturingObservation {
  return manufacturingObservation({
    observationId: 'obs.mes.B1',
    sourceClass: 'MES',
    factType: 'MANUFACTURING_OUTPUT',
    numericValue: '100',
    realizedEvidenceKind: 'BATCH_COMPLETION',
  });
}

export function validRobotOutput(): ManufacturingObservation {
  return manufacturingObservation({
    observationId: 'obs.robot.B1',
    sourceClass: 'ROBOT_CONTROLLER_TELEMETRY',
    factType: 'AUTOMATED_MACHINE_OUTPUT',
    productiveCategory: 'AUTOMATED_MACHINE_OUTPUT',
    numericValue: '100',
    realizedEvidenceKind: 'OUTPUT_MEASUREMENT',
    sourceSystemId: 'sys.robot.telemetry',
  });
}

export function validQualityAttestation(): ManufacturingObservation {
  return manufacturingObservation({
    observationId: 'obs.qms.B1',
    sourceClass: 'QUALITY_MANAGEMENT_SYSTEM',
    factType: 'MANUFACTURING_OUTPUT',
    numericValue: '100',
    realizedEvidenceKind: 'ACCEPTED_PRODUCTION_RECORD',
    quality: {
      attestationRef: 'attest.qms.B1.accepted',
      accepted: true,
      inspectorControllerId: SANDBOX_CONTROLLER,
      authorizesMint: false,
    },
  });
}

export function validErpOutputBatch(): ManufacturingObservation {
  return manufacturingObservation({
    observationId: 'obs.erp.B1',
    sourceClass: 'ERP_PRODUCTION_LEDGER',
    factType: 'GOODS_OUTPUT',
    productiveCategory: 'GOODS',
    schemaId: MANUFACTURING_SCHEMA_IDS.ERP_PRODUCTION_LEDGER,
    numericValue: '100',
    realizedEvidenceKind: 'ACCEPTED_PRODUCTION_RECORD',
  });
}

export function validMassOutputLine(): ManufacturingObservation {
  return manufacturingObservation({
    observationId: 'obs.weigh.B1',
    sourceClass: 'WEIGH_SCALE',
    factType: 'MANUFACTURING_OUTPUT',
    numericValue: '2',
    unit: 'tonne',
    realizedEvidenceKind: 'WEIGH_SCALE_READING',
    controllerId: INDEPENDENT_AUDITOR,
    upstreamOrganizationId: 'org.sandbox.auditor',
    massBalance: {
      inputMassCanonicalG: 2_050_000n,
      outputMassCanonicalG: 2_000_000n,
      scrapOrWasteCanonicalG: 40_000n,
      toleranceCanonicalG: 20_000n,
      requiresPerfectEquality: false,
    },
  });
}

export function validCumulativeCounter(): ManufacturingObservation {
  return manufacturingObservation({
    observationId: 'obs.historian.delta',
    sourceClass: 'MACHINE_DATA_HISTORIAN',
    factType: 'MANUFACTURING_OUTPUT',
    numericValue: '12',
    realizedEvidenceKind: 'OUTPUT_MEASUREMENT',
    counter: {
      kind: 'CUMULATIVE_LIFETIME',
      reading: 1_112n,
      previousReading: 1_100n,
    },
  });
}

export function scheduledOrderAsOutput(): ManufacturingObservation {
  return manufacturingObservation({
    observationId: 'obs.mes.scheduled',
    sourceClass: 'MES',
    factType: 'MANUFACTURING_OUTPUT',
    orderLifecycleState: 'SCHEDULED',
    realizedEvidenceKind: null,
    numericValue: '100',
  });
}

export function machineRuntimeOnly(): ManufacturingObservation {
  return manufacturingObservation({
    observationId: 'obs.robot.runtime',
    sourceClass: 'ROBOT_CONTROLLER_TELEMETRY',
    factType: 'AUTOMATED_MACHINE_OUTPUT',
    productiveCategory: 'AUTOMATED_MACHINE_OUTPUT',
    numericValue: '3',
    unit: 'machine_h',
    realizedEvidenceKind: 'OUTPUT_MEASUREMENT',
    machineActivityKind: 'RUNTIME',
    outputState: 'GOOD_OUTPUT',
  });
}

export function sandboxFactoryScenario(): {
  readonly mes: ManufacturingObservation;
  readonly robot: ManufacturingObservation;
  readonly quality: ManufacturingObservation;
  readonly erp: ManufacturingObservation;
} {
  return {
    mes: validMesUnitOutput(),
    robot: validRobotOutput(),
    quality: validQualityAttestation(),
    erp: validErpOutputBatch(),
  };
}
