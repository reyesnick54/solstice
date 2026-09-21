export {
  CORRELATION_METHODS,
  type CorrelationMethod,
  type CorrelationPair,
  type CorrelationCluster,
  type CorrelationMatrix,
} from './types.ts';
export {
  computeCorrelationMatrix,
  lookupPairCorrelation,
  __alignedLogReturnsForTest,
} from './compute.ts';
