import { REVIEW_DOMAINS, type ReviewDomain, type ReviewDomainRecord } from './types.ts';

export const REVIEW_DOMAIN_RECORDS: readonly ReviewDomainRecord[] = Object.freeze([
  {
    id: 'CONSENSUS',
    title: 'Consensus safety and liveness',
    ownerPath: 'packages/sunrey-chain/rust/crates/consensus',
    additionalPaths: [
      'packages/sunrey-chain/src/validators',
      'packages/sunrey-chain/node/src/consensus',
      'docs/architecture/chunk-37-bft-consensus-core.md',
    ],
    inScope: true,
    notes: 'Development Tendermint-class engine. Not a production consensus deployment.',
  },
  {
    id: 'PROTOCOL_ENCODING',
    title: 'Protocol encoding and replay bindings',
    ownerPath: 'packages/sunrey-chain/src/protocol',
    additionalPaths: [
      'packages/sunrey-chain/protocol/v1/sunrey_tx_v1.proto',
      'packages/sunrey-chain/rust/crates/protocol',
      'packages/sunrey-chain/protocol/test-vectors/v1/vectors.json',
    ],
    inScope: true,
    notes: 'Canonical protobuf envelope. Unknown fields fail closed.',
  },
  {
    id: 'CRYPTOGRAPHY',
    title: 'CryptoSuite and classical algorithms',
    ownerPath: 'packages/security',
    additionalPaths: [
      'packages/security/src/crypto-suite.ts',
      'packages/security/src/ed25519-provider.ts',
      'docs/security/cryptographic-inventory.md',
    ],
    inScope: true,
    notes: 'Canonical cryptographic control plane. Production cryptographic approval is not automatic.',
  },
  {
    id: 'PQC',
    title: 'Post-quantum integration',
    ownerPath: 'packages/security',
    additionalPaths: [
      'packages/security/src/pq-provider.ts',
      'packages/sunrey-chain/src/pqc',
      'docs/security/chunk-60-post-quantum-integration.md',
    ],
    inScope: true,
    notes: 'Standardized @noble/post-quantum 0.5.4 for development/testnet hybrid only. Not quantum-proof.',
  },
  {
    id: 'WALLETS',
    title: 'Sovereign wallets and authorization',
    ownerPath: 'packages/sunrey-chain/src/wallet',
    additionalPaths: ['packages/sunrey-chain/rust/crates/wallet', 'docs/architecture/chunk-46-sovereign-wallets.md'],
    inScope: true,
    notes: 'Local encrypted development keystore. Wallet metadata is not a second ledger.',
  },
  {
    id: 'VALIDATORS',
    title: 'Validator lifecycle, signer, and operator infrastructure',
    ownerPath: 'packages/sunrey-chain/src/ops',
    additionalPaths: [
      'packages/sunrey-chain/src/validators',
      'packages/sunrey-chain/rust/crates/validators',
      'packages/sunrey-chain/rust/crates/ops',
    ],
    inScope: true,
    notes: 'Remote signer and sentry live under packages/sunrey-chain. No competing ops package.',
  },
  {
    id: 'NATIVE_ASSETS',
    title: 'SunRey and MoonRey native supply',
    ownerPath: 'packages/sunrey-chain/src/native-assets',
    additionalPaths: ['packages/sunrey-chain/rust/crates/native-assets', 'docs/architecture/native-asset-authority-boundary.md'],
    inScope: true,
    notes: 'Tickers remain NOT_ASSIGNED. Arbitrary NATIVE_ASSET ISSUE of MoonRey remains unavailable.',
  },
  {
    id: 'MOONREY_ISSUANCE',
    title: 'Productive MoonRey issuance',
    ownerPath: 'packages/sunrey-chain/src/productive',
    additionalPaths: ['packages/sunrey-chain/rust/crates/productive', 'docs/architecture/moonrey-issuance-model.md'],
    inScope: true,
    notes: 'Development/testnet economic parameters only. Public moonrey-coin product remains PLANNED.',
  },
  {
    id: 'EXCHANGE',
    title: 'Universal Economic Exchange and DVP',
    ownerPath: 'packages/sunrey-exchange',
    additionalPaths: ['packages/sunrey-exchange/src/native-clearing', 'docs/architecture/exchange-dvp-protocol.md'],
    inScope: true,
    notes: 'Simulation matching and native settlement. Not a second ledger.',
  },
  {
    id: 'CUSTODY',
    title: 'Institutional native-asset custody',
    ownerPath: 'packages/custody',
    additionalPaths: ['packages/custody/src/institutional', 'packages/sunrey-chain/src/native-custody'],
    inScope: true,
    notes: 'HSM integration is a development simulator. External production HSM is not completed.',
  },
  {
    id: 'ORACLES',
    title: 'Oracle network and verified economic facts',
    ownerPath: 'packages/sunrey-chain/src/oracle',
    additionalPaths: ['packages/sunrey-chain/rust/crates/oracle', 'docs/architecture/oracle-economic-fact-spec.md'],
    inScope: true,
    notes: 'Signed observations. Facts are not money.',
  },
  {
    id: 'MACHINE_ECONOMY',
    title: 'Machine identity and commerce',
    ownerPath: 'packages/sunrey-chain/src/machine-economy',
    additionalPaths: ['docs/architecture/machine-economic-identity.md', 'docs/architecture/machine-commerce-protocol.md'],
    inScope: true,
    notes: 'Controller-bound machine identity. Agents cannot execute financial state.',
  },
  {
    id: 'INTEROPERABILITY',
    title: 'Interop gateway, light client, and packets',
    ownerPath: 'packages/sunrey-chain/src/interop',
    additionalPaths: ['packages/sunrey-chain/rust/crates/interop', 'docs/architecture/interoperability-security-model.md'],
    inScope: true,
    notes: 'Development interoperability only. Production interoperability remains unimplemented.',
  },
  {
    id: 'PRIVACY',
    title: 'PDV, consent, purpose firewall, Clean Room, Explorer exposure',
    ownerPath: 'packages/personal-data-vault',
    additionalPaths: [
      'packages/consent',
      'packages/clean-room',
      'packages/information-market',
      'docs/architecture/explorer-privacy-policy.md',
    ],
    inScope: true,
    notes: 'Raw subject-level payloads remain unavailable through prohibited interfaces.',
  },
  {
    id: 'SUPPLY_CHAIN',
    title: 'Dependency policy, SBOM, and release provenance',
    ownerPath: 'packages/sunrey-chain/src/supply-chain',
    additionalPaths: ['packages/sunrey-chain/supply-chain', 'docs/security/chunk-59-supply-chain.md'],
    inScope: true,
    notes: 'ReleaseAuthority signs artifacts only and does not activate protocol change.',
  },
  {
    id: 'OPERATIONS',
    title: 'Validator operations, resilience, and disaster recovery',
    ownerPath: 'packages/sunrey-chain/src/ops',
    additionalPaths: [
      'packages/sunrey-chain/src/testnet',
      'docs/architecture/chunk-55-resilience-observability.md',
      'docs/architecture/chunk-54-validator-operations.md',
    ],
    inScope: true,
    notes: 'Engineering SLOs remain ENGINEERING_TEST_TARGETS. Simulation environment only.',
  },
]);

