export const CHAOS_SCENARIOS = [
  'VALIDATOR_OFFLINE',
  'NETWORK_PARTITION',
  'SLOW_VALIDATOR',
  'INVALID_TRANSACTION_FLOOD',
  'INVALID_BLOCK',
  'DUPLICATE_TRANSACTION',
  'RPC_OVERLOAD',
  'NODE_RESTART',
  'STATE_RESTORE',
] as const;
export type ChaosScenario = (typeof CHAOS_SCENARIOS)[number];

export type ChaosOutcome = {
  readonly scenario: ChaosScenario;
  readonly expected: string;
  readonly passed: boolean;
};

export function evaluateChaos(scenario: ChaosScenario, observed: string): ChaosOutcome {
  const expected: Record<ChaosScenario, string> = {
    VALIDATOR_OFFLINE: 'REMAINING_QUORUM_FINALIZES',
    NETWORK_PARTITION: 'NO_CONFLICTING_FINALITY',
    SLOW_VALIDATOR: 'ROUND_CHANGE_THEN_COMMIT',
    INVALID_TRANSACTION_FLOOD: 'MEMPOOL_OR_RPC_REJECTS',
    INVALID_BLOCK: 'BLOCK_REJECTED',
    DUPLICATE_TRANSACTION: 'REPLAY_REJECTED',
    RPC_OVERLOAD: 'RATE_LIMITED',
    NODE_RESTART: 'STATE_RECOVERED',
    STATE_RESTORE: 'INTEGRITY_VERIFIED',
  };
  return {
    scenario,
    expected: expected[scenario],
    passed: observed === expected[scenario],
  };
}

export function runChaosSuite(
  observations: Readonly<Record<ChaosScenario, string>>,
): readonly ChaosOutcome[] {
  return CHAOS_SCENARIOS.map((scenario) => evaluateChaos(scenario, observations[scenario]));
}
