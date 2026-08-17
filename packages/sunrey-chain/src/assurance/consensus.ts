/**
 * Tendermint-family vote-set and signer-safety model used by TS property
 * tests. The canonical engine lives in rust/crates/consensus; this model
 * asserts the documented safety filters without reimplementing BFT.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  CANONICAL_VALIDATOR_SUITE_ID,
  DurableSignerSafety,
  LocalDevelopmentSigner,
  developmentHmacSign,
  type ConsensusSignRequest,
} from '../validators/index.ts';
import type { SeededRng } from './rng.ts';

export type VoteType = 'PROPOSAL' | 'PREVOTE' | 'PRECOMMIT';

export type ModelVote = {
  readonly validatorId: string;
  readonly height: bigint;
  readonly round: bigint;
  readonly voteType: VoteType;
  readonly blockId: string;
  readonly networkId: string;
  readonly chainId: string;
  readonly validatorSetVersion: number;
  readonly signatureValid: boolean;
};

export type VoteAdmission =
  | { readonly admitted: true; readonly power: bigint }
  | { readonly admitted: false; readonly reason: string };

export class ModelVoteSet {
  readonly votes = new Map<string, ModelVote>();
  constructor(
    readonly voteType: VoteType,
    readonly height: bigint,
    readonly round: bigint,
    readonly networkId: string,
    readonly chainId: string,
    readonly validatorSetVersion: number,
    readonly powerByValidator: Readonly<Record<string, bigint>>,
  ) {}

  add(vote: ModelVote): VoteAdmission {
    if (!vote.signatureValid) {
      return { admitted: false, reason: 'invalid-signature' };
    }
    if (vote.height !== this.height) {
      return { admitted: false, reason: 'wrong-height' };
    }
    if (vote.round !== this.round) {
      return { admitted: false, reason: 'wrong-round' };
    }
    if (vote.voteType !== this.voteType) {
      return { admitted: false, reason: 'wrong-type' };
    }
    if (vote.networkId !== this.networkId || vote.chainId !== this.chainId) {
      return { admitted: false, reason: 'wrong-network' };
    }
    if (vote.validatorSetVersion !== this.validatorSetVersion) {
      return { admitted: false, reason: 'wrong-validator-set' };
    }
    if (!(vote.validatorId in this.powerByValidator)) {
      return { admitted: false, reason: 'unknown-validator' };
    }
    const existing = this.votes.get(vote.validatorId);
    if (existing) {
      if (existing.blockId !== vote.blockId) {
        return { admitted: false, reason: 'equivocation-evidence' };
      }
      return { admitted: false, reason: 'duplicate-vote' };
    }
    this.votes.set(vote.validatorId, vote);
    return { admitted: true, power: this.powerFor(vote.blockId) };
  }

  powerFor(blockId: string): bigint {
    let power = 0n;
    for (const vote of this.votes.values()) {
      if (vote.blockId === blockId) {
        power += this.powerByValidator[vote.validatorId] ?? 0n;
      }
    }
    return power;
  }

  totalPower(): bigint {
    return Object.values(this.powerByValidator).reduce((sum, part) => sum + part, 0n);
  }

  canFinalize(blockId: string): boolean {
    if (blockId === 'NIL') {
      return false;
    }
    const total = this.totalPower();
    const threshold = (total * 2n) / 3n + 1n;
    return this.powerFor(blockId) >= threshold;
  }
}

export function twoThirdsThreshold(total: bigint): bigint {
  return (total * 2n) / 3n + 1n;
}

function signRequest(
  messageType: VoteType,
  height: bigint,
  round: bigint,
  blockId: string,
): ConsensusSignRequest {
  return {
    validatorId: 'val_dev_a',
    networkId: 'net_sunrey_simulation',
    chainId: 'chn_sunrey_simulation',
    protocolVersion: '1',
    messageType,
    height,
    round,
    blockId,
    validatorSetVersion: 1n,
    cryptoSuiteId: CANONICAL_VALIDATOR_SUITE_ID,
  };
}

export function runSignerSafetySequence(rng: SeededRng, steps: number): { readonly conflicts: number } {
  const dir = mkdtempSync(join(tmpdir(), 'sunrey-signer-fuzz-'));
  try {
    const path = join(dir, 'signer-safety.json');
    let safety = new DurableSignerSafety(path);
    const signer = new LocalDevelopmentSigner((message) => developmentHmacSign(message, 'val_dev_a'));
    let conflicts = 0;
    let height = 1n;
    let round = 0n;
    const types: VoteType[] = ['PROPOSAL', 'PREVOTE', 'PRECOMMIT'];
    for (let i = 0; i < steps; i += 1) {
      const voteType = rng.pick(types);
      if (rng.int(0, 5) === 0) {
        height += 1n;
        round = 0n;
      } else if (rng.int(0, 4) === 0) {
        round += 1n;
      }
      const conflicting = rng.int(0, 7) === 0;
      const request = signRequest(voteType, height, round, conflicting ? 'blk_conflict' : 'blk_honest');
      const result = safety.protect(request, signer, 'HUMAN', '2026-08-17T00:00:00.000Z');
      if (!result.ok) {
        conflicts += 1;
      }
      if (rng.int(0, 8) === 0) {
        safety = new DurableSignerSafety(path);
      }
    }
    return { conflicts };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function consensusCampaign(rng: SeededRng, events: number): {
  readonly finalized: number;
  readonly conflictingFinality: 0;
  readonly heightNeverDecreased: true;
} {
  const validators = ['val_a', 'val_b', 'val_c', 'val_d'] as const;
  const power = Object.fromEntries(validators.map((id) => [id, 10n])) as Record<string, bigint>;
  let height = 1n;
  let round = 0n;
  let finalized = 0;
  let lastCommitted = 0n;
  const committed = new Map<bigint, string>();
  for (let i = 0; i < events; i += 1) {
    if (rng.int(0, 9) === 0) {
      round += 1n;
    }
    const set = new ModelVoteSet(
      'PRECOMMIT',
      height,
      round,
      'net_sunrey_simulation',
      'chn_sunrey_simulation',
      1,
      power,
    );
    const blockA = `blk_${height}_${round}_a`;
    const blockB = `blk_${height}_${round}_b`;
    const byzantine = rng.int(0, 5) === 0;
    const delayed = rng.shuffle([...validators]);
    const duplicates = rng.bool();
    for (const validatorId of delayed) {
      const blockId = byzantine && validatorId === 'val_d' ? blockB : blockA;
      const vote: ModelVote = {
        validatorId,
        height: rng.int(0, 11) === 0 ? height + 3n : height,
        round: rng.int(0, 11) === 0 ? round + 2n : round,
        voteType: 'PRECOMMIT',
        blockId: rng.int(0, 15) === 0 ? 'NIL' : blockId,
        networkId: rng.int(0, 15) === 0 ? 'net_other' : 'net_sunrey_simulation',
        chainId: 'chn_sunrey_simulation',
        validatorSetVersion: rng.int(0, 15) === 0 ? 9 : 1,
        signatureValid: rng.int(0, 12) !== 0,
      };
      set.add(vote);
      if (duplicates) {
        set.add(vote);
      }
    }
    if (set.canFinalize(blockA) && set.canFinalize(blockB)) {
      throw new Error('conflicting finality under modeled assumptions');
    }
    if (set.canFinalize(blockA)) {
      const previous = committed.get(height);
      if (previous && previous !== blockA) {
        throw new Error('finalized block replaced');
      }
      committed.set(height, blockA);
      if (height < lastCommitted) {
        throw new Error('committed height decreased');
      }
      lastCommitted = height;
      finalized += 1;
      height += 1n;
      round = 0n;
    }
  }
  return { finalized, conflictingFinality: 0, heightNeverDecreased: true };
}
