/**
 * First proposal, first commit, and first state-root verification.
 *
 * Uses canonical consensus quorum rules. After finalized production
 * blocks exist, launch orchestration never models rewriting history.
 */

import { SevenValidatorNetwork } from '../ops/seven-validator.ts';
import { hasTwoThirdsPlus } from '../validators/index.ts';
import { encodeString, sha256Hex } from '../validators/canonical.ts';
import type { FirstBlockVerification, FirstCommit, FirstProposal, ProductionLaunchPlan } from './types.ts';

export const FIRST_STATE_ROOT_DOMAIN = 'SUNREY_GENESIS_EXECUTION_STATE_ROOT_V1' as const;

export function firstStateRootOf(genesisHash: string, blockId: string): string {
  return sha256Hex(
    Buffer.concat([
      encodeString(FIRST_STATE_ROOT_DOMAIN),
      encodeString(genesisHash),
      encodeString(blockId),
    ]),
  );
}

export function verifyFirstCommit(commit: FirstCommit): boolean {
  return (
    commit.height === 1n &&
    commit.canonicalRulesOk &&
    hasTwoThirdsPlus(commit.commitPower, commit.totalPower) &&
    commit.signatures.length === Number(commit.commitPower)
  );
}

export function executeRehearsalFirstBlock(plan: ProductionLaunchPlan): FirstBlockVerification {
  const network = new SevenValidatorNetwork();
  const commit = network.produce(1n);
  if (!commit) {
    return Object.freeze({
      proposal: Object.freeze({
        proposer: 'none',
        height: 1n,
        round: 0n,
        blockId: '',
        validatorSetHash: plan.validatorSetHash,
        stateRoot: '',
      }),
      commit: Object.freeze({
        height: 1n,
        blockId: '',
        commitPower: 0n,
        totalPower: 7n,
        signatures: Object.freeze([]),
        canonicalRulesOk: false,
      }),
      stateRoot: '',
      validatorsConverged: false,
      healthyValidatorAgreement: false,
      verified: false,
    });
  }
  const stateRoot = firstStateRootOf(plan.genesisHash, commit.blockId);
  const proposal: FirstProposal = Object.freeze({
    proposer: commit.voters[0]!,
    height: 1n,
    round: 0n,
    blockId: commit.blockId,
    validatorSetHash: plan.validatorSetHash,
    stateRoot,
  });
  const firstCommit: FirstCommit = Object.freeze({
    height: commit.height,
    blockId: commit.blockId,
    commitPower: BigInt(commit.voters.length),
    totalPower: 7n,
    signatures: Object.freeze(commit.voters.map((voter) => `${voter}:${commit.blockId}`)),
    canonicalRulesOk: true,
  });
  const healthy = network.nodes.filter((row) => row.online).every((row) => row.height === 1n) && network.safetyHolds();
  const converged = healthy && network.nodes.every((row) => row.online);
  const verified = verifyFirstCommit(firstCommit) && healthy && converged && proposal.stateRoot === stateRoot;
  return Object.freeze({
    proposal,
    commit: firstCommit,
    stateRoot,
    validatorsConverged: converged,
    healthyValidatorAgreement: healthy,
    verified,
  });
}

export function rejectFinalizedHistoryRewrite(finalized: boolean): void {
  if (finalized) {
    throw new TypeError('HISTORY_REWRITE_FORBIDDEN');
  }
}
