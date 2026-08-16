#!/usr/bin/env node
/**
 * CI rule: fail on any NEW state-changing path lacking Kernel authorization.
 * Reports file and line.
 *
 * Retargeted to the BASE (PR #12) mutators. Same invariant as the Phase 2–3
 * gate: every financial write requires a verified Execution Authority issued
 * by the Compliance Kernel. Do not delete this check.
 *
 * Checks:
 *  1. Every registered mutator takes / verifies Execution Authority (or
 *     submits to the Kernel, which is the only issuer).
 *  2. Ledger.postJournal is the only journal write; update/delete throw.
 *  3. openAccount is the only Account constructor and requires
 *     VerifiedExecutionAuthority.
 *  4. AuthorityIssuer.issue is only called from the kernel package.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const STATE_CHANGING_PATHS = [
  { symbol: 'postJournal', file: 'packages/ledger/src/journal.ts' },
  { symbol: 'openAccount', file: 'packages/domain/src/account.ts' },
  { symbol: 'open', file: 'services/accounts/src/open-account.ts' },
  { symbol: 'deposit', file: 'services/accounts/src/money-movement.ts' },
  { symbol: 'withdraw', file: 'services/accounts/src/money-movement.ts' },
  { symbol: 'transfer', file: 'services/accounts/src/money-movement.ts' },
  { symbol: 'createBeneficiary', file: 'packages/payments/src/service.ts' },
  { symbol: 'createQuote', file: 'packages/payments/src/service.ts' },
  { symbol: 'acceptQuote', file: 'packages/payments/src/service.ts' },
  { symbol: 'initiatePayment', file: 'packages/payments/src/service.ts' },
  { symbol: 'cancelPayment', file: 'packages/payments/src/service.ts' },
  { symbol: 'acceptInboundPayment', file: 'packages/payments/src/service.ts' },
  { symbol: 'postPaymentJournal', file: 'packages/payments/src/journals.ts' },
  { symbol: 'requestCard', file: 'packages/cards/src/service.ts' },
  { symbol: 'activateCard', file: 'packages/cards/src/service.ts' },
  { symbol: 'freezeCard', file: 'packages/cards/src/service.ts' },
  { symbol: 'unfreezeCard', file: 'packages/cards/src/service.ts' },
  { symbol: 'closeCard', file: 'packages/cards/src/service.ts' },
  { symbol: 'updateControls', file: 'packages/cards/src/service.ts' },
  { symbol: 'ingestAuthorizationCallback', file: 'packages/cards/src/service.ts' },
  { symbol: 'ingestReversalCallback', file: 'packages/cards/src/service.ts' },
  { symbol: 'ingestClearingCallback', file: 'packages/cards/src/service.ts' },
  { symbol: 'ingestRefundCallback', file: 'packages/cards/src/service.ts' },
  { symbol: 'openDispute', file: 'packages/cards/src/service.ts' },
  { symbol: 'decideDispute', file: 'packages/cards/src/service.ts' },
  { symbol: 'assessFee', file: 'packages/cards/src/service.ts' },
  { symbol: 'postCardJournal', file: 'packages/cards/src/journals.ts' },
  { symbol: 'provisionToWallet', file: 'packages/cards/src/wallet/service.ts' },
  { symbol: 'ingestWalletCallback', file: 'packages/cards/src/wallet/service.ts' },
  { symbol: 'suspendToken', file: 'packages/cards/src/wallet/service.ts' },
  { symbol: 'registerDevice', file: 'packages/cards/src/acceptance/service.ts' },
  { symbol: 'createSession', file: 'packages/cards/src/acceptance/service.ts' },
  { symbol: 'startPayment', file: 'packages/cards/src/acceptance/service.ts' },
  { symbol: 'settlePayment', file: 'packages/cards/src/acceptance/service.ts' },
  { symbol: 'ingestAcceptanceCallback', file: 'packages/cards/src/acceptance/service.ts' },
  { symbol: 'createHold', file: 'services/accounts/src/banking-operations.ts' },
  { symbol: 'releaseHold', file: 'services/accounts/src/banking-operations.ts' },
  { symbol: 'captureHold', file: 'services/accounts/src/banking-operations.ts' },
  { symbol: 'cancelHold', file: 'services/accounts/src/banking-operations.ts' },
  { symbol: 'postFee', file: 'services/accounts/src/banking-operations.ts' },
  { symbol: 'postReversal', file: 'services/accounts/src/banking-operations.ts' },
  { symbol: 'postInterest', file: 'services/accounts/src/banking-operations.ts' },
  { symbol: 'initiatePending', file: 'services/accounts/src/banking-operations.ts' },
  { symbol: 'settlePending', file: 'services/accounts/src/banking-operations.ts' },
  { symbol: 'returnPending', file: 'services/accounts/src/banking-operations.ts' },
  { symbol: 'reserveLiquidity', file: 'packages/treasury/src/service.ts' },
  { symbol: 'releaseReservation', file: 'packages/treasury/src/service.ts' },
  { symbol: 'commitReservation', file: 'packages/treasury/src/service.ts' },
  { symbol: 'proposeRebalance', file: 'packages/treasury/src/service.ts' },
  { symbol: 'executeRebalance', file: 'packages/treasury/src/service.ts' },
  { symbol: 'setKillSwitch', file: 'packages/treasury/src/service.ts' },
  { symbol: 'openInvestmentAccount', file: 'packages/investments/src/service.ts' },
  { symbol: 'fundBrokerageCash', file: 'packages/investments/src/service.ts' },
  { symbol: 'withdrawBrokerageCash', file: 'packages/investments/src/service.ts' },
  { symbol: 'createPaperOrder', file: 'packages/investments/src/service.ts' },
  { symbol: 'cancelPaperOrder', file: 'packages/investments/src/service.ts' },
  { symbol: 'settleInvestment', file: 'packages/investments/src/service.ts' },
  { symbol: 'processCorporateAction', file: 'packages/investments/src/service.ts' },
  { symbol: 'issue', file: 'packages/sunrey-coin/src/service.ts' },
  { symbol: 'transfer', file: 'packages/sunrey-coin/src/service.ts' },
  { symbol: 'burn', file: 'packages/sunrey-coin/src/service.ts' },
  { symbol: 'openExchangeAccount', file: 'packages/sunrey-exchange/src/service.ts' },
  { symbol: 'placeDigitalOrder', file: 'packages/sunrey-exchange/src/service.ts' },
  { symbol: 'cancelDigitalOrder', file: 'packages/sunrey-exchange/src/service.ts' },
  { symbol: 'halt', file: 'packages/sunrey-exchange/src/service.ts' },
  { symbol: 'setExchangeControl', file: 'packages/sunrey-exchange/src/service.ts' },
  { symbol: 'decideListing', file: 'packages/sunrey-exchange/src/service.ts' },
  { symbol: 'applyAuthorizedRestriction', file: 'packages/sunrey-exchange/src/service.ts' },
  { symbol: 'creditExternalDeposit', file: 'packages/custody/src/service.ts' },
  { symbol: 'addDestination', file: 'packages/custody/src/service.ts' },
  { symbol: 'initiateWithdrawal', file: 'packages/custody/src/service.ts' },
];

const failures = [];

function addFailure(file, line, message) {
  failures.push({ file, line, message });
}

function walk(dir, acc = []) {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return acc;
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
  let source;
  try {
    source = readFileSync(abs, 'utf8');
  } catch {
    addFailure(path.file, 1, `state-changing symbol ${path.symbol} file missing`);
    continue;
  }
  const lines = source.split('\n');
  let foundLine = 0;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].includes(`${path.symbol}(`) && /function|^\s+(?:async\s+)?\w+\(/.test(lines[i])) {
      foundLine = i + 1;
      break;
    }
    if (new RegExp(`^\\s+(?:async\\s+)?${path.symbol}\\(`).test(lines[i])) {
      foundLine = i + 1;
      break;
    }
  }
  if (foundLine === 0) {
    addFailure(path.file, 1, `state-changing symbol ${path.symbol} not found`);
    continue;
  }
  const body = lines.slice(foundLine - 1, foundLine + 80).join('\n');
  const gated =
    body.includes('ExecutionAuthority') ||
    body.includes('executionAuthority') ||
    body.includes('VerifiedExecutionAuthority') ||
    body.includes('kernel.submit') ||
    body.includes('this.kernel.submit') ||
    body.includes('this.gate(') ||
    body.includes('this.move(') ||
    body.includes('authorizeIntent(');
  if (!gated) {
    addFailure(
      path.file,
      foundLine,
      `NEW or ungated state-changing path ${path.symbol} lacks Execution Authority / Kernel submit`,
    );
  }
}

const roots = ['packages', 'services', 'tools', 'scripts', 'apps'].map((d) => join(ROOT, d));
const files = roots.flatMap((d) => walk(d));

for (const file of files) {
  const rel = relative(ROOT, file);
  const source = readFileSync(file, 'utf8');
  const lines = source.split('\n');
  lines.forEach((line, idx) => {
    const n = idx + 1;
    if (rel.endsWith('check-kernel-gating.mjs')) return;
    if (line.includes('this.issuer.issue(') && !rel.startsWith('packages/kernel/')) {
      addFailure(rel, n, 'AuthorityIssuer.issue is Kernel-private');
    }
    if (
      (line.includes('updateJournal(') || line.includes('deleteJournal(') ||
        line.includes('updatePosting(') || line.includes('deletePosting(')) &&
      !rel.endsWith('journal.ts') &&
      !rel.endsWith('invariants.test.ts') &&
      !rel.endsWith('check-kernel-gating.mjs')
    ) {
      addFailure(rel, n, 'journal mutate/delete called outside Ledger immutability guards');
    }
  });
}

const knownSymbols = new Set(STATE_CHANGING_PATHS.map((p) => p.symbol));
const discover =
  /\b(postJournal|commitJournal|appendJournal|putCustomer|putAccount|putBeneficiary|putPayment|createAccount)\s*\(/g;

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
      if (!knownSymbols.has(symbol) && symbol !== 'openAccount') {
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
