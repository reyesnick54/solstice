/**
 * ALPHA01 bridge — counterfactual decision episodes map to forward alpha evidence lanes.
 * Portable DTOs only; canonical owner remains packages/strategy-lab/src/forward-alpha.
 */

import type { UtcInstant } from '@solstice/domain';

import {
  FORWARD_ALPHA_EVIDENCE_LANES,
  type ForwardAlphaEvidenceLane,
} from '@solstice/strategy-lab';

export const HELIOS_ALPHA01_CF_FORWARD_EVIDENCE_BRIDGE_SCHEMA =
  'sunrey.helios.alpha01.counterfactual-forward-bridge.v1' as const;

export type Alpha01CounterfactualForwardEvidenceRef = {
  readonly schema: typeof HELIOS_ALPHA01_CF_FORWARD_EVIDENCE_BRIDGE_SCHEMA;
  readonly episodeRef: string;
  readonly decisionAt: UtcInstant;
  readonly evidenceLane: ForwardAlphaEvidenceLane;
  readonly sealedBeforeOutcome: true;
  readonly mergesHistoricalAndForward: false;
};

export function toAlpha01CounterfactualForwardEvidenceRef(input: {
  readonly episodeRef: string;
  readonly decisionAt: UtcInstant;
  readonly lane: ForwardAlphaEvidenceLane;
}): Alpha01CounterfactualForwardEvidenceRef {
  if (!(FORWARD_ALPHA_EVIDENCE_LANES as readonly string[]).includes(input.lane)) {
    throw new Error('unknown forward alpha evidence lane');
  }
  if (input.lane === 'HISTORICAL_BACKTEST' || input.lane === 'WALK_FORWARD' || input.lane === 'SEALED_HOLDOUT') {
    throw new Error('counterfactual forward bridge accepts forward-only lanes');
  }
  return Object.freeze({
    schema: HELIOS_ALPHA01_CF_FORWARD_EVIDENCE_BRIDGE_SCHEMA,
    episodeRef: input.episodeRef,
    decisionAt: input.decisionAt,
    evidenceLane: input.lane,
    sealedBeforeOutcome: true,
    mergesHistoricalAndForward: false,
  });
}
