import { spawnSync } from 'node:child_process';

import { FIRST_RC_ID, RC_ID_PREFIX } from './types.ts';

export function isReleaseCandidateId(value: string): boolean {
  return new RegExp(`^${RC_ID_PREFIX}[1-9][0-9]*$`).test(value);
}

export function rcSequence(rcId: string): number {
  if (!isReleaseCandidateId(rcId)) {
    throw new TypeError(`invalid release candidate id ${rcId}`);
  }
  return Number(rcId.slice(RC_ID_PREFIX.length));
}

export function nextReleaseCandidateId(current: string | null): string {
  if (current === null) {
    return FIRST_RC_ID;
  }
  return `${RC_ID_PREFIX}${rcSequence(current) + 1}`;
}

export function resolveSourceCommit(root: string, override?: string): string {
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

export function utcNow(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}
