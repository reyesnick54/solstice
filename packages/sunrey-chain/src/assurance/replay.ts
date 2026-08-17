import { readFileSync } from 'node:fs';

import { decode, processTransaction, ProtocolState } from '../protocol/index.ts';
import { evaluateDifferentialCase, type DifferentialCase } from './differential.ts';
import { consensusCampaign } from './consensus.ts';
import { SeededRng } from './rng.ts';
import type { ReplayExpectation, ReplayFixture } from './types.ts';

export function loadReplayFixture(path: string): ReplayFixture {
  return JSON.parse(readFileSync(path, 'utf8')) as ReplayFixture;
}

export function replayFixture(fixture: ReplayFixture): ReplayExpectation {
  const roots: string[] = [];
  for (const action of fixture.actions) {
    if (action.kind === 'decode') {
      const bytes = Buffer.from(String(action.payload.hex ?? ''), 'hex');
      const result = decode(bytes);
      if (result.ok !== Boolean(action.payload.expectOk)) {
        return { ok: false, rejection: 'decode-mismatch', stateRoots: roots };
      }
    } else if (action.kind === 'process') {
      const bytes = Buffer.from(String(action.payload.hex ?? ''), 'hex');
      const result = processTransaction(bytes, new ProtocolState(), {
        networkId: fixture.networkId,
        chainId: fixture.chainId,
        blockTimeUnixSeconds: 1_750_000_000n,
      });
      if (result.ok !== Boolean(action.payload.expectOk)) {
        return { ok: false, rejection: 'process-mismatch', stateRoots: roots };
      }
    } else if (action.kind === 'differential') {
      const item = action.payload as unknown as DifferentialCase;
      const actual = evaluateDifferentialCase(item);
      for (const [key, value] of Object.entries(item.expected)) {
        if (actual[key] !== value) {
          return { ok: false, rejection: `differential:${item.id}:${key}`, stateRoots: roots };
        }
      }
    } else if (action.kind === 'consensus') {
      const report = consensusCampaign(new SeededRng(fixture.seed), Number(action.payload.events ?? 32));
      roots.push(`finalized:${report.finalized}`);
    }
  }
  return { ok: true, stateRoots: roots.length > 0 ? roots : fixture.expected.stateRoots ?? [] };
}

export function assertReplay(fixture: ReplayFixture): void {
  const actual = replayFixture(fixture);
  if (actual.ok !== fixture.expected.ok) {
    throw new Error(`replay ${fixture.id} expected ok=${fixture.expected.ok} got ${actual.ok}`);
  }
  if (fixture.expected.rejection && actual.rejection !== fixture.expected.rejection) {
    throw new Error(`replay ${fixture.id} rejection ${actual.rejection}`);
  }
}
