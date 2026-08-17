import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { sha256File } from '../supply-chain/inventory.ts';
import type { SourceReproducibility } from './types.ts';

export const PINNED_TOOLCHAINS = Object.freeze({
  node: '22',
  rust: '1.83.0',
});

export const PQC_PROVIDER_VERSION = '@noble/post-quantum@0.5.4' as const;
export const FORMAL_HARNESS_VERSION = 'sunrey-assurance/1' as const;

export function sourceReproducibility(root: string, sourceCommit: string): SourceReproducibility {
  return Object.freeze({
    gitCommit: sourceCommit,
    packageLock: sha256File(root, 'package-lock.json') ?? 'missing',
    cargoLockRust: sha256File(root, 'packages/sunrey-chain/rust/Cargo.lock') ?? 'missing',
    cargoLockNode: sha256File(root, 'packages/sunrey-chain/node/Cargo.lock') ?? 'missing',
    toolchains: PINNED_TOOLCHAINS,
    formalToolVersions: {
      propertyHarness: FORMAL_HARNESS_VERSION,
      machineCheckedProofs: 'NOT_APPLICABLE',
    },
    pqcProviderVersion: PQC_PROVIDER_VERSION,
    testConfiguration: 'FUZZ_SMOKE + sunrey-range campaign --smoke + sunrey-bench sanity + local fixture keys',
  });
}

export function requiredLockfilesPresent(root: string): boolean {
  return [
    'package-lock.json',
    'packages/sunrey-chain/rust/Cargo.lock',
    'packages/sunrey-chain/node/Cargo.lock',
  ].every((rel) => existsSync(join(root, rel)));
}

export function readGenesisHash(root: string): string {
  return readFileSync(join(root, 'packages/sunrey-chain/fixtures/testnet/genesis-hash.txt'), 'utf8').trim();
}
