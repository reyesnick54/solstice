#!/usr/bin/env node
/**
 * Narrow TypeScript security lint. Avoids unactionable flood.
 * Rust static analysis remains cargo clippy -D warnings.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const roots = ['packages/sunrey-chain/src/supply-chain', 'packages/sunrey-chain/src/testnet'];
const forbidden = [
  { re: /\beval\s*\(/, label: 'eval' },
  { re: /\bnew Function\s*\(/, label: 'Function constructor' },
  { re: /\bchild_process\b.*\bexec\(/s, label: 'child_process.exec' },
];

function walk(dir, out = []) {
  const full = join(root, dir);
  for (const entry of readdirSync(full).sort()) {
    const rel = join(dir, entry);
    const stat = statSync(join(root, rel));
    if (stat.isDirectory()) {
      walk(rel, out);
    } else if (rel.endsWith('.ts')) {
      out.push(rel);
    }
  }
  return out;
}

const failures = [];
for (const dir of roots) {
  for (const file of walk(dir)) {
    const text = readFileSync(join(root, file), 'utf8');
    for (const rule of forbidden) {
      if (rule.re.test(text)) {
        failures.push(`${file}: ${rule.label}`);
      }
    }
  }
}
if (failures.length > 0) {
  console.error('static-security-lint failed:');
  for (const row of failures) {
    console.error(row);
  }
  process.exit(1);
}
console.log('static-security-lint: ok');
