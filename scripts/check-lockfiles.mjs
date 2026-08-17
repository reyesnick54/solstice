#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const required = [
  'package-lock.json',
  'packages/sunrey-chain/rust/Cargo.lock',
  'packages/sunrey-chain/node/Cargo.lock',
];
const missing = required.filter((rel) => !existsSync(join(root, rel)));
if (missing.length > 0) {
  console.error('lockfile enforcement failed:', missing.join(', '));
  process.exit(1);
}

const pins = JSON.parse(readFileSync(join(root, 'packages/sunrey-chain/supply-chain/action-pins.json'), 'utf8'));
const workflows = ['.github/workflows/ci.yml', '.github/workflows/sunrey-release.yml'];
for (const action of pins.actions) {
  if (!action.commit || action.commit.includes('stable')) {
    continue;
  }
  const needle = `${action.uses}@${action.commit}`;
  const present = workflows.some((rel) => readFileSync(join(root, rel), 'utf8').includes(needle));
  if (!present && action.uses.startsWith('actions/')) {
    console.error(`action pin missing from workflows: ${needle}`);
    process.exit(1);
  }
}

console.log('lockfile enforcement: ok');
