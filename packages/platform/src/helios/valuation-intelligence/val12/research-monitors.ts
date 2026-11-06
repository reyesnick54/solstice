import type { ValuationResearchMonitorTrigger } from './types.ts';
import type { ValuationGapSummary } from './types.ts';

export function evaluateValuationResearchMonitors(input: {
  readonly priorGapMedianMinor: bigint | null;
  readonly currentGap: ValuationGapSummary | null;
  readonly reverseDcfGrowthGapBps: number | null;
  readonly crossModelDispersion: number;
  readonly priorCrossModelDispersion: number | null;
  readonly earningsShiftMaterial: boolean;
  readonly waccShockMaterial: boolean;
  readonly peerRegimeReprice: boolean;
  readonly sotpSegmentShiftMaterial: boolean;
}): readonly ValuationResearchMonitorTrigger[] {
  const triggers: ValuationResearchMonitorTrigger[] = [];
  const push = (monitorId: string, reason: string, severity: 'LOW' | 'MEDIUM' | 'HIGH') => {
    triggers.push(
      Object.freeze({
        monitorId,
        reason,
        severity,
        routesTo: 'AGENT_RESEARCH' as const,
        grantsExecutionAuthority: false as const,
      }),
    );
  };

  if (
    input.priorGapMedianMinor != null &&
    input.currentGap &&
    Number(input.currentGap.medianValueGapMinor - input.priorGapMedianMinor) > 500
  ) {
    push('valuation_gap_widen', 'Valuation gap widened materially vs prior observation', 'HIGH');
  }

  if (input.reverseDcfGrowthGapBps != null && Math.abs(input.reverseDcfGrowthGapBps) > 250) {
    push(
      'reverse_dcf_growth_divergence',
      'Market-implied growth diverges from HELIOS forecast band',
      'MEDIUM',
    );
  }

  if (input.priorCrossModelDispersion != null) {
    const delta = Math.abs(input.crossModelDispersion - input.priorCrossModelDispersion);
    if (delta > 0.12) {
      push(
        'cross_model_dispersion_shift',
        'Cross-model dispersion expanded or collapsed materially',
        'MEDIUM',
      );
    }
  }

  if (input.earningsShiftMaterial) {
    push(
      'earnings_distribution_shift',
      'Earnings update materially shifted intrinsic distribution',
      'HIGH',
    );
  }
  if (input.waccShockMaterial) {
    push('wacc_shock', 'WACC shock changed valuation materially', 'HIGH');
  }
  if (input.peerRegimeReprice) {
    push('peer_regime_reprice', 'Peer regime repriced comparable-implied value', 'MEDIUM');
  }
  if (input.sotpSegmentShiftMaterial) {
    push('sotp_segment_shift', 'SOTP segment contribution changed materially', 'MEDIUM');
  }

  return Object.freeze(triggers);
}
