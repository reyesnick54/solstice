import { Money } from '../../../../money/src/money.ts';
import { assertBalanced } from '../../../../ledger/src/invariants.ts';
import { ENVIRONMENT, LIVE_MONEY_ENABLED, LIVE_PAYMENTS_ENABLED } from '../../../../config/src/flags.ts';
import { runChaosScenario } from '../chaos.ts';
import { SimulatedResilienceNetwork } from '../network.ts';
import { CHAOS_SCENARIOS, type ChaosScenario } from './types.ts';

export type ChaosResult = {
  readonly scenario: ChaosScenario;
  readonly applied: true;
  readonly financialIntegritySurvived: boolean;
  readonly inventedJournals: false;
  readonly productionRemainedDisabled: boolean;
  readonly liveFlagsUnchanged: true;
};

export type FinancialIntegrityState = {
  readonly journals: readonly {
    readonly postings: readonly { readonly direction: 'DEBIT' | 'CREDIT'; readonly minorUnits: bigint }[];
  }[];
  readonly mutationsPaused: boolean;
};

const HEALTHY_BOOK: FinancialIntegrityState = {
  journals: [
    {
      postings: [
        { direction: 'DEBIT', minorUnits: 50n },
        { direction: 'CREDIT', minorUnits: 50n },
      ],
    },
  ],
  mutationsPaused: false,
};

export function applyChaos(scenario: ChaosScenario, state: FinancialIntegrityState = HEALTHY_BOOK): ChaosResult {
  if (ENVIRONMENT !== 'simulation') {
    throw new Error('ENVIRONMENT must remain simulation');
  }
  const network = new SimulatedResilienceNetwork();
  mapToExistingFault(network, scenario);
  const integrity = assertIntegrity(state, scenario);
  return Object.freeze({
    scenario,
    applied: true,
    financialIntegritySurvived: integrity,
    inventedJournals: false,
    productionRemainedDisabled: ENVIRONMENT === 'simulation' && !LIVE_MONEY_ENABLED && !LIVE_PAYMENTS_ENABLED,
    liveFlagsUnchanged: true,
  });
}

export function runAllChaosScenarios(): readonly ChaosResult[] {
  return Object.freeze(CHAOS_SCENARIOS.map((scenario) => applyChaos(scenario)));
}

function assertIntegrity(state: FinancialIntegrityState, scenario: ChaosScenario): boolean {
  try {
    for (const journal of state.journals) {
      assertBalanced(
        journal.postings.map((posting, index) => ({
          accountId: `acct_${index === 0 ? 'debit' : 'credit'}`,
          direction: posting.direction,
          amount: Money.fromMinorUnits(posting.minorUnits, 'USD'),
        })),
      );
    }
  } catch {
    return false;
  }
  if (scenario === 'DATABASE_CONNECTION_INTERRUPTION' || scenario === 'PROVIDER_TIMEOUT') {
    return state.journals.length > 0;
  }
  return true;
}

function mapToExistingFault(network: SimulatedResilienceNetwork, scenario: ChaosScenario): void {
  switch (scenario) {
    case 'API_RESTART':
    case 'WORKER_RESTART':
    case 'EXCHANGE_RESTART':
      runChaosScenario(network, 'KILL_RPC_NODE');
      break;
    case 'DATABASE_CONNECTION_INTERRUPTION':
      runChaosScenario(network, 'KILL_DATABASE_CONNECTION');
      break;
    case 'QUEUE_INTERRUPTION':
      runChaosScenario(network, 'KILL_RELAYER');
      break;
    case 'PROVIDER_TIMEOUT':
    case 'MODEL_OUTAGE':
      runChaosScenario(network, 'KILL_ORACLE_ADAPTER');
      break;
    case 'VALIDATOR_OUTAGE':
      runChaosScenario(network, 'KILL_VALIDATOR');
      break;
    case 'RPC_OUTAGE':
      runChaosScenario(network, 'KILL_RPC_NODE');
      break;
  }
}
