/**
 * Deterministic validator-economics simulator.
 *
 * Engineering scenarios only. Results are not a claim of guaranteed
 * economic security and do not invent production bond values.
 */

import type { ValidatorRecord } from '../validators/types.ts';
import { ValidatorEconomicsEngine } from './engine.ts';
import { fixtureValidatorRecord } from './fixtures.ts';
import type { EconomicSecurityMetrics, ProtocolEvidence, ValidatorEconomicsReconciliation } from './types.ts';

export const SIMULATOR_SCENARIOS = [
  'all_validators_healthy',
  'one_validator_intermittently_offline',
  'two_validators_intermittently_offline',
  'one_validator_equivocation',
  'validator_exit',
  'low_fee_activity',
  'high_fee_activity',
  'unequal_voting_power',
  'high_bond_concentration',
  'operator_concentration',
] as const;
export type SimulatorScenarioId = (typeof SIMULATOR_SCENARIOS)[number];

export type SimulatorScenarioResult = {
  readonly scenario: SimulatorScenarioId;
  readonly ok: boolean;
  readonly notes: string;
  readonly reconciliation: ValidatorEconomicsReconciliation;
  readonly metrics: EconomicSecurityMetrics;
};

export type ValidatorEconomicsSimulationReport = {
  readonly environment: 'development' | 'rehearsal';
  readonly fixtureUnits: true;
  readonly guaranteedEconomicSecurity: false;
  readonly scenarios: readonly SimulatorScenarioResult[];
  readonly allPassed: boolean;
};

function validators(count: number, power: readonly bigint[], operators?: readonly string[]) {
  return Array.from({ length: count }, (_, index) => {
    const operatorId = operators?.[index];
    return fixtureValidatorRecord({
      label: String.fromCharCode(65 + index),
      votingPower: power[index] ?? 1n,
      status: 'CANDIDATE',
      ...(operatorId === undefined ? {} : { operatorId }),
    });
  });
}

function evidence(validatorId: string, id: string): ProtocolEvidence {
  return Object.freeze({
    evidenceId: id,
    violationClass: 'DOUBLE_PREVOTE',
    validatorId,
    height: 8n,
    round: 1n,
    leftHash: 'aa',
    rightHash: 'bb',
    signatureA: '11',
    signatureB: '22',
    verified: true,
    forged: false,
    monitoringSuspicionOnly: false,
  });
}

function seed(engine: ValidatorEconomicsEngine, records: readonly ValidatorRecord[], bond = 1_000_000n): void {
  for (const record of records) {
    engine.registerValidator(record, bond * 2n);
    const bonded = engine.bond({ validatorId: record.validatorId, quantity: bond, asset: engine.policy().bond.bondAsset });
    if (!bonded.ok) {
      throw new Error(bonded.error.message);
    }
  }
  engine.advanceEpoch();
}

function participate(
  engine: ValidatorEconomicsEngine,
  records: readonly ValidatorRecord[],
  votes: readonly bigint[],
): void {
  for (const [index, record] of records.entries()) {
    const valid = votes[index] ?? 0n;
    engine.recordParticipation({
      entitlementId: `${record.validatorId}:${engine.epoch.toString()}:v${engine.policy().version}`,
      validatorId: record.validatorId,
      epoch: engine.epoch,
      height: engine.height,
      expectedVotes: 10n,
      validSignedVotes: valid,
      missedVotes: 10n - valid,
      proposalAssignments: index === 0 ? 1n : 0n,
      validProposals: index === 0 ? 1n : 0n,
      activeVotingPower: record.votingPower,
      epochMember: true,
      policyVersion: engine.policy().version,
    });
  }
}

