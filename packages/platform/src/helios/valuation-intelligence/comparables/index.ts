export {
  VAL08_PROBABILISTIC_COMPARABLES_SCHEMA,
  VAL08_PROBABILISTIC_COMPARABLES_MODULE,
  HELIOS_VAL08_PROBABILISTIC_COMPARABLES_QUALIFIED,
  HELIOS_VAL08_PROBABILISTIC_COMPARABLES_BLOCKED,
  DEFAULT_VAL08_SEED,
  PEER_SELECTION_METHODS,
  COMPARABLE_MULTIPLE_KINDS,
  PEER_SIMILARITY_DIMENSIONS,
  PEER_EXCLUSION_REASONS,
  DEFAULT_WINSORIZE_FRACTION,
  DEFAULT_MAD_Z_THRESHOLD,
  type PeerSelectionMethod,
  type ComparableMultipleKind,
  type PeerSimilarityDimension,
  type PeerExclusionReason,
} from './taxonomy.ts';

export type {
  AccountingRegime,
  PeerFundamentalsSnapshot,
  PeerClassificationSnapshot,
  PeerMarketSnapshot,
  PeerCandidate,
  SimilarityDimensionValue,
  PeerSimilarityVector,
  PeerSelectionMethodScore,
  PeerSelectionState,
  PeerExclusionRecord,
  ComparableMultipleObservation,
  OutlierEvidence,
  JustifiedMultipleState,
  ComparableValuationDistribution,
  PeerQualityAssessment,
  PeerPanelManifest,
  PeerValuationDispersion,
  PeerConsensusStrength,
  PeerPanelFragility,
  ProbabilisticComparablesInput,
  ProbabilisticComparablesResult,
} from './types.ts';

export { runProbabilisticComparablesEngine } from './engine.ts';
export { buildPeerSimilarityVector, similarityFeatureVector } from './similarity.ts';
export { filterPeersKnowableAtValuationTime } from './point-in-time.ts';
export { runPeerSelection, defaultPeerSelectionConfig } from './peer-selection.ts';
export { computePeerMultiple, impliedValuesFromMultiple } from './multiples.ts';
export { buildJustifiedMultipleState, adjustObservationMultiple } from './justified-multiple.ts';
export { analyzeOutlier, defaultOutlierPolicy, isExtremeOutlier } from './outliers.ts';
export { assessCrossBorderComparability, applyCrossBorderFilters } from './cross-border.ts';
export {
  computePeerValuationDispersion,
  computePeerConsensusStrength,
  computePeerPanelFragility,
} from './disagreement.ts';
export { buildComparableValuationDistribution, applySeededCopulaSpread } from './valuation-distribution.ts';
export { assessPeerQuality } from './quality.ts';
export {
  fixtureProbabilisticComparablesInput,
  fixtureVal08Target,
  fixtureVal08PeerUniverse,
  FIXTURE_VAL08_VALUATION_TIME,
} from './fixtures.ts';
export {
  evaluateVal08ProbabilisticComparablesQualification,
  type Val08ProbabilisticComparablesQualificationChecks,
  type Val08ProbabilisticComparablesQualificationResult,
} from './qualification.ts';
