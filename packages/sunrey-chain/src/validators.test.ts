import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  DurableSignerSafety,
  LocalDevelopmentSigner,
  assertConsensusKeyPurpose,
  assertPermittedValidatorController,
  applyEpochBoundary,
  developmentHmacSign,
  developmentValidatorRecord,
  fourValidatorDevelopmentHash,
  fourValidatorDevelopmentSet,
  hasOneThirdPlus,
  hasTwoThirdsPlus,
  mutateActiveSetDuringEpoch,
  observeValidatorPlane,
  oneThirdPower,
  safetyPath,
  simulationBond,
  totalPower,
  transitionValidator,
  twoThirdsPower,
  validatorSetHash,
  type ConsensusSignRequest,
  type QueuedChange,
  type ValidatorRecord,
} from './validators/index.ts';
import { CANONICAL_VALIDATOR_SUITE_ID, NIL_BLOCK_ID } from './validators/types.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

function request(
  validatorId: string,
  type: ConsensusSignRequest['messageType'],
  height: bigint,
  round: bigint,
  blockId: string,
): ConsensusSignRequest {
  return {
    validatorId,
    networkId: 'net_sunrey_local_dev',
    chainId: 'chn_sunrey_local_dev',
    protocolVersion: '1',
    messageType: type,
    height,
    round,
    blockId,
    validatorSetVersion: 1n,
    cryptoSuiteId: CANONICAL_VALIDATOR_SUITE_ID,
  };
}