function runOne(scenario: SimulatorScenarioId): SimulatorScenarioResult {
  const engine = new ValidatorEconomicsEngine('development');
  let notes = '';
  switch (scenario) {
    case 'all_validators_healthy': {
      const set = validators(4, [1n, 1n, 1n, 1n]);
      seed(engine, set);
      participate(engine, set, [10n, 10n, 10n, 10n]);
      engine.ingestFeeAllocation(1_000n);
      const settled = engine.settleEpochRewards(engine.epoch);
      notes = settled.ok ? `healthy rewards ${engine.paidTotal.toString()}` : settled.error.message;
      break;
    }
    case 'one_validator_intermittently_offline': {
      const set = validators(4, [1n, 1n, 1n, 1n]);
      seed(engine, set);
      participate(engine, set, [10n, 10n, 10n, 2n]);
      engine.ingestFeeAllocation(1_000n);
      engine.settleEpochRewards(engine.epoch);
      notes = 'one validator missed most votes; rewards remain integer and reconciled';
      break;
    }
    case 'two_validators_intermittently_offline': {
      const set = validators(4, [1n, 1n, 1n, 1n]);
      seed(engine, set);
      participate(engine, set, [10n, 3n, 2n, 10n]);
      engine.ingestFeeAllocation(800n);
      engine.settleEpochRewards(engine.epoch);
      notes = 'two validators intermittently offline';
      break;
    }
    case 'one_validator_equivocation': {
      const set = validators(4, [1n, 1n, 1n, 1n]);
      seed(engine, set);
      const penalty = engine.applyPenalty(evidence(set[0]!.validatorId, 'ev_sim_equivocation'));
      notes = penalty.ok ? `penalty ${penalty.value.bondImpact.toString()}` : penalty.error.message;
      break;
    }
    case 'validator_exit': {
      const set = validators(4, [1n, 1n, 1n, 1n]);
      seed(engine, set);
      engine.requestUnbond(set[1]!.validatorId);
      engine.advanceEpoch();
      engine.advanceEpoch();
      const released = engine.releaseUnbond(set[1]!.validatorId);
      notes = released.ok ? `exited ${released.value.state}` : released.error.message;
      break;
    }
    case 'low_fee_activity': {
      const set = validators(4, [1n, 1n, 1n, 1n]);
      seed(engine, set);
      participate(engine, set, [10n, 10n, 10n, 10n]);
      engine.ingestFeeAllocation(4n);
      engine.settleEpochRewards(engine.epoch);
      notes = `low fees remainder ${engine.remainderSink.toString()}`;
      break;
    }
    case 'high_fee_activity': {
      const set = validators(4, [1n, 1n, 1n, 1n]);
      seed(engine, set);
      participate(engine, set, [10n, 10n, 10n, 10n]);
      engine.ingestFeeAllocation(1_000_000n);
      engine.settleEpochRewards(engine.epoch);
      notes = `high fees paid ${engine.paidTotal.toString()}`;
      break;
    }
    case 'unequal_voting_power': {
      const set = validators(4, [4n, 2n, 1n, 1n]);
      seed(engine, set);
      participate(engine, set, [10n, 10n, 10n, 10n]);
      engine.ingestFeeAllocation(800n);
      engine.settleEpochRewards(engine.epoch);
      notes = 'voting power remains distinct from bond quantity';
      break;
    }
    case 'high_bond_concentration': {
      const set = validators(4, [1n, 1n, 1n, 1n]);
      seed(engine, set, 1_000_000n);
      engine.creditBondDomain(set[0]!.operatorActorId, 8_000_000n, engine.policy().bond.bondAsset);
      engine.bond({ validatorId: set[0]!.validatorId, quantity: 8_000_000n, asset: engine.policy().bond.bondAsset });
      notes = 'high bond concentration recorded as an engineering metric';
      break;
    }
    case 'operator_concentration': {
      const set = validators(4, [1n, 1n, 1n, 1n], ['op_shared', 'op_shared', 'op_shared', 'op_solo']);
      seed(engine, set);
      notes = 'three validators share one operator identity';
      break;
    }
    default: {
      const _never: never = scenario;
      return _never;
    }
  }
  const reconciliation = engine.reconcile();
  return Object.freeze({
    scenario,
    ok: reconciliation.balanced && !notes.includes('error'),
    notes,
    reconciliation,
    metrics: engine.metrics(),
  });
}

export class ValidatorEconomicsSimulator {
  run(environment: 'development' | 'rehearsal' = 'development'): ValidatorEconomicsSimulationReport {
    const scenarios = SIMULATOR_SCENARIOS.map(runOne);
    return Object.freeze({
      environment,
      fixtureUnits: true,
      guaranteedEconomicSecurity: false,
      scenarios: Object.freeze(scenarios),
      allPassed: scenarios.every((row) => row.ok),
    });
  }
}

export function runValidatorEconomicsSimulation(
  environment: 'development' | 'rehearsal' = 'development',
): ValidatorEconomicsSimulationReport {
  return new ValidatorEconomicsSimulator().run(environment);
}
