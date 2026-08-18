import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import type { Finding } from './linter.ts';
import { loadManifest } from './manifest.ts';

const PROTOCOL_REL = 'docs/architecture/sunrey-blockchain-protocol.json';
const MATRIX_REL = 'docs/architecture/sunrey-chain-authority-matrix.md';
const CHUNK_DOC_REL = 'docs/architecture/chunk-31-sunrey-blockchain-production-architecture.md';
const ADR_INDEX_REL = 'docs/architecture/adr/README.md';
const FLAGS_REL = 'packages/config/src/flags.ts';

const REQUIRED_ADRS = [
  'ADR-0016-sunrey-blockchain-node-architecture.md',
  'ADR-0017-sunrey-blockchain-consensus-architecture.md',
  'ADR-0018-sunrey-blockchain-validator-architecture.md',
  'ADR-0019-sunrey-blockchain-state-machine-architecture.md',
  'ADR-0020-sunrey-blockchain-execution-runtime.md',
  'ADR-0021-sunrey-blockchain-transaction-block-encoding.md',
  'ADR-0022-sunrey-blockchain-storage-model.md',
  'ADR-0023-sunrey-blockchain-networking-p2p.md',
  'ADR-0024-sunrey-blockchain-cryptographic-agility.md',
  'ADR-0025-sunrey-blockchain-post-quantum-migration.md',
  'ADR-0026-sunrey-blockchain-native-asset-model.md',
  'ADR-0027-sunrey-blockchain-oracle-architecture.md',
  'ADR-0028-sunrey-blockchain-governance-upgrades.md',
  'ADR-0029-sunrey-blockchain-interoperability.md',
  'ADR-0030-sunrey-blockchain-privacy-confidentiality.md',
  'ADR-0031-canonical-ledger-vs-blockchain-authority.md',
  'ADR-0032-sunrey-blockchain-evidence-anchoring.md',
  'ADR-0033-sunrey-blockchain-identity-genesis.md',
] as const;

const COMPETING_PATHS = [
  'packages/sunrey-chain-v2',
  'packages/blockchain',
  'packages/reyn-chain',
  'packages/on-chain-ledger',
  'packages/crypto-chain',
  'packages/blockchain-node',
  'packages/blockchain-protocol',
  'packages/blockchain-network',
  'packages/blockchain-consensus',
  'packages/blockchain-runtime',
  'packages/sunrey-node',
  'packages/sunrey-blockchain',
  'packages/moonrey-chain',
  'packages/moonrey-coin',
  'packages/consensus-engine',
  'packages/tendermint',
  'packages/hotstuff',
  'packages/validators',
  'packages/staking',
  'packages/slashing',
  'packages/validator-economics',
  'packages/liquid-staking',
  'packages/staking-derivatives',
  'packages/validator-v2',
  'packages/ibc',
  'packages/bridge',
  'packages/interop',
  'packages/light-client',
  'packages/relayer',
  'packages/wallet-v2',
  'packages/blockchain-wallet',
  'packages/crypto-wallet',
  'packages/sunrey-wallet-ledger',
  'packages/sunrey-ops',
  'packages/validator-ops',
  'packages/sentry',
  'packages/remote-signer',
  'packages/sunrey-bench',
  'packages/performance',
  'packages/load-test',
  'packages/sunrey-audit',
  'packages/audit',
  'packages/security-review',
  'packages/audit-evidence',
  'packages/sunrey-protocol-treasury',
  'packages/native-treasury',
  'packages/reserve-bank',
] as const;

const FORBIDDEN_FLAG_ASSIGNMENTS = [
  /MAINNET_ENABLED\s*=\s*true/,
  /PRODUCTION_BLOCKCHAIN\s*=\s*true/,
  /LIVE_CHAIN_ENABLED\s*=\s*true/,
] as const;

function finding(rule: string, file: string, message: string): Finding {
  return { rule, file, line: 1, message };
}

