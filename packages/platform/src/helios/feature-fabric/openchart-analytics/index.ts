/**
 * HELIOS NATIVE07 — OpenChart market analytics (native TypeScript port).
 * Upstream reference: vendor/assimilation/openchart @ 8109466b (MIT).
 */

export {
  OHLCV_BAR_COLUMNS,
  isValidOhlcvBar,
  type OhlcvBar,
  type OhlcvBarColumn,
} from './market/bar.ts';

export {
  barTimeInRange,
  parseTimeRange,
  type TimeRange,
  type TimeRangeValidation,
} from './timeseries/time-range.ts';

export {
  buildPointSeries,
  type BuiltPointRow,
  type PointRow,
  type PointSeries,
  type PointSeriesLabels,
  type PointValue,
} from './timeseries/point-series.ts';

export { closeSeries, createOhlcvSeries, type OhlcvSeries } from './timeseries/ohlcv-series.ts';

export {
  computeAtr,
  computeEma,
  computeMacd,
  computeRsi,
  computeSma,
  crossunder,
  crossover,
  type MacdResult,
} from './indicators/math.ts';

export {
  createStreamingEma,
  createStreamingSma,
  emaSeriesViaStreaming,
  pushStreamingEma,
  pushStreamingSma,
  smaSeriesViaStreaming,
  streamingMatchesBatchSma,
  type StreamingEmaState,
  type StreamingSmaState,
} from './indicators/streaming.ts';

export {
  NATIVE_STUDY_CATALOG,
  OPENCHART_NATIVE_STUDY_IDS,
  type NativeStudyDefinition,
  type OpenChartNativeStudyId,
  type StudyParameterSpec,
} from './indicators/study-catalog.ts';

export {
  applyFeedBarUpdate,
  applyFeedSnapshot,
  asFeedVersion,
  type FeedBarSnapshot,
  type FeedBarUpdate,
  type FeedVersion,
  type StreamingFeatureFeedState,
} from './feed/snapshot-update.ts';

export {
  MARKET_LOGIC_OPERATORS,
  validateMarketLogicExpression,
  type MarketLogicExpression,
  type MarketLogicOperator,
  type MarketLogicValidation,
  type MarketValueRef,
} from './conditions/market-expression.ts';

export {
  TEA_ALERT_TYPE_ID,
  evaluateAlertableCondition,
  isTeaAlertTypeId,
  type AlertableCondition,
  type AlertableEvaluation,
  type AlertEventPayload,
} from './conditions/alertable.ts';

export {
  FROM_POINTS_PARITY,
  OPENCHART_UPSTREAM_SHA,
  TEA_SMA_LENGTH2_CLOSES,
  TEA_SMA_LENGTH2_EXPECTED,
  TEA_SMA_WINDOWED_EXPECTED,
  teaRunSampleBars,
} from './fixtures/parity-fixtures.ts';

export {
  HELIOS_NATIVE_OPENCHART_ANALYTICS_BLOCKED,
  HELIOS_NATIVE_OPENCHART_ANALYTICS_QUALIFIED,
  evaluateOpenChartAnalyticsQualification,
  type OpenChartAnalyticsQualificationChecks,
  type OpenChartAnalyticsQualificationResult,
} from './qualification.ts';
