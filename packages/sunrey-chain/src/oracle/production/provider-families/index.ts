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
  GoodsCommerceDataFabric,
  ingestGoodsObservation,
  goodsFactCannotAutoMint,
} from './goods/index.ts';
export type { GoodsSourceObservation } from './goods/index.ts';
export {
  ServicesDataFabric,
  ingestServiceObservation,
  serviceFactCannotAutoMint,
} from './service-delivery/index.ts';
export type { ServiceSourceObservation } from './service-delivery/index.ts';
