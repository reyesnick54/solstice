import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  SUITE_SUNREY_ED25519_V1,
  SUITE_SUNREY_HYBRID_ED25519_MLDSA_V1,
  SUITE_SUNREY_MLDSA_65_V1,
} from '../../../security/src/index.ts';
import { sha256File, sha256Text } from '../supply-chain/inventory.ts';
import { RELEASE_TARGETS } from '../supply-chain/types.ts';
import {
  TESTNET_CRYPTO_SUITE_POLICY,
  TESTNET_FEE_POLICY,
  TESTNET_MODULE_REGISTRY,
  TESTNET_ORACLE_POLICY,
  buildGenesis,
  testnet1GenesisInput,
} from '../testnet/genesis.ts';
import { SUNREY_TESTNET_1_CHAIN_ID, SUNREY_TESTNET_1_NETWORK_ID, TESTNET_PROTOCOL_VERSION } from '../testnet/identity.ts';
import type {
  ApiFreeze,
  ArtifactFreeze,
  CryptoPolicyFreeze,
  DependencyFreeze,
  ProtocolFreeze,
  ProtocolFreezeKey,
} from './types.ts';
import { PROTOCOL_FREEZE_KEYS, PUBLIC_API_VERSION } from './types.ts';

const PROTOCOL_FREEZE_PATHS: Readonly<Record<ProtocolFreezeKey, readonly string[]>> = {
  canonicalTransactionSchema: [
    'packages/sunrey-chain/src/protocol/envelope.ts',
    'packages/sunrey-chain/src/protocol/codec.ts',
    'packages/sunrey-chain/schemas/srcb-v1.json',
  ],
  blockSchema: ['packages/sunrey-chain/src/protocol/hash.ts', 'packages/sunrey-chain/src/protocol/constants.ts'],
  consensusParameters: ['packages/sunrey-chain/src/testnet/genesis.ts', 'packages/sunrey-chain/src/ops/seven-validator.ts'],
  stateMachineVersion: ['packages/sunrey-chain/src/protocol/state.ts', 'packages/sunrey-chain/src/protocol/constants.ts'],
  nativeAssetSchema: ['packages/sunrey-chain/src/protocol/assets.ts', 'packages/sunrey-chain/src/native-assets/authority.ts'],
  feeSchema: ['packages/sunrey-chain/src/fees/types.ts', 'packages/sunrey-chain/src/fees/schedule.ts'],
  governanceSchema: ['packages/sunrey-chain/src/governance/types.ts', 'packages/sunrey-chain/src/governance/engine.ts'],
  oracleSchema: ['packages/sunrey-chain/src/oracle/types.ts', 'packages/sunrey-chain/src/oracle/schemas.ts'],
  productiveEconomySchema: ['packages/sunrey-chain/src/productive/types.ts', 'packages/sunrey-chain/src/productive/issuance.ts'],
  interopPacketSchema: ['packages/sunrey-chain/src/interop/types.ts', 'packages/sunrey-chain/src/interop/engine.ts'],
};

const API_FREEZE_PATHS = [
  'packages/sunrey-sdk/src/versioning.ts',
  'packages/sunrey-sdk/src/types.ts',
  'packages/sunrey-chain/rust/crates/sdk/src/lib.rs',
];

const ARTIFACT_SOURCE: Readonly<Record<string, readonly string[]>> = {
  'sunrey-node': ['packages/sunrey-chain/node/src/bin/sunrey-node.rs', 'packages/sunrey-chain/src/local-node/codec.ts'],
  'sunrey-rpc': ['packages/sunrey-chain/src/ops/cli.ts', 'packages/sunrey-sdk/src/gateway/server.ts'],
  'sunrey-explorer': ['packages/sunrey-explorer/src/indexer.ts', 'packages/sunrey-explorer/src/cli.ts'],
  'sunrey-faucet': ['packages/sunrey-chain/src/testnet/faucet.ts'],
  'sunrey-relayer': ['packages/sunrey-chain/src/interop/engine.ts'],
  SDK: ['packages/sunrey-sdk/src/index.ts', 'packages/sunrey-chain/rust/crates/sdk/src/lib.rs'],
  'sunrey-exchange': ['packages/sunrey-exchange/src/service.ts'],
  'sunrey-custody': ['packages/custody/src/cli.ts', 'packages/sunrey-chain/src/native-custody/port.ts'],
};

