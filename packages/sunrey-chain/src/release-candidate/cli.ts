import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import {
  compareReleaseCandidates,
  createReleaseCandidate,
  rcStatusPayload,
  supersedeReleaseCandidate,
  verifyReleaseCandidate,
  writeRcBundle,
  type CreatedCandidate,
} from './registry.ts';
import type { QualificationProfile, SignedRcBundle } from './types.ts';
import { QUALIFICATION_PROFILES } from './types.ts';

export type RcCliResult = {
  readonly ok: boolean;
  readonly command: string;
  readonly payload: unknown;
};

const STORE = ['dist', 'testnet-rc'] as const;

function storeDir(root: string): string {
  return join(root, ...STORE);
}

function storePath(root: string, name: string): string {
  return join(storeDir(root), name);
}

function readBundle(path: string): SignedRcBundle {
  return JSON.parse(readFileSync(path, 'utf8')) as SignedRcBundle;
}

function flagValue(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index < 0) {
    return undefined;
  }
  return argv[index + 1];
}

function optionalFlag<K extends string>(key: K, value: string | undefined): Partial<Record<K, string>> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, string>);
}

function profileOf(argv: readonly string[]): QualificationProfile {
  const raw = flagValue(argv, '--profile') ?? 'smoke';
  if ((QUALIFICATION_PROFILES as readonly string[]).includes(raw)) {
    return raw as QualificationProfile;
  }
  return 'smoke';
}

export function runSunreyReleaseRc(root: string, argv: readonly string[]): RcCliResult {
  const [command = 'help'] = argv;
  if (command === 'create' || command === 'qualify') {
    const previousPath = storePath(root, 'current.json');
    const previous = existsSync(previousPath) ? readBundle(previousPath) : null;
    const rcId = flagValue(argv, '--id');
    const sourceCommit = flagValue(argv, '--commit');
    const created = createReleaseCandidate({
      root,
      profile: profileOf(argv),
      ...(rcId ? { rcId } : {}),
      ...(sourceCommit ? { sourceCommit } : {}),
      ...(rcId !== undefined ? { rcId } : {}),
      ...(sourceCommit !== undefined ? { sourceCommit } : {}),
      ...optionalFlag('rcId', flagValue(argv, '--id')),
      ...optionalFlag('sourceCommit', flagValue(argv, '--commit')),
      ...(rcId === undefined ? {} : { rcId }),
      ...(sourceCommit === undefined ? {} : { sourceCommit }),
      previous: command === 'qualify' ? previous : null,
      enduranceTicks: Number(flagValue(argv, '--ticks') ?? '8'),
    });
    writeRcBundle(storeDir(root), created.bundle);
    writeFileSyncJson(storePath(root, 'current.json'), created.bundle);
    return {
      ok: !created.evidence.matrix.cells.some((row) => row.state === 'FAIL'),
      command: `rc ${command}`,
      payload: {
        rcId: created.bundle.manifest.rc_id,
        status: created.bundle.manifest.qualification_state,
        sourceCommit: created.bundle.manifest.source_commit,
        protocolVersion: created.bundle.manifest.protocol_version,
        genesisHash: created.bundle.manifest.genesis_hash,
        matrix: created.evidence.matrix.cells.map((row) => ({ category: row.category, state: row.state })),
        formal: created.evidence.formal,
        adversarial: created.evidence.adversarial,
        pqc: created.evidence.pqc,
        sevenValidator: created.evidence.sevenValidator,
        upgrade: created.evidence.upgrade,
        recovery: { snapshot: created.evidence.snapshot, database: created.evidence.database, explorer: created.evidence.explorer },
        performance: created.evidence.performance,
        knownLimitations: created.bundle.notes.knownLimitations.map((row) => row.id),
        mainnetReady: false,
      },
    };
  }

  if (command === 'status') {
    const path = storePath(root, 'current.json');
    if (!existsSync(path)) {
      return { ok: false, command: 'rc status', payload: { error: 'no current RC' } };
    }
    return { ok: true, command: 'rc status', payload: rcStatusPayload(readBundle(path)) };
  }

  if (command === 'verify') {
    const path = flagValue(argv, '--bundle') ?? storePath(root, 'current.json');
    if (!existsSync(path)) {
      const created = createReleaseCandidate({ root, profile: 'smoke' });
      writeRcBundle(storeDir(root), created.bundle);
      writeFileSyncJson(storePath(root, 'current.json'), created.bundle);
      const report = verifyReleaseCandidate(created.bundle, created.bundle.manifest.source_commit);
      return { ok: report.ok, command: 'rc verify', payload: report };
    }
    const report = verifyReleaseCandidate(readBundle(path));
    return { ok: report.ok, command: 'rc verify', payload: report };
  }

  if (command === 'compare') {
    const leftPath = flagValue(argv, '--left') ?? storePath(root, 'previous.json');
    const rightPath = flagValue(argv, '--right') ?? storePath(root, 'current.json');
    if (!existsSync(rightPath)) {
      return { ok: false, command: 'rc compare', payload: { error: 'missing candidate to compare' } };
    }
    const right = readBundle(rightPath);
    const left = existsSync(leftPath) ? readBundle(leftPath) : right;
    return { ok: true, command: 'rc compare', payload: compareReleaseCandidates(left, right) };
  }

  if (command === 'supersede') {
    const currentPath = storePath(root, 'current.json');
    const previous = existsSync(currentPath) ? readBundle(currentPath) : null;
    const sourceCommit = flagValue(argv, '--commit');
    const created = createReleaseCandidate({
      root,
      profile: profileOf(argv),
      previous,
      ...(sourceCommit ? { sourceCommit } : {}),
      ...(sourceCommit !== undefined ? { sourceCommit } : {}),
      ...optionalFlag('sourceCommit', flagValue(argv, '--commit')),
      ...(sourceCommit === undefined ? {} : { sourceCommit }),
    });
    const pair = previous
      ? supersedeReleaseCandidate(previous, created.bundle)
      : { previous: created.bundle, next: created.bundle };
    writeFileSyncJson(storePath(root, 'previous.json'), pair.previous);
    writeFileSyncJson(storePath(root, 'current.json'), pair.next);
    writeRcBundle(storeDir(root), pair.next);
    return {
      ok: true,
      command: 'rc supersede',
      payload: {
        superseded: pair.previous.manifest.rc_id,
        current: pair.next.manifest.rc_id,
        status: pair.previous.manifest.qualification_state,
        retained: true,
      },
    };
  }

  return {
    ok: command === 'help',
    command: command === 'help' ? 'rc help' : `rc ${command}`,
    payload: {
      usage: 'sunrey-release rc <create|qualify|status|verify|compare|supersede>',
      profiles: QUALIFICATION_PROFILES,
      mainnetReady: false,
    },
  };
}

function writeFileSyncJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export type { CreatedCandidate };
