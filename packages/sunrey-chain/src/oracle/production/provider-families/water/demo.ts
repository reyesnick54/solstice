/**
 * Chunk 134 water-only helper used by the combined agriculture/water demo.
 * No real providers. No production activation. No MoonRey mint.
 */

import { ingestWaterRecord } from './adapter.ts';
import { certifyWaterSandbox } from './certification.ts';
import { simulationWaterPolicy, treatmentMeterRecord } from './fixtures.ts';
import { WATER_PRODUCTION_ACTIVE, WATER_REAL_PROVIDER_CONTACTED, waterFactCannotAutoMint } from './types.ts';

const NOW = 1_700_000_000n;

export function demonstrateWaterTreatmentProduction(): {
  readonly observationId: string;
  readonly createsProduction: boolean;
} {
  const ingested = ingestWaterRecord(treatmentMeterRecord(NOW), NOW, simulationWaterPolicy());
  if (!ingested.ok) {
    throw new Error(`${ingested.error.code}: ${ingested.error.detail}`);
  }
  const certified = certifyWaterSandbox('valid_treatment_production', NOW);
  void certified;
  void WATER_PRODUCTION_ACTIVE;
  void WATER_REAL_PROVIDER_CONTACTED;
  void waterFactCannotAutoMint();
  return Object.freeze({
    observationId: ingested.value.observation.observationId,
    createsProduction: ingested.value.observation.createsWaterProductionEvent,
  });
}
