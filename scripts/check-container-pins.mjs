#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const pins = JSON.parse(readFileSync(join(root, 'packages/sunrey-chain/supply-chain/image-pins.json'), 'utf8'));
if (pins.releaseRequiresDigest !== true) {
  console.error('image pins must require digest for release');
  process.exit(1);
}
const dockerfiles = [
  'deploy/sunrey-testnet/docker/sunrey-node.Dockerfile',
  'deploy/sunrey-testnet/docker/sunrey-rpc.Dockerfile',
  'deploy/sunrey-testnet/docker/sunrey-relayer.Dockerfile',
  'deploy/sunrey-testnet/docker/sunrey-explorer.Dockerfile',
  'deploy/sunrey-testnet/docker/sunrey-faucet.Dockerfile',
];
for (const rel of dockerfiles) {
  const text = readFileSync(join(root, rel), 'utf8');
  if (!text.includes('image-pins.json') && !text.includes('ARG ') ) {
    console.error(`${rel}: release Dockerfile must reference image pins or ARG image refs`);
    process.exit(1);
  }
  if (text.includes('USER root') && !text.includes('AS build')) {
    console.error(`${rel}: runtime image must not stay root`);
    process.exit(1);
  }
}
console.log('container pin check: ok');
