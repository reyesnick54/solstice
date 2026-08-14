#!/usr/bin/env node
/**
 * Phase 9 CI linters. Fail the build on:
 *  - an order path reaching the matching engine without ClearedOrder
 *  - an exchange capability enabled without a recorded registry approval
 *  - a fee posting into a customer balance
 *  - auto-correction of a reconciliation divergence
 *  - enforcement without a recorded human decision
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

function add(file, line, message) {
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

const files = walk(join(ROOT, 'packages/pyramid-exchange')).concat(
  walk(join(ROOT, 'apps')),
  walk(join(ROOT, 'scripts')),
);

const matching = readFileSync(join(ROOT, 'packages/pyramid-exchange/src/matching.ts'), 'utf8');
if (!matching.includes('accept(cleared: ClearedOrder)')) {
  add('packages/pyramid-exchange/src/matching.ts', 1, 'MatchingEngine.accept must require ClearedOrder');
}
if (/accept\([^)]*order:\s*Order/.test(matching)) {
  add('packages/pyramid-exchange/src/matching.ts', 1, 'MatchingEngine must not accept a raw Order');
}

const index = readFileSync(join(ROOT, 'packages/pyramid-exchange/src/index.ts'), 'utf8');
if (index.includes('mintClearedOrder')) {
  add('packages/pyramid-exchange/src/index.ts', 1, 'mintClearedOrder must not be a public export');
}

for (const file of files) {
  const rel = relative(ROOT, file);
  const source = readFileSync(file, 'utf8');
  const lines = source.split('\n');
  lines.forEach((line, idx) => {
    const n = idx + 1;
    if (rel.endsWith('check-phase9-exchange.mjs')) return;
    if (line.includes('mintClearedOrder(') && !rel.endsWith('cleared-order.ts') && !rel.endsWith('gateway.ts') && !rel.endsWith('replay.ts') && !rel.includes('.test.ts')) {
      add(rel, n, 'mintClearedOrder may only be called from the Compliance Gateway (or the isolated replay harness)');
    }
    if (line.includes('as ClearedOrder') && !rel.endsWith('cleared-order.ts') && !rel.endsWith('gateway.ts') && !rel.includes('.test.ts')) {
      add(rel, n, 'ClearedOrder must not be forged with a type assertion');
    }
    if (/(autoCorrect|repairDivergence|fixDivergence|rebaseCustody|correctDivergence)\s*\(/.test(line)) {
      add(rel, n, 'reconciliation divergence must not be auto-corrected');
    }
    if (rel.includes('registry.ts') && /CONFIRMED_BY_COUNSEL/.test(line) && /legalReviewState:\s*'CONFIRMED_BY_COUNSEL'/.test(line)) {
      add(rel, n, 'registry must not mark an entry CONFIRMED_BY_COUNSEL');
    }
    if (rel.includes('registry.ts') && /SPOT_TRADE:\s*true/.test(line) && !line.includes('caps[')) {
      add(rel, n, 'exchange capability enabled without a recorded approval path');
    }
    if (rel.endsWith('system.ts') && /house_fee/.test(line) === false && /feePayer|feeQuote/.test(line) && /cust_/.test(line) && /DEBIT/.test(line)) {
      add(rel, n, 'fee posting appears to target a customer account');
    }
    if (rel.endsWith('surveillance.ts') && line.includes('recordEnforcementDecision') && source.includes('assertKernelAuthorization') === false) {
      add(rel, n, 'enforcement must require Kernel authorization');
    }
    if (line.includes('LIVE_EXCHANGE_ENABLED') && /=\s*true/.test(line)) {
      add(rel, n, 'LIVE_EXCHANGE_ENABLED must stay false');
    }
  });
}

const system = readFileSync(join(ROOT, 'packages/pyramid-exchange/src/system.ts'), 'utf8');
if (!system.includes("accountId: feeAccount") || !system.includes("house_fee")) {
  add('packages/pyramid-exchange/src/system.ts', 1, 'fill fees must post to the distinct house_fee ledger');
}
if (!system.includes("direction: 'DEBIT', amount: fee")) {
  add('packages/pyramid-exchange/src/system.ts', 1, 'fee credit/debit pairing is missing');
}

const recon = readFileSync(join(ROOT, 'packages/pyramid-exchange/src/reconciliation.ts'), 'utf8');
if (recon.includes('autoCorrected: true')) {
  add('packages/pyramid-exchange/src/reconciliation.ts', 1, 'reconciliation must never claim auto-correction');
}
if (!recon.includes("action: 'HALT'")) {
  add('packages/pyramid-exchange/src/reconciliation.ts', 1, 'reconciliation divergence must halt');
}

const desk = readFileSync(join(ROOT, 'packages/pyramid-exchange/src/surveillance.ts'), 'utf8');
if (!desk.includes("actor.type === 'AGENT'")) {
  add('packages/pyramid-exchange/src/surveillance.ts', 1, 'enforcement must refuse an AI/agent actor');
}
if (!desk.includes('reasonCode')) {
  add('packages/pyramid-exchange/src/surveillance.ts', 1, 'enforcement requires a recorded reason code');
}

const flags = readFileSync(join(ROOT, 'packages/flags/src/capabilities.ts'), 'utf8');
if (!flags.includes('LIVE_EXCHANGE_ENABLED = false')) {
  add('packages/flags/src/capabilities.ts', 1, 'LIVE_EXCHANGE_ENABLED must remain false');
}

if (failures.length > 0) {
  console.error('Phase 9 exchange CI failed:\n');
  for (const failure of failures) {
    console.error(`  ${failure.file}:${failure.line}  ${failure.message}`);
  }
  process.exit(1);
}

console.log('Phase 9 exchange CI passed (cleared-order, registry default-deny, fee segregation, halt-only recon, human enforcement).');
