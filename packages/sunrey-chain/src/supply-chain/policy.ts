import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type {
  AuditFinding,
  CryptoPrimitive,
  DependencyPolicy,
  PolicyClassification,
  PolicyPackage,
} from './types.ts';
import { CRYPTO_PRIMITIVES } from './types.ts';

export const POLICY_DIR = 'packages/sunrey-chain/supply-chain';

export function loadJson<T>(root: string, relative: string): T {
  return JSON.parse(readFileSync(join(root, relative), 'utf8')) as T;
}

export function loadDependencyPolicy(root: string): DependencyPolicy {
  const policy = loadJson<DependencyPolicy>(root, `${POLICY_DIR}/dependency-policy.json`);
  if (policy.popularityIsNotSecurity !== true) {
    throw new Error('dependency policy must not treat popularity as security');
  }
  if (policy.notLegalAdvice !== true) {
    throw new Error('dependency policy must not make legal conclusions');
  }
  return policy;
}

export function classifyPackage(policy: DependencyPolicy, name: string, ecosystem: string): PolicyPackage {
  const found = policy.packages.find((row) => row.name === name && row.ecosystem === ecosystem);
  if (found) {
    return found;
  }
  return {
    name,
    ecosystem,
    classification: policy.unknownDefault,
    notes: 'Unknown to policy. Popularity is not used as a security signal.',
  };
}

export function isBlocked(policy: DependencyPolicy, name: string, ecosystem: string): boolean {
  return classifyPackage(policy, name, ecosystem).classification === 'BLOCKED';
}

export type CryptoInventory = {
  readonly entries: readonly { readonly name: string; readonly primitives: readonly string[] }[];
};

export function loadCryptoInventory(root: string): CryptoInventory {
  return loadJson<CryptoInventory>(root, `${POLICY_DIR}/crypto-inventory.json`);
}

export function isCryptoPrimitiveLibrary(name: string, primitives: readonly string[]): boolean {
  return primitives.some((item) => (CRYPTO_PRIMITIVES as readonly string[]).includes(item));
}

export function unregisteredCryptoFinding(
  name: string,
  primitives: readonly CryptoPrimitive[],
  inventory: CryptoInventory,
): AuditFinding | null {
  if (primitives.length === 0) {
    return null;
  }
  const registered = inventory.entries.some((row) => row.name === name);
  if (registered) {
    return null;
  }
  return {
    kind: 'unregistered_crypto',
    name,
    severity: 'fail',
    detail: `unregistered cryptographic library implementing ${primitives.join(',')}`,
  };
}

export function blockedPackageFinding(policy: DependencyPolicy, name: string, ecosystem: string): AuditFinding | null {
  if (!isBlocked(policy, name, ecosystem)) {
    return null;
  }
  return {
    kind: 'blocked_package',
    name,
    severity: 'fail',
    detail: `${ecosystem} package is BLOCKED by DependencyPolicy`,
  };
}

export function unlockedDependencyFinding(lockfilePresent: boolean, name: string): AuditFinding | null {
  if (lockfilePresent) {
    return null;
  }
  return {
    kind: 'unlocked_dependency',
    name,
    severity: 'fail',
    detail: 'dependency change is not represented in a committed lockfile',
  };
}

export function policyAllowsClassification(value: string): value is PolicyClassification {
  return value === 'APPROVED' || value === 'REVIEW_REQUIRED' || value === 'TEMPORARY_EXCEPTION' || value === 'BLOCKED';
}
