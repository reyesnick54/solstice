import { execSync } from 'node:child_process';

export const ENGINEERING_CLOSURE_NOW_UTC = '2026-08-21T00:00:00.000Z' as const;
export const CLOSURE_HASH_DOMAIN = 'SUNREY_ENGINEERING_CLOSURE_V1' as const;
export const AUDIT_HASH_DOMAIN = 'SUNREY_PROTECTED_OWNER_AUDIT_V1' as const;
export const MANIFEST_HASH_DOMAIN = 'SUNREY_ARCHITECTURE_MANIFEST_V1' as const;

export function resolveClosureSourceCommit(root = process.cwd()): string {
  try {
    return execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return 'REPOSITORY_HEAD';
  }
}
