import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import {
  DurableSignerSafety,
  type ConsensusSignRequest,
  type SignerSafetyState,
} from '../validators/index.ts';
import { opsErr, opsOk, type OpsResult, type SafetyCheckpoint } from './types.ts';

const STEP_ORDER: Readonly<Record<SignerSafetyState['lastSignedStep'], number>> = {
  PROPOSAL: 1,
  PREVOTE: 2,
  PRECOMMIT: 3,
};

export function compareSafetyWatermark(
  left: { readonly lastSignedHeight: bigint; readonly lastSignedRound: bigint; readonly lastSignedStep: SignerSafetyState['lastSignedStep'] },
  right: { readonly lastSignedHeight: bigint; readonly lastSignedRound: bigint; readonly lastSignedStep: SignerSafetyState['lastSignedStep'] },
): number {
  if (left.lastSignedHeight !== right.lastSignedHeight) {
    return left.lastSignedHeight < right.lastSignedHeight ? -1 : 1;
  }
  if (left.lastSignedRound !== right.lastSignedRound) {
    return left.lastSignedRound < right.lastSignedRound ? -1 : 1;
  }
  return STEP_ORDER[left.lastSignedStep] - STEP_ORDER[right.lastSignedStep];
}

export function integrityHash(state: SignerSafetyState): string {
  return createHash('sha256')
    .update(
      [
        state.validatorId,
        state.chainId,
        state.lastSignedHeight.toString(),
        state.lastSignedRound.toString(),
        state.lastSignedStep,
        state.canonicalSignBytesHash,
      ].join('|'),
    )
    .digest('hex');
}

export function detectCorruption(state: SignerSafetyState, expected: string): OpsResult<true> {
  if (integrityHash(state) !== expected) {
    return opsErr('SIGNER_CORRUPT', 'signer-safety integrity hash mismatch');
  }
  return opsOk(true);
}

export class SignerSafetyStore {
  readonly safety: DurableSignerSafety;
  readonly #dir: string;

  constructor(dir: string, validatorId: string, chainId: string) {
    this.#dir = dir;
    mkdirSync(dir, { recursive: true });
    this.safety = new DurableSignerSafety(join(dir, 'signer-safety.json'));
    void validatorId;
    void chainId;
  }

  checkpointPath(): string {
    return join(this.#dir, 'safety-checkpoint.json');
  }

  backupPath(): string {
    return join(this.#dir, 'signer-safety.backup.json');
  }

  writeCheckpoint(state: SignerSafetyState, nowUtc: string): SafetyCheckpoint {
    const checkpoint: SafetyCheckpoint = {
      validatorId: state.validatorId,
      chainId: state.chainId,
      lastSignedHeight: state.lastSignedHeight,
      lastSignedRound: state.lastSignedRound,
      lastSignedStep: state.lastSignedStep,
      integrityHash: integrityHash(state),
      createdAtUtc: nowUtc,
    };
    atomicWriteJson(this.checkpointPath(), serializeCheckpoint(checkpoint));
    return checkpoint;
  }

  loadCheckpoint(): SafetyCheckpoint | null {
    if (!existsSync(this.checkpointPath())) {
      return null;
    }
    return deserializeCheckpoint(JSON.parse(readFileSync(this.checkpointPath(), 'utf8')));
  }

  backup(nowUtc: string): OpsResult<SafetyCheckpoint> {
    const state = this.safety.load();
    if (!state) {
      return opsErr('SIGNER_UNAVAILABLE', 'no signer-safety state to back up');
    }
    atomicWriteJson(this.backupPath(), serializeState(state));
    return opsOk(this.writeCheckpoint(state, nowUtc));
  }

  restore(candidate: SignerSafetyState, trusted: SafetyCheckpoint): OpsResult<SignerSafetyState> {
    const integrity = detectCorruption(candidate, integrityHash(candidate));
    if (!integrity.ok) {
      return integrity;
    }
    if (candidate.validatorId !== trusted.validatorId || candidate.chainId !== trusted.chainId) {
      return opsErr('SIGNER_CORRUPT', 'restored signer-safety identity does not match checkpoint');
    }
    if (compareSafetyWatermark(candidate, trusted) < 0) {
      return opsErr(
        'SIGNER_ROLLBACK',
        'restore must never roll signer safety backwards relative to the trusted checkpoint',
      );
    }
    const trustedIntegrity = detectCorruption(
      {
        ...candidate,
        lastSignedHeight: trusted.lastSignedHeight,
        lastSignedRound: trusted.lastSignedRound,
        lastSignedStep: trusted.lastSignedStep,
        canonicalSignBytesHash: candidate.canonicalSignBytesHash,
      },
      trusted.integrityHash,
    );
    if (compareSafetyWatermark(candidate, trusted) === 0 && !trustedIntegrity.ok) {
      return opsErr('SIGNER_CORRUPT', 'checkpoint integrity does not match restored watermark');
    }
    if (compareSafetyWatermark(candidate, trusted) === 0 && trusted.integrityHash !== integrityHash(candidate)) {
      return opsErr('SIGNER_CORRUPT', 'restored state failed high-watermark integrity verification');
    }
    this.safety.persist(candidate);
    return opsOk(candidate);
  }

  refuseRollback(request: ConsensusSignRequest): OpsResult<true> {
    const existing = this.safety.load();
    if (!existing) {
      return opsOk(true);
    }
    const candidate = {
      lastSignedHeight: request.height,
      lastSignedRound: request.round,
      lastSignedStep: request.messageType,
    };
    if (compareSafetyWatermark(candidate, existing) < 0) {
      return opsErr('SIGNER_ROLLBACK', 'signer safety refuses a height/round/step behind the high watermark');
    }
    return opsOk(true);
  }
}

function atomicWriteJson(path: string, body: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(body), { encoding: 'utf8', mode: 0o600 });
  renameSync(tmp, path);
}

function serializeState(state: SignerSafetyState): Record<string, string> {
  return {
    ...state,
    lastSignedHeight: state.lastSignedHeight.toString(),
    lastSignedRound: state.lastSignedRound.toString(),
  };
}

function serializeCheckpoint(checkpoint: SafetyCheckpoint): Record<string, string> {
  return {
    ...checkpoint,
    lastSignedHeight: checkpoint.lastSignedHeight.toString(),
    lastSignedRound: checkpoint.lastSignedRound.toString(),
  };
}

function field(raw: Record<string, string>, key: string): string {
  const value = raw[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`signer-safety checkpoint missing ${key}`);
  }
  return value;
}

function deserializeCheckpoint(raw: Record<string, string>): SafetyCheckpoint {
  return {
    validatorId: field(raw, 'validatorId'),
    chainId: field(raw, 'chainId'),
    lastSignedHeight: BigInt(field(raw, 'lastSignedHeight')),
    lastSignedRound: BigInt(field(raw, 'lastSignedRound')),
    lastSignedStep: field(raw, 'lastSignedStep') as SafetyCheckpoint['lastSignedStep'],
    integrityHash: field(raw, 'integrityHash'),
    createdAtUtc: field(raw, 'createdAtUtc'),
  };
}
