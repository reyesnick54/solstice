#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = join(process.cwd(), 'deploy/sunrey-testnet');
const failures = [];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

const files = walk(root);
if (files.length < 8) {
  failures.push('expected deployment artifacts under deploy/sunrey-testnet');
}
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  if (/-----BEGIN .*PRIVATE KEY-----/.test(text) || /"privateKey"\s*:/.test(text)) {
    failures.push(`${file}: private key material is forbidden`);
  }
  if (file.endsWith('.yaml') || file.endsWith('.yml')) {
    if (!/apiVersion:|kind: Cluster|name: sunrey-testnet/.test(text)) {
      failures.push(`${file}: not a recognizable manifest`);
    }
  }
  if (file.endsWith('Dockerfile')) {
    if (!/USER /.test(text) || !/HEALTHCHECK/.test(text)) {
      failures.push(`${file}: container image must be non-root with HEALTHCHECK`);
    }
  }
}

if (failures.length > 0) {
  for (const row of failures) {
    process.stderr.write(`${row}\n`);
  }
  process.exit(1);
}
process.stdout.write(`validated ${files.length} testnet deployment artifacts\n`);
