import {
  HELIOS_EARN07_OPTIONS_INTELLIGENCE_AUTHORITY,
  HELIOS_EARN07_OPTIONS_INTELLIGENCE_SCHEMA,
  OPTIONS_EXECUTION_MODE,
} from './taxonomy.ts';
import type {
  OptionsDataQualityReport,
  OptionsEarningsExpectationState,
  OptionsPreEventMetrics,
  OptionChainSnapshot,
} from './types.ts';

function assessDataQuality(snapshot: OptionChainSnapshot, metrics: OptionsPreEventMetrics): OptionsDataQualityReport {
  const missing: string[] = [];
  if (metrics.ATMStraddleImpliedMoveBps === null) {
    missing.push('ATMStraddleImpliedMove');
  }
  if (metrics.NearTermIVBps === null) {
    missing.push('NearTermIV');
  }
  if (snapshot.contracts.length === 0) {
    missing.push('contracts');
  }
  let state: OptionsDataQualityReport['state'] = 'VALID';
  if (snapshot.contracts.length === 0) {
    state = 'UNAVAILABLE';
  } else if (missing.length > 2) {
    state = 'DEGRADED_INCOMPLETE_CHAIN';
  } else if (missing.length > 0) {
    state = 'DEGRADED_MISSING_GREEKS';
  }
  return Object.freeze({
    state,
    missingFields: Object.freeze(missing),
    chainObservationCount: snapshot.contracts.length,
  });
}

export function buildOptionsEarningsExpectationState(input: {
  readonly snapshot: OptionChainSnapshot;
  readonly metrics: OptionsPreEventMetrics;
}): OptionsEarningsExpectationState {
  const { snapshot, metrics } = input;
  const dataQuality = assessDataQuality(snapshot, metrics);
  const central =
    metrics.ATMStraddleImpliedMoveBps ?? metrics.IVExpectedMoveBps ?? null;
  return Object.freeze({
    schema: HELIOS_EARN07_OPTIONS_INTELLIGENCE_SCHEMA,
    authority: HELIOS_EARN07_OPTIONS_INTELLIGENCE_AUTHORITY,
    executionMode: OPTIONS_EXECUTION_MODE,
    earningsEventId: snapshot.earningsEventId,
    underlyingInstrumentId: snapshot.underlyingInstrumentId,
    evaluationTime: metrics.evaluationTime,
    snapshotId: snapshot.snapshotId,
    impliedMoveDistribution: Object.freeze({
      centralMoveBps: central,
      straddleImpliedMoveBps: metrics.ATMStraddleImpliedMoveBps,
      ivExpectedMoveBps: metrics.IVExpectedMoveBps,
      confidenceBandBps:
        metrics.ATMStraddleImpliedMoveBps !== null && metrics.IVExpectedMoveBps !== null
          ? Math.abs(metrics.ATMStraddleImpliedMoveBps - metrics.IVExpectedMoveBps)
          : null,
    }),
    directionalDemandState: Object.freeze({
      callPutVolumeImbalanceScaled: metrics.CallPutDemandImbalanceScaled,
      directionalCallVolume: metrics.DirectionalCallVolume,
      directionalPutVolume: metrics.DirectionalPutVolume,
      putCallVolumeRatioScaled: metrics.PutCallVolumeRatioScaled,
      narrativeHint: null,
    }),
    volatilityRiskState: Object.freeze({
      nearTermIVBps: metrics.NearTermIVBps,
      postEventIVProxyBps: metrics.PostEventIVProxyBps,
      ivTermStructureBps: metrics.IVTermStructureBps,
      ivEventPremiumBps: metrics.IVEventPremiumBps,
      ivRankBps: metrics.IVRankBps,
      ivPercentileBps: metrics.IVPercentileBps,
    }),
    skewState: Object.freeze({
      callSkewBps: metrics.CallSkewBps,
      putSkewBps: metrics.PutSkewBps,
    }),
    liquidityState: Object.freeze({
      volumeToOpenInterestScaled: metrics.VolumeToOpenInterestScaled,
      abnormalOptionsVolumeScaled: metrics.AbnormalOptionsVolumeScaled,
    }),
    dataQuality,
    preEventMetrics: metrics,
    grantsExecutionAuthority: false,
  });
}
