import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import {
  compareEconomicReleaseCandidates,
  createEconomicReleaseCandidate,
  economicRcStatusPayload,
  supersedeEconomicReleaseCandidate,
  verifyEconomicReleaseCandidate,
  writeEconomicRcBundle,
} from './registry.ts';
import { ECONOMIC_QUALIFICATION_PROFILES, type EconomicQualificationProfile, type SignedEconomicRcBundle } from './types.ts';

export type EconomicRcCliResult = {
  readonly ok: boolean;
  readonly command: string;
  readonly payload: unknown;
};

const STORE = ['dist', 'economic-rc'] as const;

function storeDir(root: string): string {
  return join(root, ...STORE);
}

function storePath(root: string, name: string): string {
  return join(storeDir(root), name);
}

function readBundle(path: string): SignedEconomicRcBundle {
  return JSON.parse(readFileSync(path, 'utf8')) as SignedEconomicRcBundle;
}

function flagValue(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index < 0) {
    return undefined;
  }
  return argv[index + 1];
}

function profileOf(argv: readonly string[]): EconomicQualificationProfile {
  const raw = flagValue(argv, '--profile') ?? 'smoke';
  if (raw === 'endurance') {
    return 'extended';
  }
  if ((ECONOMIC_QUALIFICATION_PROFILES as readonly string[]).includes(raw)) {
    return raw as EconomicQualificationProfile;
  }
  return 'smoke';
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function runSunreyReleaseEconomic(root: string, argv: readonly string[]): EconomicRcCliResult {
  const [command = 'help'] = argv;
  if (command === 'create' || command === 'qualify') {
    const previousPath = storePath(root, 'current.json');
    const previous = existsSync(previousPath) ? readBundle(previousPath) : null;
    const created = createEconomicReleaseCandidate({
      root,
      profile: profileOf(argv),
      ...(flagValue(argv, '--id') ? { rcId: flagValue(argv, '--id') } : {}),
      ...(flagValue(argv, '--commit') ? { sourceCommit: flagValue(argv, '--commit') } : {}),
      previous: command === 'qualify' ? previous : null,
    });
    writeEconomicRcBundle(storeDir(root), created.bundle);
    writeJson(storePath(root, 'current.json'), created.bundle);
    return {
      ok: !created.bundle.qualification.cells.some((row) => row.state === 'FAIL'),
      command: `economic ${command}`,
      payload: created.report,
    };
  }

  if (command === 'status') {
    const path = storePath(root, 'current.json');
    if (!existsSync(path)) {
      return { ok: false, command: 'economic status', payload: { error: 'no current economic RC' } };
    }
    return { ok: true, command: 'economic status', payload: economicRcStatusPayload(readBundle(path)) };
  }

  if (command === 'verify') {
    const path = flagValue(argv, '--bundle') ?? storePath(root, 'current.json');
    if (!existsSync(path)) {
      const created = createEconomicReleaseCandidate({ root, profile: 'smoke' });
      writeEconomicRcBundle(storeDir(root), created.bundle);
      writeJson(storePath(root, 'current.json'), created.bundle);
      const report = verifyEconomicReleaseCandidate(created.bundle, created.bundle.manifest.source_commit, root);
      return { ok: report.ok, command: 'economic verify', payload: report };
    }
    const report = verifyEconomicReleaseCandidate(readBundle(path), undefined, root);
    return { ok: report.ok, command: 'economic verify', payload: report };
  }

  if (command === 'compare') {
    const leftPath = flagValue(argv, '--left') ?? storePath(root, 'previous.json');
    const rightPath = flagValue(argv, '--right') ?? storePath(root, 'current.json');
    if (!existsSync(rightPath)) {
      return { ok: false, command: 'economic compare', payload: { error: 'missing candidate to compare' } };
    }
    const right = readBundle(rightPath);
    const left = existsSync(leftPath) ? readBundle(leftPath) : right;
    return { ok: true, command: 'economic compare', payload: compareEconomicReleaseCandidates(left, right) };
  }

  if (command === 'supersede') {
    const currentPath = storePath(root, 'current.json');
    const previous = existsSync(currentPath) ? readBundle(currentPath) : null;
    const created = createEconomicReleaseCandidate({
      root,
      profile: profileOf(argv),
      previous,
      ...(flagValue(argv, '--commit') ? { sourceCommit: flagValue(argv, '--commit') } : {}),
    });
    const pair = previous
      ? supersedeEconomicReleaseCandidate(previous, created.bundle)
      : { previous: created.bundle, next: created.bundle };
    writeJson(storePath(root, 'previous.json'), pair.previous);
    writeJson(storePath(root, 'current.json'), pair.next);
    writeEconomicRcBundle(storeDir(root), pair.next);
    return {
      ok: true,
      command: 'economic supersede',
      payload: {
        superseded: pair.previous.manifest.economic_rc_id,
        current: pair.next.manifest.economic_rc_id,
        status: pair.previous.manifest.qualification_result,
        retained: true,
      },
    };
  }

  return {
    ok: command === 'help',
    command: command === 'help' ? 'economic help' : `economic ${command}`,
    payload: {
      usage: 'sunrey-release economic <create|qualify|status|verify|compare|supersede>',
      profiles: ECONOMIC_QUALIFICATION_PROFILES,
      mainnetReady: false,
    },
  };
}