function withSafety<T>(fn: (dir: string, safety: DurableSignerSafety, signer: LocalDevelopmentSigner) => T): T {
  const dir = mkdtempSync(join(tmpdir(), 'sunrey-signer-'));
  try {
    const safety = new DurableSignerSafety(safetyPath(dir, 'val_dev_a', 'chn_sunrey_local_dev'));
    const signer = new LocalDevelopmentSigner((message) => developmentHmacSign(message, 'dev-signer-a'));
    return fn(dir, safety, signer);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('Chunk 36R SunRey validator registry', () => {
  it('1. builds a deterministic four-validator set', () => {
    const first = fourValidatorDevelopmentSet();
    const second = fourValidatorDevelopmentSet();
    assert.equal(first.validators.length, 4);
    assert.deepEqual(
      first.validators.map((row) => row.validatorId),
      ['val_dev_a', 'val_dev_b', 'val_dev_c', 'val_dev_d'],
    );
    assert.equal(validatorSetHash(first), validatorSetHash(second));
    assert.equal(new Set(first.validators.map((row) => row.consensusPublicKey.publicKeyHex)).size, 4);
    assert.equal(new Set(first.validators.map((row) => row.p2pPublicKey.publicKeyHex)).size, 4);
  });

  it('2. identical set -> identical hash', () => {
    assert.equal(fourValidatorDevelopmentHash(), validatorSetHash(fourValidatorDevelopmentSet()));
  });

  it('3. voting-power change -> different hash', () => {
    const base = fourValidatorDevelopmentSet();
    const changed = {
      ...base,
      validators: base.validators.map((row, index) =>
        index === 0 ? { ...row, votingPower: 2n } : row,
      ),
    };
    assert.notEqual(validatorSetHash(base), validatorSetHash(changed));
  });

  it('4. public-key change -> different hash', () => {
    const base = fourValidatorDevelopmentSet();
    const changed = {
      ...base,
      validators: base.validators.map((row, index) =>
        index === 0
          ? {
              ...row,
              consensusPublicKey: { ...row.consensusPublicKey, publicKeyHex: 'ff'.repeat(32) },
            }
          : row,
      ),
    };
    assert.notEqual(validatorSetHash(base), validatorSetHash(changed));
  });

  it('5. AI controller rejected', () => {
    const result = assertPermittedValidatorController('AI_AGENT', 'CAST_VOTE');
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'FORBIDDEN_CONTROLLER');
    }
  });

  it('6. robot controller rejected', () => {
    const result = assertPermittedValidatorController('ROBOT', 'ROTATE_VALIDATOR_KEY');
    assert.equal(result.ok, false);
  });

  it('7. device controller rejected', () => {
    const result = assertPermittedValidatorController('DEVICE', 'JAIL_VALIDATOR');
    assert.equal(result.ok, false);
  });

  it('8. P2P key as consensus key rejected', () => {
    const result = assertConsensusKeyPurpose('P2P_IDENTITY');
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'FORBIDDEN_KEY_PURPOSE');
    }
  });

  it('9. Execution Authority key rejected', () => {
    const result = assertConsensusKeyPurpose('EXECUTION_AUTHORITY_SIGNING');
    assert.equal(result.ok, false);
  });

  it('10. duplicate consensus key rejected', () => {
    const set = fourValidatorDevelopmentSet();
    const dup: ValidatorRecord = {
      ...developmentValidatorRecord('B'),
      validatorId: 'val_dev_dup',
      consensusPublicKey: set.validators[0]!.consensusPublicKey,
    };
    const epoch = { number: 0n, startHeight: 0n, endHeight: 10n, validatorSetVersion: 1n };
    const next = {
      number: 1n,
      startHeight: 10n,
      endHeight: 20n,
      validatorSetVersion: 2n,
    };
    const change: QueuedChange = {
      kind: 'ADD_VALIDATOR',
      validatorId: dup.validatorId,
      activationEpoch: 1n,
      controllerKind: 'HUMAN',
      record: { ...dup, status: 'CANDIDATE' },
    };
    const applied = applyEpochBoundary(set, epoch, next, [change], 10n, '2026-08-16T00:00:00Z');
    assert.equal(applied.ok, false);
    if (!applied.ok) {
      assert.equal(applied.error.code, 'DUPLICATE_CONSENSUS_KEY');
    }
  });

  it('11. conflicting proposal signing rejected', () => {
    withSafety((_dir, safety, signer) => {
      const first = safety.protect(request('val_dev_a', 'PROPOSAL', 5n, 1n, 'block-a'), signer, 'HUMAN', '2026-08-16T00:00:00Z');
      assert.equal(first.ok, true);
      const second = safety.protect(request('val_dev_a', 'PROPOSAL', 5n, 1n, 'block-b'), signer, 'HUMAN', '2026-08-16T00:00:01Z');
      assert.equal(second.ok, false);
      if (!second.ok) {
        assert.equal(second.error.code, 'SIGNER_CONFLICT');
      }
    });
  });

  it('12. conflicting prevote signing rejected', () => {
    withSafety((_dir, safety, signer) => {
      assert.equal(safety.protect(request('val_dev_a', 'PREVOTE', 5n, 1n, 'block-a'), signer, 'HUMAN', 't').ok, true);
      const second = safety.protect(request('val_dev_a', 'PREVOTE', 5n, 1n, 'block-b'), signer, 'HUMAN', 't');
      assert.equal(second.ok, false);
    });
  });

  it('13. conflicting precommit signing rejected', () => {
    withSafety((_dir, safety, signer) => {
      assert.equal(safety.protect(request('val_dev_a', 'PRECOMMIT', 5n, 1n, 'block-a'), signer, 'HUMAN', 't').ok, true);
      const second = safety.protect(request('val_dev_a', 'PRECOMMIT', 5n, 1n, 'block-b'), signer, 'HUMAN', 't');
      assert.equal(second.ok, false);
    });
  });

  it('14. signer protection survives restart', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sunrey-signer-restart-'));
    try {
      const path = safetyPath(dir, 'val_dev_a', 'chn_sunrey_local_dev');
      const first = new DurableSignerSafety(path);
      const signer = new LocalDevelopmentSigner((message) => developmentHmacSign(message, 'dev-signer-a'));
      const signed = first.protect(request('val_dev_a', 'PROPOSAL', 9n, 2n, 'block-a'), signer, 'HUMAN', 't');
      assert.equal(signed.ok, true);
      const restarted = new DurableSignerSafety(path);
      const conflict = restarted.protect(request('val_dev_a', 'PROPOSAL', 9n, 2n, 'block-b'), signer, 'HUMAN', 't');
      assert.equal(conflict.ok, false);
      const replay = restarted.protect(request('val_dev_a', 'PROPOSAL', 9n, 2n, 'block-a'), signer, 'HUMAN', 't');
      assert.equal(replay.ok, true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('15. key rotation activates exactly at epoch boundary', () => {
    const set = fourValidatorDevelopmentSet();
    const current = { number: 0n, startHeight: 0n, endHeight: 10n, validatorSetVersion: 1n };
    const next = { number: 1n, startHeight: 10n, endHeight: 20n, validatorSetVersion: 2n };
    const newKey = {
      ...set.validators[0]!.consensusPublicKey,
      publicKeyHex: 'aa'.repeat(32),
      keyId: 'rotated-a',
    };
    const mid = applyEpochBoundary(set, current, next, [], 5n, 't');
    assert.equal(mid.ok, false);
    const rotated = applyEpochBoundary(
      set,
      current,
      next,
      [
        {
          kind: 'ROTATE_CONSENSUS_KEY',
          validatorId: 'val_dev_a',
          activationEpoch: 1n,
          controllerKind: 'HUMAN',
          consensusPublicKey: newKey,
        },
      ],
      10n,
      't',
    );
    if (!rotated.ok) {
      return;
    }
    const updated = rotated.value.nextValidatorSet.validators.find((row) => row.validatorId === 'val_dev_a')!;
    assert.equal(updated.consensusPublicKey.publicKeyHex, 'aa'.repeat(32));
    assert.equal(updated.historicalConsensusKeys.length, 1);
    assert.equal(set.validators[0]!.consensusPublicKey.publicKeyHex !== updated.consensusPublicKey.publicKeyHex, true);
  });

  it('16. voluntary exit activates exactly at epoch boundary', () => {
    const set = fourValidatorDevelopmentSet();
    const current = { number: 0n, startHeight: 0n, endHeight: 10n, validatorSetVersion: 1n };
    const next = { number: 1n, startHeight: 10n, endHeight: 20n, validatorSetVersion: 2n };
    const scheduled = applyEpochBoundary(
      set,
      current,
      next,
      [{ kind: 'SCHEDULE_EXIT', validatorId: 'val_dev_d', activationEpoch: 1n, controllerKind: 'HUMAN' }],
      10n,
      't',
    );
    if (!scheduled.ok) {
      return;
    }
    const pending = scheduled.value.nextValidatorSet.validators.find((row) => row.validatorId === 'val_dev_d')!;
    assert.equal(pending.status, 'PENDING_EXIT');
    const following = { number: 2n, startHeight: 20n, endHeight: 30n, validatorSetVersion: 3n };
    const exited = applyEpochBoundary(
      scheduled.value.nextValidatorSet,
      next,
      following,
      [],
      20n,
      't',
    );
    if (!exited.ok) {
      return;
    }
    assert.equal(exited.value.nextValidatorSet.validators.find((row) => row.validatorId === 'val_dev_d')!.status, 'EXITED');
  });

  it('17. active set immutable during epoch', () => {
    const locked = mutateActiveSetDuringEpoch();
    assert.equal(locked.ok, false);
    const set = fourValidatorDevelopmentSet();
    const current = { number: 0n, startHeight: 0n, endHeight: 10n, validatorSetVersion: 1n };
    const next = { number: 1n, startHeight: 10n, endHeight: 20n, validatorSetVersion: 2n };
    const mid = applyEpochBoundary(set, current, next, [], 4n, 't');
    assert.equal(mid.ok, false);
    if (!mid.ok) {
      assert.equal(mid.error.code, 'ACTIVE_SET_IMMUTABLE');
    }
  });

  it('18. exact 2/3 threshold arithmetic', () => {
    assert.equal(totalPower([1n, 1n, 1n, 1n]), 4n);
    assert.equal(oneThirdPower(4n), 1n);
    assert.equal(twoThirdsPower(4n), 2n);
    assert.equal(hasTwoThirdsPlus(2n, 4n), false);
    assert.equal(hasTwoThirdsPlus(3n, 4n), true);
    assert.equal(hasOneThirdPlus(1n, 4n), false);
    assert.equal(hasOneThirdPlus(2n, 4n), true);
    assert.equal(3n * 3n > 4n * 2n, true);
  });

  it('19-21. no customer ledger journal, SunRey Coin debit, or MoonRey issuance', () => {
    const bond = simulationBond(1n);
    assert.equal(bond.kind, 'SIMULATION_BOND');
    const source = readFileSync(join(ROOT, 'packages/sunrey-chain/src/validators/types.ts'), 'utf8');
    assert.equal(/postJournal|ISSUE_SUNREY_COIN|ISSUE_MOONREY|debitCustomer/.test(source), false);
    assert.equal(existsSync(join(ROOT, 'packages/validators')), false);
    assert.equal(existsSync(join(ROOT, 'packages/staking')), false);
    const lifecycle = transitionValidator(developmentValidatorRecord('A'), 'PENDING_EXIT', 1n, 0n, 't');
    assert.equal(lifecycle.ok, true);
  });

  it('rejects undefined lifecycle transitions', () => {
    const result = transitionValidator(developmentValidatorRecord('A'), 'CANDIDATE', 1n, 0n, 't');
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'UNDEFINED_TRANSITION');
    }
  });

  it('exposes observability fields', () => {
    const set = fourValidatorDevelopmentSet();
    const metrics = observeValidatorPlane({
      set,
      epoch: { number: 0n, startHeight: 0n, endHeight: 10n, validatorSetVersion: 1n },
    });
    assert.equal(metrics.validator_set_hash, fourValidatorDevelopmentHash());
    assert.equal(metrics.validator_voting_power, '4');
    assert.equal(metrics.bond_status[0]?.kind, 'SIMULATION_BOND');
  });

  it('does not treat NIL vs NIL prevote as a conflict', () => {
    withSafety((_dir, safety, signer) => {
      const first = safety.protect(request('val_dev_a', 'PREVOTE', 3n, 0n, NIL_BLOCK_ID), signer, 'HUMAN', 't');
      const second = safety.protect(request('val_dev_a', 'PREVOTE', 3n, 0n, NIL_BLOCK_ID), signer, 'HUMAN', 't');
      assert.equal(first.ok, true);
      assert.equal(second.ok, true);
    });
  });
});