export function lintSunReyBlockchainArchitecture(root: string): Finding[] {
  const findings: Finding[] = [];
  const protocolPath = join(root, PROTOCOL_REL);
  if (!existsSync(protocolPath)) {
    findings.push(finding('missing-canonical-owner', PROTOCOL_REL, 'canonical SunRey Blockchain protocol spec is missing'));
    return findings;
  }

  const protocol = JSON.parse(readFileSync(protocolPath, 'utf8')) as {
    id?: string;
    canonicalOwner?: string;
    competingOwnersForbidden?: boolean;
    productionBlockchainImplemented?: boolean;
    mainnetEnabled?: boolean;
    environment?: string;
    secondFiatLedger?: boolean;
    tickers?: { sunreyCoin?: string; moonreyCoin?: string };
    nativeAssets?: {
      sunreyCoin?: { distinctFromMoonRey?: boolean; tickerStatus?: string };
      moonreyCoin?: {
        distinctFromSunReyCoin?: boolean;
        tickerStatus?: string;
        implemented?: boolean;
        productionIssuanceImplemented?: boolean;
      };
    };
    legalStatusAutoPromote?: boolean;
    counselStatus?: string;
    adrs?: readonly string[];
    fiveMicroservices?: boolean;
    implementationDirection?: { evmInherited?: boolean; fiveMicroservices?: boolean };
  };

  if (protocol.id !== 'sunrey-blockchain-protocol') {
    findings.push(finding('duplicate-protected-system', PROTOCOL_REL, 'protocol spec id must be sunrey-blockchain-protocol'));
  }
  if (protocol.canonicalOwner !== 'packages/sunrey-chain') {
    findings.push(finding('duplicate-protected-system', PROTOCOL_REL, 'canonical owner must remain packages/sunrey-chain'));
  }
  if (protocol.competingOwnersForbidden !== true) {
    findings.push(finding('duplicate-protected-system', PROTOCOL_REL, 'competing blockchain owners must be forbidden'));
  }
  if (protocol.productionBlockchainImplemented !== false || protocol.mainnetEnabled !== false) {
    findings.push(
      finding('unauthorized-mutator', PROTOCOL_REL, 'production blockchain / mainnet must remain disabled'),
    );
  }
  if (protocol.environment !== 'simulation') {
    findings.push(finding('unauthorized-mutator', PROTOCOL_REL, 'ENVIRONMENT direction must remain simulation'));
  }
  if (protocol.secondFiatLedger !== false) {
    findings.push(finding('unauthorized-mutator', PROTOCOL_REL, 'SunRey Chain must not become a second fiat ledger'));
  }
  if (protocol.tickers?.sunreyCoin !== 'NOT_ASSIGNED' || protocol.tickers?.moonreyCoin !== 'NOT_ASSIGNED') {
    findings.push(finding('unauthorized-mutator', PROTOCOL_REL, 'public tickers must remain NOT_ASSIGNED'));
  }
  if (
    protocol.nativeAssets?.sunreyCoin?.distinctFromMoonRey !== true ||
    protocol.nativeAssets?.moonreyCoin?.distinctFromSunReyCoin !== true ||
    protocol.nativeAssets?.moonreyCoin?.productionIssuanceImplemented !== false
  ) {
    findings.push(
      finding(
        'duplicate-protected-system',
        PROTOCOL_REL,
        'MoonRey must remain distinct; production issuance remains unimplemented',
      ),
    );
  }
  if (protocol.legalStatusAutoPromote !== false || protocol.counselStatus === 'CONFIRMED_BY_COUNSEL') {
    findings.push(finding('unauthorized-mutator', PROTOCOL_REL, 'legal statuses must not auto-promote to CONFIRMED_BY_COUNSEL'));
  }
  if (protocol.implementationDirection?.evmInherited === true || protocol.implementationDirection?.fiveMicroservices === true) {
    findings.push(finding('duplicate-protected-system', PROTOCOL_REL, 'EVM inheritance and five microservices are forbidden'));
  }
  if (!Array.isArray(protocol.adrs) || protocol.adrs.length !== 18) {
    findings.push(finding('missing-canonical-owner', PROTOCOL_REL, 'protocol ADR set must list ADR-0016 through ADR-0033'));
  }

  if (!existsSync(join(root, MATRIX_REL))) {
    findings.push(finding('missing-canonical-owner', MATRIX_REL, 'authority matrix is missing'));
  } else {
    const matrix = readFileSync(join(root, MATRIX_REL), 'utf8');
    for (const needle of [
      'Fiat deposits',
      'SunRey Coin',
      'MoonRey Coin',
      'Canonical Ledger',
      'Consent Ledger',
      'Personal Data Vault',
      'Evidence Vault',
      'NOT_ASSIGNED',
    ]) {
      if (!matrix.includes(needle)) {
        findings.push(finding('missing-canonical-owner', MATRIX_REL, `authority matrix missing '${needle}'`));
      }
    }
    if (!/Ledger wins/i.test(matrix)) {
      findings.push(finding('unauthorized-mutator', MATRIX_REL, 'authority matrix must keep canonical Ledger winning for fiat'));
    }
  }

  if (!existsSync(join(root, CHUNK_DOC_REL))) {
    findings.push(finding('missing-canonical-owner', CHUNK_DOC_REL, 'Chunk 31 architecture document is missing'));
  } else {
    const doc = readFileSync(join(root, CHUNK_DOC_REL), 'utf8');
    if (!/not implemented/i.test(doc) || /production-ready blockchain/i.test(doc)) {
      findings.push(finding('unauthorized-mutator', CHUNK_DOC_REL, 'Chunk 31 must not claim a production blockchain'));
    }
  }

  const adrDir = join(root, 'docs/architecture/adr');
  for (const name of REQUIRED_ADRS) {
    if (!existsSync(join(adrDir, name))) {
      findings.push(finding('missing-canonical-owner', `docs/architecture/adr/${name}`, 'required protocol ADR is missing'));
      continue;
    }
    const text = readFileSync(join(adrDir, name), 'utf8');
    if (/^[-*] Status:\s*CONFIRMED_BY_COUNSEL/m.test(text) || /^[-*] Legal.*CONFIRMED_BY_COUNSEL/m.test(text)) {
      findings.push(finding('unauthorized-mutator', `docs/architecture/adr/${name}`, 'legal status must not be CONFIRMED_BY_COUNSEL'));
    }
    for (const section of [
      '## Context',
      '## Decision',
      '## Alternatives considered',
      '## Why rejected',
      '## Security implications',
      '## Compliance implications',
      '## Operability implications',
      '## Migration implications',
      '## Unresolved questions',
      '## Status',
    ]) {
      if (!text.includes(section)) {
        findings.push(finding('missing-canonical-owner', `docs/architecture/adr/${name}`, `ADR missing section ${section}`));
      }
    }
  }

  const index = existsSync(join(root, ADR_INDEX_REL)) ? readFileSync(join(root, ADR_INDEX_REL), 'utf8') : '';
  for (const id of ['0016', '0017', '0018', '0019', '0020', '0021', '0022', '0023', '0024', '0025', '0026', '0027', '0028', '0029', '0030', '0031', '0032', '0033']) {
    if (!index.includes(id)) {
      findings.push(finding('missing-canonical-owner', ADR_INDEX_REL, `ADR index missing ${id}`));
    }
  }

  for (const rel of COMPETING_PATHS) {
    if (existsSync(join(root, rel))) {
      findings.push(
        finding('duplicate-protected-system', rel, 'competing blockchain or MoonRey package is forbidden; use packages/sunrey-chain'),
      );
    }
  }

  const flags = readFileSync(join(root, FLAGS_REL), 'utf8');
  if (!flags.includes("ENVIRONMENT = 'simulation'")) {
    findings.push(finding('unauthorized-mutator', FLAGS_REL, 'ENVIRONMENT must remain simulation'));
  }
  for (const pattern of FORBIDDEN_FLAG_ASSIGNMENTS) {
    if (pattern.test(flags)) {
      findings.push(finding('unauthorized-mutator', FLAGS_REL, 'mainnet / production-chain flags must not be enabled'));
    }
  }

  const manifest = loadManifest(root);
  const architecture = manifest.capabilities.find((item) => item.id === 'sunrey-blockchain-architecture');
  if (!architecture || architecture.status !== 'IMPLEMENTED' || architecture.owner !== 'packages/sunrey-chain') {
    findings.push(
      finding(
        'missing-canonical-owner',
        'docs/architecture/manifest.json',
        'sunrey-blockchain-architecture must be IMPLEMENTED at packages/sunrey-chain',
      ),
    );
  }
  const chainOwners = manifest.packages.filter((pkg) => /chain|blockchain/i.test(pkg.id) && pkg.id !== 'packages/sunrey-chain');
  if (chainOwners.length > 0) {
    findings.push(
      finding(
        'duplicate-protected-system',
        'docs/architecture/manifest.json',
        `competing chain package registered: ${chainOwners.map((pkg) => pkg.id).join(', ')}`,
      ),
    );
  }

  const adrFiles = existsSync(adrDir)
    ? readdirSync(adrDir).filter((name) => /^ADR-00(1[6-9]|2[0-9]|3[0-3])-/.test(name))
    : [];
  if (adrFiles.length !== REQUIRED_ADRS.length) {
    findings.push(
      finding(
        'duplicate-protected-system',
        'docs/architecture/adr',
        'exactly the Chunk 31 protocol ADR set (0016–0033) must exist for those numbers',
      ),
    );
  }

  return findings;
}
