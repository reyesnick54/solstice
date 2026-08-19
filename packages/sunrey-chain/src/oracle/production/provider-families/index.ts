export * from './logistics/index.ts';
export {
  ingestResourceRecord,
  ingestResourceRecords,
  identifyExtractionEvents,
  resourceFactCannotAutoMint,
  runResourceDataFabricDemo,
} from './resources/index.ts';
export type { ResourceExtractionEvidenceRecord } from './resources/index.ts';
export {
  ingestAgricultureRecord,
  ingestAgricultureRecords,
  identifyHarvestEvents,
  agricultureFactCannotAutoMint,
  runAgricultureWaterDataFabricDemo,
} from './agriculture/index.ts';
export type { AgricultureHarvestEvidenceRecord } from './agriculture/index.ts';
export {
  ingestWaterRecord,
  ingestWaterRecords,
  identifyWaterProductionEvents,
  waterFactCannotAutoMint,
} from './water/index.ts';
export type { WaterProductionEvidenceRecord } from './water/index.ts';
