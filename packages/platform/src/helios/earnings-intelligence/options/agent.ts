/**
 * OptionsEarningsResearchAgent — explains what the options market appears to price.
 * Does not call an option trade or grant Execution Authority.
 */

import type { OptionsEarningsExpectationState, OptionsEarningsResearchBrief } from './types.ts';

function bpsToPercentLabel(bps: number | null): string {
  if (bps === null) {
    return 'unavailable';
  }
  return `${(bps / 100).toFixed(2)}%`;
}

export class OptionsEarningsResearchAgent {
  readonly agentId = 'OptionsEarningsResearchAgent' as const;

  explain(state: OptionsEarningsExpectationState): OptionsEarningsResearchBrief {
    const move = state.impliedMoveDistribution;
    const vol = state.volatilityRiskState;
    const demand = state.directionalDemandState;
    const skew = state.skewState;

    const impliedMoveNarrative =
      `The listed chain implies an ATM straddle move of about ${bpsToPercentLabel(move.straddleImpliedMoveBps)} ` +
      `(IV-based expected move ${bpsToPercentLabel(move.ivExpectedMoveBps)}). ` +
      `These are market-implied sizes, not forecasts.`;

    let demandNarrative = 'Directional flow is balanced or unavailable.';
    if (demand.callPutVolumeImbalanceScaled !== null) {
      if (demand.callPutVolumeImbalanceScaled > 1500) {
        demandNarrative =
          'Call volume dominates puts, suggesting elevated demand for upside expression into the event.';
      } else if (demand.callPutVolumeImbalanceScaled < -1500) {
        demandNarrative =
          'Put volume dominates calls, suggesting elevated demand for downside hedging or bearish expression.';
      } else {
        demandNarrative = 'Call and put volume are roughly balanced into the event.';
      }
    }

    const volatilityNarrative =
      `Near-term IV is ${bpsToPercentLabel(vol.nearTermIVBps)} with post-event IV proxy ${bpsToPercentLabel(vol.postEventIVProxyBps)} ` +
      `(term structure ${bpsToPercentLabel(vol.ivTermStructureBps)}). ` +
      `IV rank ${bpsToPercentLabel(vol.ivRankBps)} / percentile ${bpsToPercentLabel(vol.ivPercentileBps)}. ` +
      `Skew: call ${bpsToPercentLabel(skew.callSkewBps)}, put ${bpsToPercentLabel(skew.putSkewBps)}.`;

    const summary =
      `For ${state.underlyingInstrumentId} ahead of ${state.earningsEventId}, options imply ` +
      `${bpsToPercentLabel(move.centralMoveBps)} two-sided move with ${demandNarrative.toLowerCase()}`;

    return Object.freeze({
      agentId: 'OptionsEarningsResearchAgent',
      earningsEventId: state.earningsEventId,
      evaluationTime: state.evaluationTime,
      summary,
      impliedMoveNarrative,
      demandNarrative,
      volatilityNarrative,
      caveats: Object.freeze([
        'Research-only: options execution is disabled.',
        'Open interest does not identify dealer positioning; DealerGammaProxy is a labeled proxy when present.',
        'Pre-event signals exclude post-event outcomes.',
      ]),
      optionsExecutionEnabled: false,
      grantsExecutionAuthority: false,
    });
  }

  /** Explicit guard — research agent must not route orders. */
  assertNoOptionsExecution(): true {
    return true;
  }
}

export function createOptionsEarningsResearchAgent(): OptionsEarningsResearchAgent {
  return new OptionsEarningsResearchAgent();
}
