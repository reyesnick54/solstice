/**
 * ALPHA06 — execution realism (fees, spread, slippage) applied to shadow forward PnL.
 */

export const HELIOS_ALPHA06_EXECUTION_REALISM = 'HELIOS_ALPHA06_EXECUTION_REALISM' as const;

export type ExecutionRealismProfile = {
  readonly feeMinorPerTrade: bigint;
  readonly spreadBps: number;
  readonly slippageBps: number;
};

export function applyExecutionRealism(
  grossExcessMinor: bigint,
  notionalMinor: bigint,
  profile: ExecutionRealismProfile,
): bigint {
  const spreadCost = (notionalMinor * BigInt(profile.spreadBps)) / 10_000n;
  const slipCost = (notionalMinor * BigInt(profile.slippageBps)) / 10_000n;
  return grossExcessMinor - profile.feeMinorPerTrade - spreadCost - slipCost;
}
