/**
 * ALPHA01 bridge — chronological market data integrity for forward campaigns.
 */

import type { UtcInstant } from '@solstice/domain';
import type { ForwardAlphaEvidenceLane } from '@solstice/strategy-lab';

export const HELIOS_ALPHA01_MARKET_DATA_FORWARD_BRIDGE_SCHEMA =
  'sunrey.helios.alpha01.market-data-forward-bridge.v1' as const;

export type Alpha01ChronologicalMarketDataAttestation = {
  readonly schema: typeof HELIOS_ALPHA01_MARKET_DATA_FORWARD_BRIDGE_SCHEMA;
  readonly evidenceLane: ForwardAlphaEvidenceLane;
  readonly observationRef: string;
  readonly firstKnowableAt: UtcInstant;
  readonly lastKnowableAt: UtcInstant;
  readonly chronological: true;
  readonly syntheticReplay: boolean;
};

export function attestAlpha01ChronologicalMarketData(input: {
  readonly lane: ForwardAlphaEvidenceLane;
  readonly observationRef: string;
  readonly firstKnowableAt: UtcInstant;
  readonly lastKnowableAt: UtcInstant;
  readonly syntheticReplay: boolean;
}): Alpha01ChronologicalMarketDataAttestation {
  if (Date.parse(input.firstKnowableAt) > Date.parse(input.lastKnowableAt)) {
    throw new Error('market data attestation requires chronological knowableAt ordering');
  }
  if (input.syntheticReplay && input.lane !== 'HISTORICAL_BACKTEST' && input.lane !== 'WALK_FORWARD') {
    throw new Error('synthetic tick replay cannot attest forward evidence lanes');
  }
  return Object.freeze({
    schema: HELIOS_ALPHA01_MARKET_DATA_FORWARD_BRIDGE_SCHEMA,
    evidenceLane: input.lane,
    observationRef: input.observationRef,
    firstKnowableAt: input.firstKnowableAt,
    lastKnowableAt: input.lastKnowableAt,
    chronological: true,
    syntheticReplay: input.syntheticReplay,
  });
}
