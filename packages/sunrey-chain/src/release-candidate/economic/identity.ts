import { spawnSync } from 'node:child_process';

import { ECONOMIC_RC_ID_PREFIX, FIRST_ECONOMIC_RC_ID } from './types.ts';

export function isEconomicReleaseCandidateId(value: string): boolean {
  return new RegExp(`^${ECONOMIC_RC_ID_PREFIX}[1-9][0-9]*$`).test(value);
}

export function economicRcSequence(rcId: string): number {
  if (!isEconomicReleaseCandidateId(rcId)) {
    throw new TypeError(`invalid economic release candidate id ${rcId}`);
  }
  return Number(rcId.slice(ECONOMIC_RC_ID_PREFIX.length));
}

export function nextEconomicReleaseCandidateId(current: string | null): string {
  if (current === null) {
    return FIRST_ECONOMIC_RC_ID;
  }
  return `${ECONOMIC_RC_ID_PREFIX}${economicRcSequence(current) + 1}`;
}

export function resolveEconomicSourceCommit(root: string, override?: string): string {
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

export function economicUtcNow(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}
