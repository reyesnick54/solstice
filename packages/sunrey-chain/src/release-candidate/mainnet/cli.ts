import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import {
  compareMainnetReleaseCandidates,
  createMainnetReleaseCandidate,
  mainnetRcStatusPayload,
  supersedeMainnetReleaseCandidate,
  verifyMainnetReleaseCandidate,
  writeMainnetRcBundle,
} from './registry.ts';
import { loadMainnetKnownLimitations } from './limitations.ts';
import { MAINNET_QUALIFICATION_PROFILES, type MainnetQualificationProfile, type SignedMainnetRcBundle } from './types.ts';

export type MainnetRcCliResult = {
  readonly ok: boolean;
  readonly command: string;
  readonly payload: unknown;
};

const STORE = ['dist', 'mainnet-rc'] as const;

function storeDir(root: string): string {
  return join(root, ...STORE);
}

function storePath(root: string, name: string): string {
  return join(storeDir(root), name);
}

function readBundle(path: string): SignedMainnetRcBundle {
  return JSON.parse(readFileSync(path, 'utf8')) as SignedMainnetRcBundle;
}

function flagValue(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index < 0) {
    return undefined;
  }
  return argv[index + 1];
}

function profileOf(argv: readonly string[]): MainnetQualificationProfile {
  const raw = flagValue(argv, '--profile') ?? 'smoke';
  if ((MAINNET_QUALIFICATION_PROFILES as readonly string[]).includes(raw)) {
    return raw as MainnetQualificationProfile;
  }
  return 'smoke';
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function runSunreyReleaseMainnet(root: string, argv: readonly string[]): MainnetRcCliResult {
  if (!process.env.SUNREY_FIXTURE_ENV) {
    process.env.SUNREY_FIXTURE_ENV = 'local';
  }
  const [command = 'help'] = argv;
  if (command === 'create' || command === 'qualify') {
    const previousPath = storePath(root, 'current.json');
    const previous = existsSync(previousPath) ? readBundle(previousPath) : null;
    const created = createMainnetReleaseCandidate({
      root,
      profile: profileOf(argv),
      ...(flagValue(argv, '--id') ? { rcId: flagValue(argv, '--id') } : {}),
      ...(flagValue(argv, '--commit') ? { sourceCommit: flagValue(argv, '--commit') } : {}),
      ...(flagValue(argv, '--candidate-v2') ? { expectedCandidateV2Hash: flagValue(argv, '--candidate-v2') } : {}),
      previous: command === 'qualify' ? previous : null,
    });
    writeMainnetRcBundle(storeDir(root), created.bundle);
    writeJson(storePath(root, 'current.json'), created.bundle);
    return {
      ok: !created.bundle.qualification.cells.some((row) => row.state === 'FAIL'),
      command: `mainnet ${command}`,
      payload: created.report,
    };
  }

  if (command === 'status') {
    const path = storePath(root, 'current.json');
    if (!existsSync(path)) {
      return { ok: false, command: 'mainnet status', payload: { error: 'no current Mainnet RC' } };
    }
    return { ok: true, command: 'mainnet status', payload: mainnetRcStatusPayload(readBundle(path)) };
  }

  if (command === 'verify') {
    const path = flagValue(argv, '--bundle') ?? storePath(root, 'current.json');
    if (!existsSync(path)) {
      const created = createMainnetReleaseCandidate({ root, profile: 'smoke' });
      writeMainnetRcBundle(storeDir(root), created.bundle);
      writeJson(storePath(root, 'current.json'), created.bundle);
      const report = verifyMainnetReleaseCandidate(created.bundle, created.bundle.manifest.source_commit, root);
      return { ok: report.ok, command: 'mainnet verify', payload: report };
    }
    const report = verifyMainnetReleaseCandidate(readBundle(path), flagValue(argv, '--commit'), root);
    return { ok: report.ok, command: 'mainnet verify', payload: report };
  }

  if (command === 'compare') {
    const leftPath = flagValue(argv, '--left') ?? storePath(root, 'previous.json');
    const rightPath = flagValue(argv, '--right') ?? storePath(root, 'current.json');
    if (!existsSync(rightPath)) {
      return { ok: false, command: 'mainnet compare', payload: { error: 'missing candidate to compare' } };
    }
    const right = readBundle(rightPath);
    const left = existsSync(leftPath) ? readBundle(leftPath) : right;
    return { ok: true, command: 'mainnet compare', payload: compareMainnetReleaseCandidates(left, right) };
  }

  if (command === 'limitations') {
    const path = storePath(root, 'current.json');
    const limitations = existsSync(path) ? readBundle(path).limitations : loadMainnetKnownLimitations(root);
    return {
      ok: true,
      command: 'mainnet limitations',
      payload: { limitations, hidden: false },
    };
  }

  if (command === 'evidence') {
    const path = storePath(root, 'current.json');
    if (!existsSync(path)) {
      return { ok: false, command: 'mainnet evidence', payload: { error: 'no current Mainnet RC' } };
    }
    const bundle = readBundle(path);
    return {
      ok: true,
      command: 'mainnet evidence',
      payload: {
        rcId: bundle.manifest.mainnet_rc_id,
        sourceCommit: bundle.manifest.source_commit,
        candidateV2Hash: bundle.manifest.candidate_v2_hash,
        economicRcHash: bundle.manifest.economic_rc_hash,
        providers: bundle.providers,
        audit: bundle.audit,
        hsm: bundle.hsm,
        formal: bundle.evidence.formal,
        fuzz: bundle.evidence.fuzz,
        adversarial: bundle.evidence.adversarial,
        economicStress: bundle.evidence.economicStress,
        performance: bundle.evidence.performance,
        mainnetEnabled: false,
      },
    };
  }

  if (command === 'supersede') {
    const currentPath = storePath(root, 'current.json');
    const previous = existsSync(currentPath) ? readBundle(currentPath) : null;
    const created = createMainnetReleaseCandidate({
      root,
      profile: profileOf(argv),
      previous,
      ...(flagValue(argv, '--commit') ? { sourceCommit: flagValue(argv, '--commit') } : {}),
    });
    const pair = previous
      ? supersedeMainnetReleaseCandidate(previous, created.bundle)
      : { previous: created.bundle, next: created.bundle };
    writeJson(storePath(root, 'previous.json'), pair.previous);
    writeJson(storePath(root, 'current.json'), pair.next);
    writeMainnetRcBundle(storeDir(root), pair.next);
    return {
      ok: true,
      command: 'mainnet supersede',
      payload: {
        superseded: pair.previous.manifest.mainnet_rc_id,
        current: pair.next.manifest.mainnet_rc_id,
        status: pair.previous.manifest.qualification_result,
        retained: true,
      },
    };
  }

  return {
    ok: command === 'help',
    command: command === 'help' ? 'mainnet help' : `mainnet ${command}`,
    payload: {
      usage: 'sunrey-release mainnet <create|qualify|verify|status|compare|limitations|evidence|supersede>',
      profiles: MAINNET_QUALIFICATION_PROFILES,
      mainnetEnabled: false,
    },
  };
}
