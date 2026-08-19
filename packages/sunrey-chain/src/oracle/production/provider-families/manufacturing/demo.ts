/**
 * Chunk 131 demo — sandbox factory manufacturing data fabric.
 *
 * MES completion, robot telemetry, quality attestation, and ERP output
 * batch observe one underlying manufacturing event. A later logistics
 * movement is a distinct service and is not part of this chunk.
 */

import { ManufacturingDataFabric } from './adapter.ts';
import { sandboxFactoryScenario } from './fixtures.ts';
import {
  INDUSTRIAL_CONTROL_COMMANDS_AVAILABLE,
  MACHINE_RUNTIME_EQUALS_OUTPUT,
  PRODUCTION_ACTIVE,
  REAL_FACTORY_CONTACTED,
  SAME_BATCH_MULTIPLE_FULL_CREDITS,
} from './types.ts';

const scenario = sandboxFactoryScenario();
const fabric = new ManufacturingDataFabric();
const mes = fabric.ingest(scenario.mes);
const robot = fabric.ingest(scenario.robot);
const quality = fabric.ingest(scenario.quality);
const erp = fabric.ingest(scenario.erp);
if (!mes.ok || !robot.ok || !quality.ok || !erp.ok) {
  const failed = [mes, robot, quality, erp].find((row) => !row.ok);
  throw new Error(failed && !failed.ok ? `${failed.error.code}: ${failed.error.detail}` : 'demo ingest failed');
}

const bound = fabric.bind([scenario.mes, scenario.robot, scenario.quality, scenario.erp]);
if (!bound.ok) {
  throw new Error(`${bound.error.code}: ${bound.error.detail}`);
}

const report = {
  observations: {
    mes: scenario.mes.observationId,
    robot: scenario.robot.observationId,
    quality: scenario.quality.observationId,
    erp: scenario.erp.observationId,
  },
  sourceClasses: bound.value.sourceClasses,
  underlyingEventId: bound.value.eventId,
  fullAttributionClaimCount: bound.value.fullAttributionClaimCount,
  laterLogisticsEventIncluded: false,
  INDUSTRIAL_CONTROL_COMMANDS_AVAILABLE,
  SAME_BATCH_MULTIPLE_FULL_CREDITS,
  MACHINE_RUNTIME_EQUALS_OUTPUT,
  REAL_FACTORY_CONTACTED,
  PRODUCTION_ACTIVE,
};

console.log('MoonRey manufacturing and robotics data fabric demo');
console.log('sandbox factory → MES completion → robot telemetry → quality attestation → ERP output batch');
console.log(JSON.stringify(report, null, 2));
console.log('INDUSTRIAL_CONTROL_COMMANDS_AVAILABLE=false');
console.log('SAME_BATCH_MULTIPLE_FULL_CREDITS=false');
console.log('MACHINE_RUNTIME_EQUALS_OUTPUT=false');
console.log('REAL_FACTORY_CONTACTED=false');
console.log('PRODUCTION_ACTIVE=false');
console.log('later logistics event is a distinct service and is not part of this chunk');
