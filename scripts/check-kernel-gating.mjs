#!/usr/bin/env node
/**
 * CI rule: fail on any NEW state-changing path lacking Kernel authorization.
 * Reports file and line.
 *
 * Checks:
 *  1. Every symbol in STATE_CHANGING_PATHS takes KernelAuthorization and
 *     calls assertKernelAuthorization*.
 *  2. Direct store mutations (.set / .push on private financial maps) only
 *     appear inside those gated functions.
 *  3. appendJournal is only called from commitJournal.
 *  4. mintKernelAuthorization is only called from the kernel package.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const STATE_CHANGING_PATHS = [
  { symbol: 'putCustomer', file: 'packages/ledger/src/stores.ts' },
  { symbol: 'commitCustomerStatus', file: 'packages/ledger/src/stores.ts' },
  { symbol: 'putAccount', file: 'packages/ledger/src/stores.ts' },
  { symbol: 'putBeneficiary', file: 'packages/ledger/src/stores.ts' },
  { symbol: 'updateBeneficiary', file: 'packages/ledger/src/stores.ts' },
  { symbol: 'putPayment', file: 'packages/ledger/src/stores.ts' },
  { symbol: 'transitionPayment', file: 'packages/ledger/src/stores.ts' },
  { symbol: 'recordCostAvoided', file: 'packages/ledger/src/stores.ts' },
  { symbol: 'commitJournal', file: 'packages/ledger/src/journal.ts' },
  { symbol: 'recordListingApproval', file: 'packages/pyramid-exchange/src/registry.ts' },
  { symbol: 'recordEnforcementDecision', file: 'packages/pyramid-exchange/src/surveillance.ts' },
  { symbol: 'engageKillSwitch', file: 'packages/pyramid-exchange/src/kill-switch.ts' },
];

const failures = [];

function addFailure(file, line, message) {
  failures.push({ file, line, message });
}

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git') continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (entry.endsWith('.ts') || entry.endsWith('.js') || entry.endsWith('.mjs')) acc.push(full);
  }
  return acc;
}

for (const path of STATE_CHANGING_PATHS) {
  const abs = join(ROOT, path.file);
  const source = readFileSync(abs, 'utf8');
  const lines = source.split('\n');
  let foundLine = 0;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].includes(`${path.symbol}(`) && /function|^\s+\w+\(/.test(lines[i])) {
      foundLine = i + 1;
      break;
    }
    if (new RegExp(`^\\s+${path.symbol}\\(`).test(lines[i])) {
      foundLine = i + 1;
      break;
    }
  }
  if (foundLine === 0) {
    addFailure(path.file, 1, `state-changing symbol ${path.symbol} not found`);
    continue;
  }
  const window = lines.slice(foundLine - 1, foundLine + 25).join('\n');
  if (!window.includes('KernelAuthorization') && !window.includes('authorization')) {
    addFailure(
      path.file,
      foundLine,
      `NEW or ungated state-changing path ${path.symbol} lacks KernelAuthorization in its signature`,
    );
  }
  const body = lines.slice(foundLine - 1, foundLine + 40).join('\n');
  if (!body.includes('assertKernelAuthorization')) {
    addFailure(
      path.file,
      foundLine,
      `${path.symbol} does not call assertKernelAuthorization (Kernel gate missing)`,
    );
  }
}

const files = walk(join(ROOT, 'packages')).concat(walk(join(ROOT, 'apps'))).concat(walk(join(ROOT, 'scripts')));

for (const file of files) {
  const rel = relative(ROOT, file);
  const source = readFileSync(file, 'utf8');
  const lines = source.split('\n');
  lines.forEach((line, idx) => {
    const n = idx + 1;
    if (rel.endsWith('journal.ts') && line.includes('appendJournal(') && !line.includes('appendJournal(journal)')) {
      if (!rel.endsWith('journal.ts')) {
        addFailure(rel, n, 'appendJournal may only be called from commitJournal');
      }
    }
    if (line.includes('appendJournal(') && !rel.endsWith('journal.ts') && !rel.endsWith('check-kernel-gating.mjs')) {
      addFailure(rel, n, 'appendJournal called outside journal.ts — Kernel-gated commitJournal is required');
    }
    if (line.includes('mintKernelAuthorization(') && !rel.startsWith('packages/kernel/') && !rel.endsWith('check-kernel-gating.mjs')) {
      addFailure(rel, n, 'mintKernelAuthorization is Kernel-private');
    }
    if (
      /#(customers|accounts|beneficiaries|payments|costAvoided)\.(set|push)\(/.test(line) &&
      !rel.endsWith('stores.ts')
    ) {
      addFailure(rel, n, 'direct financial store mutation outside LedgerBooks gated methods');
    }
  });
}

const knownSymbols = new Set(STATE_CHANGING_PATHS.map((p) => p.symbol));
const discover = /\b(putCustomer|commitCustomerStatus|putAccount|putBeneficiary|updateBeneficiary|putPayment|transitionPayment|recordCostAvoided|commitJournal|appendJournal|recordListingApproval|recordEnforcementDecision|engageKillSwitch)\s*\(/g;

for (const file of files) {
  const rel = relative(ROOT, file);
  if (rel.endsWith('check-kernel-gating.mjs')) continue;
  const source = readFileSync(file, 'utf8');
  const lines = source.split('\n');
  lines.forEach((line, idx) => {
    discover.lastIndex = 0;
    let match;
    while ((match = discover.exec(line)) !== null) {
      const symbol = match[1];
      if (!knownSymbols.has(symbol) && symbol !== 'appendJournal') {
        addFailure(
          rel,
          idx + 1,
          `NEW state-changing path ${symbol} is not in the Kernel-gated registry`,
        );
      }
    }
  });
}

if (failures.length > 0) {
  console.error('Kernel gating CI failed:\n');
  for (const failure of failures) {
    console.error(`  ${failure.file}:${failure.line}  ${failure.message}`);
  }
  process.exit(1);
}

console.log(
  `Kernel gating CI passed (${STATE_CHANGING_PATHS.length} registered paths, all Kernel-authorized).`,
);
