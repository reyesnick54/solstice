import type { OwnershipEntry } from './types.ts';

/**
 * Reviewer-oriented map from subsystem to canonical implementation paths.
 * Paths are the current owners. Alternate subsystem owners are not invented.
 */
export const CODE_OWNERSHIP_MAP: readonly OwnershipEntry[] = Object.freeze([
  {
    subsystem: 'consensus',
    domain: 'CONSENSUS',
    canonicalPath: 'packages/sunrey-chain/rust/crates/consensus',
    additionalPaths: ['packages/sunrey-chain/src/validators', 'packages/sunrey-chain/node/src/consensus'],
  },
  {
    subsystem: 'protocol-encoding',
    domain: 'PROTOCOL_ENCODING',
    canonicalPath: 'packages/sunrey-chain/src/protocol',
    additionalPaths: ['packages/sunrey-chain/protocol/v1', 'packages/sunrey-chain/rust/crates/protocol'],
  },
  {
    subsystem: 'cryptography',
    domain: 'CRYPTOGRAPHY',
    canonicalPath: 'packages/security',
    additionalPaths: ['packages/security/src/crypto-suite.ts', 'packages/security/src/ed25519-provider.ts'],
  },
  {
    subsystem: 'security',
    domain: 'CRYPTOGRAPHY',
    canonicalPath: 'packages/security',
    additionalPaths: ['packages/security/src/hsm-kms.ts', 'packages/security/src/hsm-simulator.ts'],
  },
  {
    subsystem: 'pqc',
    domain: 'PQC',
    canonicalPath: 'packages/security/src/pq-provider.ts',
    additionalPaths: ['packages/sunrey-chain/src/pqc', 'packages/security/src/crypto-hybrid.ts'],
  },
  {
    subsystem: 'wallets',
    domain: 'WALLETS',
    canonicalPath: 'packages/sunrey-chain/src/wallet',
    additionalPaths: ['packages/sunrey-chain/rust/crates/wallet'],
  },
  {
    subsystem: 'validators',
    domain: 'VALIDATORS',
    canonicalPath: 'packages/sunrey-chain/src/validators',
    additionalPaths: ['packages/sunrey-chain/src/ops', 'packages/sunrey-chain/rust/crates/validators'],
  },
  {
    subsystem: 'native-assets',
    domain: 'NATIVE_ASSETS',
    canonicalPath: 'packages/sunrey-chain/src/native-assets',
    additionalPaths: ['packages/sunrey-chain/rust/crates/native-assets'],
  },
  {
    subsystem: 'moonrey-issuance',
    domain: 'MOONREY_ISSUANCE',
    canonicalPath: 'packages/sunrey-chain/src/productive',
    additionalPaths: ['packages/sunrey-chain/rust/crates/productive'],
  },
  {
    subsystem: 'exchange',
    domain: 'EXCHANGE',
    canonicalPath: 'packages/sunrey-exchange',
    additionalPaths: ['packages/sunrey-exchange/src/native-clearing'],
  },
  {
    subsystem: 'custody',
    domain: 'CUSTODY',
    canonicalPath: 'packages/custody',
    additionalPaths: ['packages/custody/src/institutional', 'packages/sunrey-chain/src/native-custody'],
  },
  {
    subsystem: 'oracles',
    domain: 'ORACLES',
    canonicalPath: 'packages/sunrey-chain/src/oracle',
    additionalPaths: ['packages/sunrey-chain/rust/crates/oracle'],
  },
  {
    subsystem: 'machine-economy',
    domain: 'MACHINE_ECONOMY',
    canonicalPath: 'packages/sunrey-chain/src/machine-economy',
    additionalPaths: [],
  },
  {
    subsystem: 'interoperability',
    domain: 'INTEROPERABILITY',
    canonicalPath: 'packages/sunrey-chain/src/interop',
    additionalPaths: ['packages/sunrey-chain/rust/crates/interop'],
  },
  {
    subsystem: 'privacy',
    domain: 'PRIVACY',
    canonicalPath: 'packages/personal-data-vault',
    additionalPaths: ['packages/consent', 'packages/clean-room', 'packages/information-market'],
  },
  {
    subsystem: 'supply-chain',
    domain: 'SUPPLY_CHAIN',
    canonicalPath: 'packages/sunrey-chain/src/supply-chain',
    additionalPaths: ['packages/sunrey-chain/supply-chain'],
  },
  {
    subsystem: 'operations',
    domain: 'OPERATIONS',
    canonicalPath: 'packages/sunrey-chain/src/ops',
    additionalPaths: ['packages/sunrey-chain/src/testnet', 'packages/sunrey-chain/src/perf'],
  },
  {
    subsystem: 'explorer',
    domain: 'PRIVACY',
    canonicalPath: 'packages/sunrey-explorer',
    additionalPaths: ['apps/explorer', 'docs/architecture/explorer-privacy-policy.md'],
  },
  {
    subsystem: 'sdk',
    domain: 'PROTOCOL_ENCODING',
    canonicalPath: 'packages/sunrey-sdk',
    additionalPaths: ['packages/sunrey-chain/rust/crates/sdk'],
  },
  {
    subsystem: 'adversarial-range',
    domain: 'OPERATIONS',
    canonicalPath: 'packages/sunrey-range',
    additionalPaths: ['docs/assurance/chunk-57-adversarial-range.md'],
  },
  {
    subsystem: 'assurance',
    domain: 'CONSENSUS',
    canonicalPath: 'packages/sunrey-chain/src/assurance',
    additionalPaths: ['packages/sunrey-chain/rust/crates/assurance', 'tests/assurance'],
  },
]);

export function ownershipFor(subsystem: string): OwnershipEntry | undefined {
  return CODE_OWNERSHIP_MAP.find((row) => row.subsystem === subsystem);
}