const MODULE_PATHS: Readonly<Record<string, string>> = {
  'native-assets': 'packages/sunrey-chain/src/native-assets/authority.ts',
  fees: 'packages/sunrey-chain/src/fees/types.ts',
  governance: 'packages/sunrey-chain/src/governance/types.ts',
  oracle: 'packages/sunrey-chain/src/oracle/types.ts',
  productive: 'packages/sunrey-chain/src/productive/types.ts',
  wallet: 'packages/sunrey-chain/src/wallet/types.ts',
  interop: 'packages/sunrey-chain/src/interop/types.ts',
};

function digestPaths(root: string, paths: readonly string[]): string {
  return sha256Text(paths.map((rel) => `${rel}:${sha256File(root, rel) ?? `missing:${rel}`}`).join('\n'));
}

export function freezeProtocol(root: string): ProtocolFreeze {
  const hashes = Object.fromEntries(
    PROTOCOL_FREEZE_KEYS.map((key) => [key, digestPaths(root, PROTOCOL_FREEZE_PATHS[key])]),
  ) as Record<ProtocolFreezeKey, string>;
  return Object.freeze({
    protocolVersion: TESTNET_PROTOCOL_VERSION,
    hashes: Object.freeze(hashes),
    combinedHash: sha256Text(PROTOCOL_FREEZE_KEYS.map((key) => `${key}:${hashes[key]}`).join('|')),
  });
}

export function freezeApi(root: string): ApiFreeze {
  return Object.freeze({
    publicApiVersion: PUBLIC_API_VERSION,
    rustSdkCrate: 'sunrey-sdk',
    compatibility: 'BACKWARD_COMPATIBLE',
    breakingChangeRequiresNewRc: true,
    digest: digestPaths(root, API_FREEZE_PATHS),
  });
}

export function freezeCryptoPolicy(): CryptoPolicyFreeze {
  const selectedRolePolicies = Object.freeze({
    VALIDATOR_CONSENSUS_SIGNING: SUITE_SUNREY_ED25519_V1,
    WALLET_SIGNING: SUITE_SUNREY_ED25519_V1,
    ORACLE_SIGNING: SUITE_SUNREY_ED25519_V1,
    GOVERNANCE_SIGNING: SUITE_SUNREY_ED25519_V1,
    HYBRID_SELECTED_VALIDATORS: SUITE_SUNREY_HYBRID_ED25519_MLDSA_V1,
    PQ_CAPABLE_WALLET: SUITE_SUNREY_MLDSA_65_V1,
  });
  const body = {
    policyId: TESTNET_CRYPTO_SUITE_POLICY,
    classicalAlgorithms: Object.freeze(['Ed25519', 'SHA-256', 'AES-256-GCM']),
    pqProvider: '@noble/post-quantum',
    pqProviderVersion: '0.5.4',
    hybridRequired: true,
    selectedRolePolicies,
    legacyVerificationPolicy: 'historicalVerifyAllowed for previously accepted suites; silent downgrade rejected',
    productionCryptographicApproval: false as const,
    quantumProofClaim: false as const,
  };
  return Object.freeze({
    ...body,
    digest: sha256Text(JSON.stringify(body)),
  });
}

function containerDigests(root: string): Record<string, string> {
  const compose = join(root, 'deploy/sunrey-testnet');
  const out: Record<string, string> = {};
  const candidates = [
    'deploy/sunrey-testnet/docker-compose.yml',
    'deploy/sunrey-testnet/k8s/namespace.yaml',
  ];
  for (const rel of candidates) {
    const digest = sha256File(root, rel);
    if (digest) {
      out[rel] = digest;
    }
  }
  if (!existsSync(compose) && Object.keys(out).length === 0) {
    out.unavailable = 'not-present';
  }
  return out;
}

