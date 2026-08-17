import { FeeEngine, type ValidatorDescriptor } from '../fees/engine.ts';
import { FeeMempool } from '../fees/mempool.ts';
import { SevenValidatorNetwork } from '../ops/seven-validator.ts';
import { FOUR_VALIDATOR_LABELS } from '../validators/four-validator.ts';
import { caseResult } from './result.ts';
import { elapsedNs, nowNs, summarizeLatency } from './statistics.ts';
import type { BenchCaseResult, LatencyProfile } from './types.ts';
import { CONSENSUS_PHASES } from './types.ts';
import { nativeTransferTx } from './workload.ts';

/**
 * Simulated one-way delay in nanoseconds. These are laboratory
 * profiles, not geographic measurements.
 */
export const LATENCY_TICK_NS: Readonly<Record<LatencyProfile, number>> = Object.freeze({
  low: 200_000,
  regional: 8_000_000,
  intercontinental: 40_000_000,
});

const PHASE_TICKS = Object.freeze({
  proposal_creation: 1,
  proposal_propagation: 1,
  prevote: 1,
  precommit: 1,
  commit: 1,
  end_to_end_finality: 5,
});

export function validatorDescriptors(count: 4 | 7): readonly ValidatorDescriptor[] {
  if (count === 4) {
    return FOUR_VALIDATOR_LABELS.map((validatorId) => ({ validatorId, votingPower: 1n }));
  }
  return ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((label) => ({
    validatorId: `val_${label.toLowerCase()}`,
    votingPower: 1n,
  }));
}

export function replicaEngines(count: 4 | 7, faucet = 10_000_000n): FeeEngine[] {
  return Array.from({ length: count }, () => {
    const engine = new FeeEngine();
    engine.faucet('alice', faucet);
    engine.faucet('bob', faucet);
    return engine;
  });
}

function modeledDelayNs(profile: LatencyProfile, ticks: number): number {
  return LATENCY_TICK_NS[profile] * ticks;
}

export function measureConsensusLatency(input: {
  readonly validatorCount: 4 | 7;
  readonly latencyProfile: LatencyProfile;
  readonly heights: number;
}): {
  readonly cases: readonly BenchCaseResult[];
  readonly roundChanges: number;
  readonly stateRootsEqual: boolean;
  readonly roots: readonly string[];
} {
  const validators = validatorDescriptors(input.validatorCount);
  const engines = replicaEngines(input.validatorCount);
  const network = input.validatorCount === 7 ? new SevenValidatorNetwork() : null;
  const samples: Record<(typeof CONSENSUS_PHASES)[number], number[]> = {
    proposal_creation: [],
    proposal_propagation: [],
    prevote: [],
    precommit: [],
    commit: [],
    end_to_end_finality: [],
  };
  let roundChanges = 0;
  const roots: string[] = [];

  for (let height = 1; height <= input.heights; height += 1) {
    const proposalStarted = nowNs();
    const tx = nativeTransferTx(`cons:${input.validatorCount}:${height}`, 'alice', 'bob', 3n);
    samples.proposal_creation.push(elapsedNs(proposalStarted) + modeledDelayNs(input.latencyProfile, PHASE_TICKS.proposal_creation));
    samples.proposal_propagation.push(modeledDelayNs(input.latencyProfile, PHASE_TICKS.proposal_propagation));
    samples.prevote.push(modeledDelayNs(input.latencyProfile, PHASE_TICKS.prevote));
    samples.precommit.push(modeledDelayNs(input.latencyProfile, PHASE_TICKS.precommit));
    const endStarted = nowNs();
    if (network) {
      const commit = network.produce(BigInt(height));
      if (!commit) {
        roundChanges += 1;
        continue;
      }
    }
    const receiptHashes: string[] = [];
    for (const [index, engine] of engines.entries()) {
      const mempool = new FeeMempool(engine);
      const admitted = mempool.admit(tx);
      if (admitted) {
        throw new Error(`consensus replica rejected admission: ${admitted.code}`);
      }
      const selected = mempool.selectForBlock();
      const first = selected[0];
      if (!first) {
        throw new Error('consensus replica selected no transaction');
      }
      engine.activateAt(height);
      const executed = engine.execute({
        tx: first,
        blockHeight: height,
        blockId: `blk_${height}`,
        proposerId: validators[index % validators.length]!.validatorId,
        validators,
      });
      if (!executed.ok) {
        throw new Error(`consensus replica execution failed: ${executed.rejection.code}`);
      }
      mempool.removeCommitted([first.transactionId]);
      receiptHashes.push(engine.receiptHash(executed.receipt));
    }
    const firstRoot = receiptHashes[0];
    if (!firstRoot || receiptHashes.some((root) => root !== firstRoot)) {
      throw new Error('consensus replicas diverged');
    }
    roots.push(firstRoot);
    samples.commit.push(elapsedNs(endStarted) + modeledDelayNs(input.latencyProfile, PHASE_TICKS.commit));
    samples.end_to_end_finality.push(
      elapsedNs(endStarted) + modeledDelayNs(input.latencyProfile, PHASE_TICKS.end_to_end_finality),
    );
  }

  const cases = CONSENSUS_PHASES.map((phase) =>
    caseResult('consensus', `${input.validatorCount}v_${input.latencyProfile}_${phase}`, {
      latency: summarizeLatency(samples[phase]),
      extras: {
        validatorCount: input.validatorCount,
        latencyProfile: input.latencyProfile,
        geographicClaim: false,
      },
    }),
  );

  return {
    cases,
    roundChanges,
    stateRootsEqual: roots.length === input.heights,
    roots,
  };
}
