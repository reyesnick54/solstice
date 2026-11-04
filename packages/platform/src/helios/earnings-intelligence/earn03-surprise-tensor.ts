import type { SurpriseTensorCell } from './types.ts';

export const EARN03_SURPRISE_TENSOR_MODULE =
  'packages/platform/src/helios/earnings-intelligence/earn03-surprise-tensor.ts' as const;

export function buildSurpriseTensor(input: {
  readonly epsActualMinor: bigint;
  readonly epsConsensusMinor: bigint;
  readonly revenueActualMinor: bigint;
  readonly revenueConsensusMinor: bigint;
}): readonly SurpriseTensorCell[] {
  const epsSurpriseBps =
    input.epsConsensusMinor === 0n
      ? 0
      : Number(((input.epsActualMinor - input.epsConsensusMinor) * 10_000n) / input.epsConsensusMinor);
  const revSurpriseBps =
    input.revenueConsensusMinor === 0n
      ? 0
      : Number(
          ((input.revenueActualMinor - input.revenueConsensusMinor) * 10_000n) /
            input.revenueConsensusMinor,
        );
  return Object.freeze([
    Object.freeze({
      metric: 'EPS',
      actualMinor: input.epsActualMinor,
      consensusMinor: input.epsConsensusMinor,
      surpriseBps: epsSurpriseBps,
    }),
    Object.freeze({
      metric: 'REVENUE',
      actualMinor: input.revenueActualMinor,
      consensusMinor: input.revenueConsensusMinor,
      surpriseBps: revSurpriseBps,
    }),
  ]);
}
