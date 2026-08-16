#!/usr/bin/env node
/**
 * Deterministic development release-manifest generator.
 * Does not claim a reproducible build unless CI actually reproduced it.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const PATHS = [
  'packages/sunrey-chain/src/governance',
  'packages/sunrey-chain/rust/crates/governance',
  'packages/sunrey-chain/rust/crates/protocol',
  'packages/sunrey-chain/schemas/srcb-v1.json',
];

function walk(path, out = []) {
  const full = join(ROOT, path);
  const stat = statSync(full);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(full).sort()) {
      if (entry === 'target' || entry === 'node_modules') {
        continue;
      }
      walk(join(path, entry), out);
    }
  } else {
    out.push(path);
  }
  return out;
}

const files = PATHS.flatMap((path) => walk(path));
const moduleHashes = {};
for (const file of files) {
  const bytes = readFileSync(join(ROOT, file));
  moduleHashes[relative(ROOT, join(ROOT, file))] = createHash('sha256').update(bytes).digest('hex');
}
const artifactHash = createHash('sha256')
  .update(JSON.stringify(moduleHashes))
  .digest('hex');

const manifest = {
  sourceCommit: process.env.GITHUB_SHA ?? 'development-unspecified',
  toolchainVersion: 'rustc-dev / node-22',
  artifactHash,
  moduleHashes,
  schemaHashes: {
    'srcb-v1': createHash('sha256')
      .update(readFileSync(join(ROOT, 'packages/sunrey-chain/schemas/srcb-v1.json')))
      .digest('hex'),
  },
  reproducedInCi: false,
  environment: 'simulation',
};

const encoded = `${JSON.stringify(manifest, null, 2)}\n`;
if (process.argv.includes('--write')) {
  const out = join(ROOT, 'packages/sunrey-chain/release-manifest.json');
  writeFileSync(out, encoded);
  console.error(`wrote ${out}`);
}
process.stdout.write(encoded);
