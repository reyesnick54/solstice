/**
 * Isolated full-platform candidate identity. Distinct from handoff,
 * launch, economic, and testnet rehearsal identities.
 */

import { spawnSync } from 'node:child_process';

export const FULL_PLATFORM_REHEARSAL_ID = 'full_platform_candidate_rehearsal_1' as const;
export const FULL_PLATFORM_NOW_UTC = '2026-08-20T00:00:00.000Z' as const;
export const FULL_PLATFORM_NETWORK_ID = 'net_sunrey_full_platform_candidate_1' as const;
export const FULL_PLATFORM_CHAIN_ID = 'srn_full_platform_candidate_1' as const;

export const FIXTURE_SUBJECT_ADA = 'subject.fixture.ada' as const;
export const FIXTURE_SUBJECT_BEN = 'subject.fixture.ben' as const;
export const FIXTURE_OWNER_DUAL = 'owner.fixture.dual-asset' as const;

export function resolveFullPlatformSourceCommit(root: string, override?: string): string {
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

export function fullPlatformUtcNow(): string {
  return FULL_PLATFORM_NOW_UTC;
}

export function clockAt(sequence: number): string {
  const base = Date.parse(FULL_PLATFORM_NOW_UTC);
  return new Date(base + sequence * 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
}
