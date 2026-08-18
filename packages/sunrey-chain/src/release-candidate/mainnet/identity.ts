import { spawnSync } from 'node:child_process';

import { FIRST_MAINNET_RC_ID, MAINNET_RC_ID_PREFIX } from './types.ts';

export function isMainnetReleaseCandidateId(value: string): boolean {
  return new RegExp(`^${MAINNET_RC_ID_PREFIX}[1-9][0-9]*$`).test(value);
}

export function mainnetRcSequence(rcId: string): number {
  if (!isMainnetReleaseCandidateId(rcId)) {
    throw new TypeError(`invalid mainnet release candidate id ${rcId}`);
  }
  return Number(rcId.slice(MAINNET_RC_ID_PREFIX.length));
}

export function nextMainnetReleaseCandidateId(current: string | null): string {
  if (current === null) {
    return FIRST_MAINNET_RC_ID;
  }
  return `${MAINNET_RC_ID_PREFIX}${mainnetRcSequence(current) + 1}`;
}

export function resolveMainnetSourceCommit(root: string, override?: string): string {
  if (override && override.length > 0) {
    return override;
  }
  if (process.env.GITHUB_SHA && process.env.GITHUB_SHA.length > 0) {
    return process.env.GITHUB_SHA;
  }
  const git = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  if (git.status === 0) {
    return git.stdout.trim();
  }
  return 'local';
}

export function mainnetUtcNow(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}
