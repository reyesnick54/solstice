#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const outDir = join(root, 'dist', 'testnet-release');
mkdirSync(outDir, { recursive: true });

function sha256File(rel) {
  const path = join(root, rel);
  if (!existsSync(path)) {
    return null;
  }
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function noblePostQuantumComponent() {
  const lockPath = join(root, 'package-lock.json');
  if (!existsSync(lockPath)) {
    return [];
  }
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  const packageKey = Object.keys(lock.packages ?? {}).find(
    (key) => key === 'node_modules/@noble/post-quantum' || key.endsWith('/node_modules/@noble/post-quantum'),
  );
  const entry = packageKey ? lock.packages[packageKey] : undefined;
  if (!entry?.version) {
    return [];
  }
  return [
    {
      type: 'library',
      name: '@noble/post-quantum',
      version: entry.version,
      licenses: [{ license: { id: 'MIT' } }],
      hashes: sha256File('package-lock.json')
        ? [{ alg: 'SHA-256', content: sha256File('package-lock.json') }]
        : [],
      properties: [
        { name: 'purpose', value: 'standardized-pqc-testnet' },
        { name: 'mainnetActivation', value: 'false' },
      ],
    },
  ];
}

const components = [
  { name: 'package-lock.json', path: 'package-lock.json', version: '0.1.0' },
  { name: 'sunrey-chain-rust-lock', path: 'packages/sunrey-chain/rust/Cargo.lock', version: '0.1.0' },
  { name: 'sunrey-chain-node-lock', path: 'packages/sunrey-chain/node/Cargo.lock', version: '0.1.0' },
  { name: 'srcb-v1', path: 'packages/sunrey-chain/schemas/srcb-v1.json', version: '1' },
].flatMap((row) => {
  const hash = sha256File(row.path);
  return hash
    ? [{ type: 'file', name: row.name, version: row.version, hashes: [{ alg: 'SHA-256', content: hash }] }]
    : [];
}).concat(noblePostQuantumComponent());

const sbom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.5',
  version: 1,
  metadata: {
    timestamp: '1970-01-01T00:00:00Z',
    component: { type: 'application', name: 'sunrey-testnet', version: '0.1.0' },
  },
  components,
};

const manifest = {
  sourceCommit: process.env.GITHUB_SHA ?? 'local',
  rustToolchain: '1.83.0',
  nodeToolchain: '22',
  dependencyLockHashes: {
    packageLock: sha256File('package-lock.json'),
    cargoLock: sha256File('packages/sunrey-chain/rust/Cargo.lock'),
  },
  imageDigest: 'sha256:local-unsigned',
  binaryHashes: {},
  protocolSchemaHash: sha256File('packages/sunrey-chain/schemas/srcb-v1.json'),
  genesisToolVersion: 'sunrey-genesis/1',
  environment: 'simulation',
};

writeFileSync(join(outDir, 'sbom.cdx.json'), `${JSON.stringify(sbom, null, 2)}\n`);
writeFileSync(join(outDir, 'release-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`${join(outDir, 'sbom.cdx.json')}\n`);
