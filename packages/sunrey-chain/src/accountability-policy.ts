/**
 * Development/simulation validator accountability policy types.
 *
 * Bond units are integer protocol units, not Money, not customer fiat,
 * not SunRey Coin, and not MoonRey. There is no AI punishment path.
 */

export const ACCOUNTABILITY_POLICY_VERSION = 1 as const;

export const ACCOUNTABILITY_DECISIONS = [
  'RECORD_ONLY',
  'JAIL',
  'TOMBSTONE',
  'SIMULATION_BOND_PENALTY',
] as const;

export type AccountabilityDecision = (typeof ACCOUNTABILITY_DECISIONS)[number];

export type SimulationBondUnits = {
  readonly bondUnits: bigint;
  readonly lockedUnits: bigint;
  readonly penalizedUnits: bigint;
  readonly remainingUnits: bigint;
};

export type AccountabilityReceiptView = {
  readonly evidenceId: string;
  readonly validatorId: string;
  readonly evidenceType: string;
  readonly policyVersion: number;
  readonly policyHash: string;
  readonly decision: string;
  readonly effectiveEpoch: bigint;
  readonly bondPenaltyUnits: bigint;
  readonly validatorStatusChange: string;
  readonly finalizedBlockId: string;
  readonly processedHeight: bigint;
};

export const FORBIDDEN_ACCOUNTABILITY_TARGETS = [
  'customer fiat journals',
  'bank accounts',
  'investment accounts',
  'SunRey Coin customer balances',
  'MoonRey balances',
] as const;
