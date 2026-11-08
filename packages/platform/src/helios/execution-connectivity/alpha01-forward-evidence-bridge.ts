/**
 * ALPHA01 bridge — realistic cost assumptions for forward evidence after EXEC07 TCA.
 */

import type { UtcInstant } from '@solstice/domain';
import type { ForwardAlphaEvidenceLane } from '@solstice/strategy-lab';

export const HELIOS_ALPHA01_EXEC_CONNECTIVITY_FORWARD_BRIDGE_SCHEMA =
  'sunrey.helios.alpha01.execution-connectivity-forward-bridge.v1' as const;

export type Alpha01ForwardCostEvidenceSlice = {
  readonly schema: typeof HELIOS_ALPHA01_EXEC_CONNECTIVITY_FORWARD_BRIDGE_SCHEMA;
  readonly evidenceLane: ForwardAlphaEvidenceLane;
  readonly tradingCostMinor: bigint;
  readonly netAfterCostsMinor: bigint;
  readonly computedAt: UtcInstant;
  readonly validatedTca: boolean;
};

export function buildAlpha01ForwardCostEvidenceSlice(input: {
  readonly lane: ForwardAlphaEvidenceLane;
  readonly grossMinor: bigint;
  readonly tradingCostMinor: bigint;
  readonly computedAt: UtcInstant;
  readonly validatedTca: boolean;
}): Alpha01ForwardCostEvidenceSlice {
  return Object.freeze({
    schema: HELIOS_ALPHA01_EXEC_CONNECTIVITY_FORWARD_BRIDGE_SCHEMA,
    evidenceLane: input.lane,
    tradingCostMinor: input.tradingCostMinor,
    netAfterCostsMinor: input.grossMinor - input.tradingCostMinor,
    computedAt: input.computedAt,
    validatedTca: input.validatedTca,
  });
}
