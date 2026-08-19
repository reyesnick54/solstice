/**
 * Manufacturing certification fixtures.
 *
 * Valid cases satisfy admission-shaped engineering checks.
 * Invalid cases stay refused. Certification does not mint.
 */

import { ingestManufacturingObservation } from './adapter.ts';
import { evaluateBatchSplit, refuseIndependentCreditsForSameBatch } from './lineage.ts';
import {
  machineRuntimeOnly,
  manufacturingObservation,
  scheduledOrderAsOutput,
  validCumulativeCounter,
  validMassOutputLine,
  validMesUnitOutput,
  validQualityAttestation,
  validRobotOutput,
} from './fixtures.ts';
import { SANDBOX_CONTROLLER, SANDBOX_ORG } from './fixtures.ts';
import { MANUFACTURING_SCHEMA_IDS } from './schemas.ts';
import { refuseMachineHoursAsUnit } from './machines.ts';
import type { ManufacturingObservation, ManufacturingRejection } from './types.ts';

export type ManufacturingCertificationCase = {
  readonly caseId: string;
  readonly valid: boolean;
  readonly observation?: ManufacturingObservation;
  readonly evaluate: () => { readonly ok: boolean; readonly code?: ManufacturingRejection['code'] };
};

function fromIngest(observation: ManufacturingObservation) {
  return () => {
    const result = ingestManufacturingObservation(observation);
    return result.ok ? { ok: true } : { ok: false, code: result.error.code };
  };
}

export const VALID_MANUFACTURING_CERTIFICATION_CASES: readonly ManufacturingCertificationCase[] = Object.freeze([
  {
    caseId: 'unit-output-mes',
    valid: true,
    observation: validMesUnitOutput(),
    evaluate: fromIngest(validMesUnitOutput()),
  },
  {
    caseId: 'mass-output-line',
    valid: true,
    observation: validMassOutputLine(),
    evaluate: fromIngest(validMassOutputLine()),
  },
  {
    caseId: 'robot-output',
    valid: true,
    observation: validRobotOutput(),
    evaluate: fromIngest(validRobotOutput()),
  },
  {
    caseId: 'cumulative-machine-counter-delta',
    valid: true,
    observation: validCumulativeCounter(),
    evaluate: fromIngest(validCumulativeCounter()),
  },
  {
    caseId: 'quality-attested-batch',
    valid: true,
    observation: validQualityAttestation(),
    evaluate: fromIngest(validQualityAttestation()),
  },
]);

export const INVALID_MANUFACTURING_CERTIFICATION_CASES: readonly ManufacturingCertificationCase[] = Object.freeze([
  {
    caseId: 'scheduled-order-as-output',
    valid: false,
    observation: scheduledOrderAsOutput(),
    evaluate: fromIngest(scheduledOrderAsOutput()),
  },
  {
    caseId: 'machine-h-converted-to-unit',
    valid: false,
    evaluate: () => {
      const refused = refuseMachineHoursAsUnit(3n);
      return { ok: false, code: refused.error.code };
    },
  },
  {
    caseId: 'scrap-as-accepted-output',
    valid: false,
    evaluate: fromIngest(
      manufacturingObservation({
        observationId: 'obs.mes.scrap',
        sourceClass: 'MES',
        outputState: 'SCRAP',
        realizedEvidenceKind: 'COMPLETED_QUANTITY',
      }),
    ),
  },
  {
    caseId: 'same-batch-mes-erp-independent-output',
    valid: false,
    evaluate: () => {
      const result = refuseIndependentCreditsForSameBatch([
        validMesUnitOutput(),
        manufacturingObservation({
          observationId: 'obs.erp.independent',
          sourceClass: 'ERP_PRODUCTION_LEDGER',
          factType: 'MANUFACTURING_OUTPUT',
          controllerId: SANDBOX_CONTROLLER,
          upstreamOrganizationId: SANDBOX_ORG,
        }),
      ]);
      return result.ok ? { ok: true } : { ok: false, code: result.error.code };
    },
  },
  {
    caseId: 'counter-reset',
    valid: false,
    evaluate: fromIngest(
      manufacturingObservation({
        observationId: 'obs.historian.reset',
        sourceClass: 'MACHINE_DATA_HISTORIAN',
        numericValue: '4',
        realizedEvidenceKind: 'OUTPUT_MEASUREMENT',
        counter: { kind: 'CUMULATIVE_LIFETIME', reading: 4n, previousReading: 1_100n },
      }),
    ),
  },
  {
    caseId: 'batch-split-over-allocation',
    valid: false,
    evaluate: () => {
      const result = evaluateBatchSplit({
        parentBatchRef: 'B1',
        parentQuantity: 100n,
        children: [
          { batchRef: 'B1A', quantity: 80n },
          { batchRef: 'B1B', quantity: 40n },
        ],
      });
      return result.ok ? { ok: true } : { ok: false, code: result.error.code };
    },
  },
  {
    caseId: 'raw-plc-control-payload',
    valid: false,
    evaluate: fromIngest(
      manufacturingObservation({
        observationId: 'obs.plc.raw',
        sourceClass: 'PLC_READ_ONLY_TELEMETRY',
        extras: { plcWrite: 'SET coil 12' },
      }),
    ),
  },
  {
    caseId: 'credential-leak',
    valid: false,
    evaluate: fromIngest(
      manufacturingObservation({
        observationId: 'obs.mes.secret',
        sourceClass: 'MES',
        extras: { accessToken: 'sandbox-not-a-real-secret' },
      }),
    ),
  },
  {
    caseId: 'schema-drift',
    valid: false,
    evaluate: fromIngest(
      manufacturingObservation({
        observationId: 'obs.mes.drift',
        sourceClass: 'MES',
        schemaId: `${MANUFACTURING_SCHEMA_IDS.MES}.changed`,
        schemaVersion: 2,
      }),
    ),
  },
  {
    caseId: 'float-quantity',
    valid: false,
    evaluate: fromIngest(
      manufacturingObservation({
        observationId: 'obs.mes.float',
        sourceClass: 'MES',
        numericValue: '12.5',
      }),
    ),
  },
  {
    caseId: 'unbounded-array',
    valid: false,
    evaluate: fromIngest(
      manufacturingObservation({
        observationId: 'obs.mes.array',
        sourceClass: 'MES',
        extras: { tags: Array.from({ length: 64 }, (_, index) => `tag-${index}`) },
      }),
    ),
  },
  {
    caseId: 'machine-runtime-as-output',
    valid: false,
    observation: machineRuntimeOnly(),
    evaluate: fromIngest(machineRuntimeOnly()),
  },
]);

export function evaluateManufacturingCertificationCase(caseId: string): { readonly ok: boolean; readonly code?: string } {
  const found = [...VALID_MANUFACTURING_CERTIFICATION_CASES, ...INVALID_MANUFACTURING_CERTIFICATION_CASES].find(
    (row) => row.caseId === caseId,
  );
  if (!found) {
    return { ok: false, code: 'SCHEMA_DRIFT' };
  }
  return found.evaluate();
}