export function freezeDependencies(root: string): DependencyFreeze {
  const npmLockDigest = sha256File(root, 'package-lock.json') ?? 'missing';
  const cargoLockRustDigest = sha256File(root, 'packages/sunrey-chain/rust/Cargo.lock') ?? 'missing';
  const cargoLockNodeDigest = sha256File(root, 'packages/sunrey-chain/node/Cargo.lock') ?? 'missing';
  const containerBaseDigests = Object.freeze(containerDigests(root));
  const toolchain = Object.freeze({ rust: '1.83.0', node: '22' });
  const pqcDependency = '@noble/post-quantum@0.5.4';
  const formalTools = existsSync(join(root, 'packages/sunrey-chain/src/formal'))
    ? 'chunk-61-formal-smoke'
    : 'ABSENT_CHUNK_61';
  return Object.freeze({
    npmLockDigest,
    cargoLockRustDigest,
    cargoLockNodeDigest,
    containerBaseDigests,
    toolchain,
    pqcDependency,
    formalTools,
    combinedDigest: sha256Text(
      [npmLockDigest, cargoLockRustDigest, cargoLockNodeDigest, JSON.stringify(containerBaseDigests), toolchain.rust, toolchain.node, pqcDependency, formalTools].join('|'),
    ),
  });
}

export function freezeArtifacts(root: string): ArtifactFreeze {
  const digests = Object.fromEntries(
    RELEASE_TARGETS.map((target) => {
      const paths = ARTIFACT_SOURCE[target] ?? ARTIFACT_SOURCE[target.replace('sunrey-', '')] ?? [];
      const mapped = target === 'sunrey-sdk' ? ARTIFACT_SOURCE.SDK : paths.length > 0 ? paths : ARTIFACT_SOURCE[target];
      return [target, digestPaths(root, mapped ?? [`missing:${target}`])];
    }),
  );
  if (!digests.SDK && ARTIFACT_SOURCE.SDK) {
    digests.SDK = digestPaths(root, ARTIFACT_SOURCE.SDK);
  }
  return Object.freeze({
    digests: Object.freeze(digests),
    combinedDigest: sha256Text(Object.entries(digests).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}:${v}`).join('|')),
  });
}

export function moduleHashes(root: string): Readonly<Record<string, string>> {
  const hashes: Record<string, string> = {};
  for (const name of TESTNET_MODULE_REGISTRY) {
    hashes[name] = sha256File(root, MODULE_PATHS[name] ?? `missing:${name}`) ?? `missing:${name}`;
  }
  return Object.freeze(hashes);
}

export function nativeAssetRegistryHash(root: string): string {
  return sha256File(root, 'packages/sunrey-chain/src/protocol/assets.ts') ?? sha256Text(TESTNET_FEE_POLICY);
}

export function governancePolicyHash(root: string): string {
  return sha256File(root, 'packages/sunrey-chain/src/governance/types.ts') ?? sha256Text('governance');
}

export function testnetIdentityFreeze(): {
  readonly networkId: typeof SUNREY_TESTNET_1_NETWORK_ID;
  readonly chainId: typeof SUNREY_TESTNET_1_CHAIN_ID;
  readonly genesisHash: string;
  readonly validatorSetHash: string;
} {
  const genesis = buildGenesis(testnet1GenesisInput());
  return Object.freeze({
    networkId: SUNREY_TESTNET_1_NETWORK_ID,
    chainId: SUNREY_TESTNET_1_CHAIN_ID,
    genesisHash: genesis.genesisHash,
    validatorSetHash: genesis.validatorSetHash,
  });
}

export function protocolChangeRequiresNewRc(left: ProtocolFreeze, right: ProtocolFreeze): boolean {
  return left.combinedHash !== right.combinedHash;
}

export function materialFreezeChange(input: {
  readonly protocol: { readonly left: string; readonly right: string };
  readonly api: { readonly left: string; readonly right: string };
  readonly deps: { readonly left: string; readonly right: string };
  readonly artifacts: { readonly left: string; readonly right: string };
  readonly sourceCommit: { readonly left: string; readonly right: string };
}): boolean {
  return (
    input.protocol.left !== input.protocol.right ||
    input.api.left !== input.api.right ||
    input.deps.left !== input.deps.right ||
    input.artifacts.left !== input.artifacts.right ||
    input.sourceCommit.left !== input.sourceCommit.right
  );
}

export function readText(root: string, rel: string): string | null {
  const path = join(root, rel);
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
}

export { TESTNET_ORACLE_POLICY };
