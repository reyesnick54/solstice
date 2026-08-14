/**
 * End-to-end demo: OPEN_ACCOUNT travels propose → Kernel (six proofs) →
 * signed Execution Authority → Account → Evidence Vault. A blocked intent
 * creates no account and still seals evidence. The hash chain verifies.
 */
import { ActionType, openAccountIntent } from '@solstice/permissions';

import { createAccountsRuntime } from './index.ts';

function main(): void {
  const runtime = createAccountsRuntime();

  console.log('=== Solstice account opening via Compliance Kernel ===');
  console.log('REAL_MONEY_ENABLED =', runtime.capabilities.REAL_MONEY_ENABLED);
  if (runtime.capabilities.REAL_MONEY_ENABLED !== false) {
    throw new Error('demo aborted: REAL_MONEY_ENABLED must be false');
  }

  runtime.kernel.registerSubject({
    actorId: 'actor-demo',
    identityAssurance: 'VERIFIED',
    capabilities: [ActionType.OPEN_ACCOUNT],
    jurisdiction: 'GB',
    kycState: 'VERIFIED',
    riskPosture: 'ACCEPTABLE',
    permittedPurposes: [ActionType.OPEN_ACCOUNT],
  });

  const intent = openAccountIntent({
    intentId: 'intent-open-demo-001',
    actorId: 'actor-demo',
    requestedAt: runtime.clock.now().toISOString(),
    payload: {
      accountId: 'acct-demo-001',
      ownerId: 'cust-demo-001',
      accountClass: 'INSURED_DEPOSIT',
      productId: 'prod-instant-access',
      legalEntityId: 'le_solstice_uk_ltd',
      jurisdiction: 'GB',
      currency: 'GBP',
      purpose: ActionType.OPEN_ACCOUNT,
    },
  });

  const first = runtime.accounts.openAccount(intent);
  const replay = runtime.accounts.openAccount(intent);

  if (first.decision.status !== 'ALLOW' || !first.account || !first.event) {
    throw new Error(`demo expected ALLOW, got ${first.decision.status}`);
  }
  if (replay.account?.id !== first.account.id) {
    throw new Error('idempotent replay produced a second account');
  }
  if (runtime.accounts.accountCount() !== 1) {
    throw new Error(`expected 1 account, got ${runtime.accounts.accountCount()}`);
  }
  if (first.event.schemaVersion !== 1 || first.event.eventType !== 'AccountOpened') {
    throw new Error('demo expected AccountOpened v1');
  }

  console.log('\n--- Account ---');
  console.log('id:', first.account.id);
  console.log('ownerId:', first.account.ownerId);
  console.log('class:', first.account.accountClass);
  console.log('status:', first.account.status);
  console.log('authorityId:', first.account.openedByAuthorityId);
  console.log('hasBalanceField:', 'balance' in first.account);

  console.log('\n--- Kernel decision ---');
  console.log('status:', first.decision.status);
  for (const proof of first.decision.proofs) {
    console.log(`  ${proof.proof}: ${proof.status} — ${proof.reason}`);
  }

  runtime.kernel.registerSubject({
    actorId: 'actor-blocked',
    identityAssurance: 'VERIFIED',
    capabilities: [ActionType.OPEN_ACCOUNT],
    jurisdiction: 'GB',
    kycState: 'FAILED',
    riskPosture: 'UNACCEPTABLE',
    permittedPurposes: [ActionType.OPEN_ACCOUNT],
  });

  const blocked = runtime.accounts.openAccount(
    openAccountIntent({
      intentId: 'intent-open-demo-blocked',
      actorId: 'actor-blocked',
      requestedAt: runtime.clock.now().toISOString(),
      payload: {
        accountId: 'acct-demo-blocked',
        ownerId: 'cust-blocked',
        accountClass: 'INSURED_DEPOSIT',
        productId: 'prod-instant-access',
        legalEntityId: 'le_solstice_uk_ltd',
        jurisdiction: 'GB',
        currency: 'GBP',
        purpose: ActionType.OPEN_ACCOUNT,
      },
    }),
  );

  if (blocked.decision.status !== 'BLOCK' || blocked.account) {
    throw new Error('demo expected BLOCK with no account');
  }
  if (runtime.accounts.accountCount() !== 1) {
    throw new Error('BLOCK must not create an account');
  }

  console.log('\n--- Blocked intent ---');
  console.log('status:', blocked.decision.status);
  console.log('accountCreated:', Boolean(blocked.account));

  const chain = runtime.evidence.verifyChain();
  console.log('\n--- Evidence chain ---');
  console.log('verified:', chain.ok, 'records:', chain.length);
  for (const record of runtime.evidence.list()) {
    console.log(
      `  seq=${record.seq} kind=${record.kind} sha256=${record.recordSha256.slice(0, 12)}…`,
    );
  }

  if (!chain.ok || chain.length < 4) {
    throw new Error('evidence chain failed or is missing refusal records');
  }

  console.log('\nDemo complete. Simulation only. Flags unchanged.');
}

main();