export function requiredReviewDomains(): readonly ReviewDomain[] {
  return REVIEW_DOMAINS;
}

export function scopeIsComplete(records: readonly ReviewDomainRecord[] = REVIEW_DOMAIN_RECORDS): boolean {
  const present = new Set(records.map((row) => row.id));
  return REVIEW_DOMAINS.every((id) => present.has(id) && records.find((row) => row.id === id)?.inScope === true);
}

export function emitAuditScopeYaml(records: readonly ReviewDomainRecord[] = REVIEW_DOMAIN_RECORDS): string {
  const lines = [
    '# SunRey independent security-review scope',
    '# Engineering package only. Not an audit result.',
    'schema_version: 1',
    'claims_external_audit_completed: false',
    'environment: simulation',
    'domains:',
  ];
  for (const row of records) {
    lines.push(`  - id: ${row.id}`);
    lines.push(`    title: ${JSON.stringify(row.title)}`);
    lines.push(`    owner_path: ${row.ownerPath}`);
    lines.push('    additional_paths:');
    for (const path of row.additionalPaths) {
      lines.push(`      - ${path}`);
    }
    lines.push(`    in_scope: ${String(row.inScope)}`);
    lines.push(`    notes: ${JSON.stringify(row.notes)}`);
  }
  return `${lines.join('\n')}\n`;
}
