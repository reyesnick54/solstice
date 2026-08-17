import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createSnapshot, persistSnapshot, restoreSnapshot, verifySnapshot } from '../ops/snapshots.ts';
import { caseResult } from './result.ts';
import { elapsedNs, measureMany, nowNs, summarizeLatency } from './statistics.ts';
import type { BenchCaseResult } from './types.ts';

const TRUST = Object.freeze({
  networkId: 'net_sunrey_simulation',
  chainId: 'chn_sunrey_simulation',
  protocolVersion: 'sunrey.protocol.v1',
  trustedFinalizedHeight: 10_000n,
});

export function measureStorage(input: { readonly snapshots: number }): readonly BenchCaseResult[] {
  const persist: number[] = [];
  const restore: number[] = [];
  const verify: number[] = [];
  const root = mkdtempSync(join(tmpdir(), 'sunrey-perf-'));
  try {
    for (let i = 0; i < input.snapshots; i += 1) {
      const created = createSnapshot({
        networkId: TRUST.networkId,
        chainId: TRUST.chainId,
        height: BigInt(i + 1),
        blockId: `blk_${i + 1}`,
        stateRoot: `state_${i + 1}`,
        protocolVersion: TRUST.protocolVersion,
        validatorSetHash: 'valset_dev',
        validatorSetVersion: 1n,
        payload: `wal-record-${i}`,
        createdAtUtc: '2026-08-17T00:00:00.000Z',
      });
      if (!created.ok) {
        throw new Error(created.error.detail);
      }
      const persistStarted = nowNs();
      persistSnapshot(root, created.value);
      persist.push(elapsedNs(persistStarted));
      const verifyStarted = nowNs();
      const verified = verifySnapshot(created.value, TRUST);
      verify.push(elapsedNs(verifyStarted));
      if (!verified.ok) {
        throw new Error(verified.error.detail);
      }
      const restoreStarted = nowNs();
      const loaded = restoreSnapshot(created.value, TRUST, root);
      restore.push(elapsedNs(restoreStarted));
      if (!loaded.ok) {
        throw new Error(loaded.error.detail);
      }
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }

  const restart = measureMany(input.snapshots, () => {
    const engineRoot = mkdtempSync(join(tmpdir(), 'sunrey-perf-restart-'));
    const created = createSnapshot({
      networkId: TRUST.networkId,
      chainId: TRUST.chainId,
      height: 4n,
      blockId: 'blk_4',
      stateRoot: 'state_4',
      protocolVersion: TRUST.protocolVersion,
      validatorSetHash: 'valset_dev',
      validatorSetVersion: 1n,
      payload: 'restart-payload',
      createdAtUtc: '2026-08-17T00:00:00.000Z',
    });
    if (!created.ok) {
      throw new Error(created.error.detail);
    }
    persistSnapshot(engineRoot, created.value);
    restoreSnapshot(created.value, TRUST, engineRoot);
    rmSync(engineRoot, { recursive: true, force: true });
  });

  return [
    caseResult('storage', 'block_persist_snapshot', { latency: summarizeLatency(persist) }),
    caseResult('storage', 'snapshot_verify', { latency: summarizeLatency(verify) }),
    caseResult('storage', 'snapshot_restore', { latency: summarizeLatency(restore) }),
    caseResult('storage', 'restart_recovery', { latency: summarizeLatency(restart) }),
  ];
}
