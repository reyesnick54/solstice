/**
 * demo:moonrey-productive-value-engine
 *
 * Demonstrates a verified ENERGY contribution through the Productive
 * Value pipeline, then a MANUFACTURING event with 40% attribution.
 * Does not mint MoonRey and does not activate production.
 */

import {
  PRODUCTIVE_VALUE_ENGINE_CAN_MINT,
  PRODUCTIVE_VALUE_ENGINE_ENGINEERING_IMPLEMENTED,
  PRODUCTIVE_VALUE_ENGINE_PRODUCTION_ACTIVATED,
  PRODUCTIVE_VALUE_UNIT,
  PRODUCTIVE_VALUE_UNIT_IS_MOONREY,
  PRODUCTIVE_VALUE_UNIT_IS_PHYSICAL_UNIT,
  evaluateProductiveValue,
  developmentValueFunctionPolicy,
  simulationBaseValueSchedule,
} from './index.ts';
import { engineAttribution, engineValueInput } from './fixtures.ts';

export function runMoonreyProductiveValueEngineDemo(): string {
  const policy = developmentValueFunctionPolicy();
  const schedule = simulationBaseValueSchedule();
  const energy = evaluateProductiveValue(engineValueInput('ENERGY'), { policy, schedule });
  const manufacturing = evaluateProductiveValue(
    engineValueInput('MANUFACTURING', {
      attributionDecision: engineAttribution('MANUFACTURING', 400_000n),
      availableAttributionShare: { numerator: 400_000n, denominator: 1_000_000n },
    }),
    { policy, schedule },
  );

  const energyResult = energy.result;
  const manufacturingResult = manufacturing.result;
  const lines = [
    'Governed MoonRey Productive Value Function — engine (Chunk 124)',
    '',
    'ENERGY pipeline',
    `  contribution=${energyResult?.contributionId ?? 'none'}`,
    `  canonical=${energyResult?.canonicalMeasurementQuantity.toString() ?? '?'} ${energyResult?.canonicalMeasurementUnit ?? '?'}`,
    `  event=${energyResult?.eventId ?? 'none'}`,
    `  attribution=${energyResult?.attributionShare.numerator.toString() ?? '?'}/${energyResult?.attributionShare.denominator.toString() ?? '?'}`,
    `  schedule=${energyResult?.baseValueScheduleId ?? 'none'} v${String(energyResult?.baseValueScheduleVersion ?? 0)}`,
    `  base=${energyResult?.baseProductiveValue.toString() ?? '?'} GPUV`,
    `  factors=${energyResult?.factorApplications.map((item) => `${item.factorType}:${item.value.toString()}`).join(',') ?? 'none'}`,
    `  final=${energyResult?.finalProductiveValue.toString() ?? '?'} GPUV state=${energy.state}`,
    '',
    'MANUFACTURING pipeline with 40% attribution',
    `  contribution=${manufacturingResult?.contributionId ?? 'none'}`,
    `  preAttribution=${manufacturingResult?.preAttributionValue.toString() ?? '?'} GPUV`,
    `  share=${manufacturingResult?.attributionShare.numerator.toString() ?? '?'}/${manufacturingResult?.attributionShare.denominator.toString() ?? '?'}`,
    `  final=${manufacturingResult?.finalProductiveValue.toString() ?? '?'} GPUV`,
    `  fortyPercentCannotTakeOneHundred=${String(
      manufacturingResult !== null && manufacturingResult.finalProductiveValue < manufacturingResult.preAttributionValue,
    )}`,
    '',
    `PRODUCTIVE_VALUE_ENGINE_ENGINEERING_IMPLEMENTED=${String(PRODUCTIVE_VALUE_ENGINE_ENGINEERING_IMPLEMENTED)}`,
    `VALUE_UNIT=${PRODUCTIVE_VALUE_UNIT.unitId}`,
    `GPUV_IS_PHYSICAL_UNIT=${String(PRODUCTIVE_VALUE_UNIT_IS_PHYSICAL_UNIT)}`,
    `GPUV_IS_MOONREY=${String(PRODUCTIVE_VALUE_UNIT_IS_MOONREY)}`,
    `ENGINE_CAN_MINT=${String(PRODUCTIVE_VALUE_ENGINE_CAN_MINT)}`,
    `PRODUCTION_ACTIVE=${String(PRODUCTIVE_VALUE_ENGINE_PRODUCTION_ACTIVATED)}`,
  ];
  return lines.join('\n');
}

const invoked = process.argv[1]?.includes('value-function/engine-demo');
if (invoked) {
  console.log(runMoonreyProductiveValueEngineDemo());
}
