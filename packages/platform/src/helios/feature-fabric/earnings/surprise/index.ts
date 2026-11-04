export {
  HELIOS_EARN03_SURPRISE_TENSOR_SCHEMA,
  EARNINGS_SURPRISE_DIMENSIONS,
  EARNINGS_EXPECTATION_SOURCES,
  EARNINGS_SURPRISE_METHODS,
  BEAT_QUALITY_DRIVERS,
  PEER_NORMALIZATION_SCOPES,
  EARN03_FORMULA_VERSION,
  DIMENSION_VALUE_KIND,
  isMarginOrRatioDimension,
  methodsForDimension,
  type EarningsSurpriseDimension,
  type EarningsExpectationSource,
  type EarningsSurpriseMethod,
  type BeatQualityDriver,
  type PeerNormalizationScope,
} from './taxonomy.ts';

export type {
  ScaledSurprise,
  EarningsSurpriseQualityState,
  EarningsSurpriseQuality,
  ExpectationPointInput,
  ExpectationDispersionInput,
  PreReleaseExpectationSnapshot,
  EarningsActualInput,
  SeasonalHistoryInput,
  EarningsSurpriseCellKey,
  EarningsSurpriseDecomposition,
  BeatQualityLine,
  BeatQualityDecomposition,
  PeerSurpriseNormalization,
  EarningsSurpriseTensor,
  EarningsSurpriseVectorSlot,
  EarningsSurpriseVector,
  BuildSurpriseTensorInput,
} from './types.ts';

export {
  buildPreReleaseExpectationSnapshot,
  filterExpectationsAtCutoff,
  pointsForSource,
  dispersionForSource,
  assertExpectationSnapshotPreEvent,
  dimensionKey,
  type ExpectationSnapshotBuildInput,
} from './expectation.ts';

export {
  computeConsensusDispersionSue,
  computePriceScaledSurprise,
  computeHistoricalSeasonalSue,
  computeRobustMedianSue,
  computeGuidanceMidpointVsPrior,
  computeGuidanceMidpointVsConsensus,
} from './sue-methods.ts';

export { buildBeatQualityDecomposition, isOperatingQualityDriver } from './beat-quality.ts';
export { buildEarningsSurpriseTensor } from './tensor.ts';
export { computePeerNormalizations } from './peer-normalization.ts';
export {
  buildEarningsSurpriseVector,
  assertNoMixedSourceScalar,
  vectorSlotId,
} from './vector.ts';
export { compileEarningsSurprisePlane, createEarningsSurpriseFabric } from './fabric.ts';
export {
  HELIOS_EARN03_SURPRISE_TENSOR_QUALIFIED,
  HELIOS_EARN03_SURPRISE_TENSOR_BLOCKED,
  evaluateEarn03Qualification,
  type Earn03QualificationChecks,
  type Earn03QualificationResult,
} from './qualification.ts';

export {
  EARN03_FIXTURE_ENTITY,
  EARN03_FIXTURE_PERIOD,
  earn03FixtureTimes,
  earn03OperatingBeatExpectationFixture,
  earn03OperatingBeatTensorFixture,
  earn03BuybackBeatTensorFixture,
  earn03FutureExpectationLeakFixture,
} from './fixtures.ts';
