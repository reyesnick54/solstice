import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ComplianceKernelPort } from '@solstice/compliance-kernel';
import { EvidenceVault } from '@solstice/evidence-vault';
import { REAL_MONEY_ENABLED } from '@solstice/flags';
import {
  ActionType,
  AuthorityIssuer,
  FrozenClock,
  type AuthorizationDecision,
  type ExecutionAuthority,
} from '@solstice/permissions';

import { Account } from './account.ts';
import { blockedSubject, openIntent, runtimeWithClearedActor } from './helpers.ts';
import { AccountsService } from './open-account.ts';
import { createAccountsRuntime } from './runtime.ts';
import { verifyExecutionAuthority } from './verify-authority.ts';

describe('OPEN_ACCOUNT via Compliance Kernel', () => {
  it('ALLOW creates exactly one account and seals evidence', () => {
    const runtime = runtimeWithClearedActor();
    const before = runtime.evidence.count();
    const result = runtime.accounts.openAccount(openIntent());

    assert.equal(result.decision.status, 'ALLOW');
    assert.equal(result.replay, false);
    assert.ok(result.account);
    assert.equal(runtime.accounts.accountCount(), 1);
    assert.equal(result.account?.id, 'acct-001');
    assert.equal(result.account?.status, 'OPEN');
    assert.equal(result.account?.accountClass, 'INSURED_DEPOSIT');
    assert.equal('balance' in (result.account ?? {}), false);
    assert.equal(result.event?.eventType, 'AccountOpened');
    assert.equal(result.event?.schemaVersion, 1);
    assert.equal(result.event?.authorityId, result.account?.openedByAuthorityId);
    assert.ok(result.decision.status === 'ALLOW' && result.decision.executionAuthority);
    assert.equal(result.decision.proofs.length, 6);
    for (const proof of result.decision.proofs) {
      assert.equal(proof.status, 'ALLOW');
    }
    assert.ok(runtime.evidence.count() > before);
    assert.ok(runtime.evidence.list().some((record) => record.kind === 'KERNEL_DECISION'));
    assert.ok(runtime.evidence.list().some((record) => record.kind === 'ACCOUNT_OPENED'));
    const chain = runtime.evidence.verifyChain();
    assert.equal(chain.ok, true);
  });

  it('BLOCK creates no account and still seals evidence', () => {
    const runtime = createAccountsRuntime();
    runtime.kernel.registerSubject(blockedSubject());
    const beforeAccounts = runtime.accounts.accountCount();
    const beforeEvidence = runtime.evidence.count();

    const result = runtime.accounts.openAccount(
      openIntent({ actorId: 'actor-blocked', accountId: 'acct-blocked' }),
    );

    assert.equal(result.decision.status, 'BLOCK');
    assert.equal(result.account, undefined);
    assert.equal(result.event, undefined);
    assert.equal(runtime.accounts.accountCount(), beforeAccounts);
    assert.equal(runtime.accounts.accountCount(), 0);
    assert.ok(runtime.evidence.count() > beforeEvidence);
    assert.ok(
      runtime.evidence.list().some((record) => record.kind === 'KERNEL_DECISION'),
    );
    assert.ok(
      runtime.evidence.list().some((record) => record.kind === 'ACCOUNT_OPEN_REFUSED'),
    );
    assert.equal(runtime.evidence.verifyChain().ok, true);
    assert.equal(result.decision.status, 'BLOCK');
  });

  it('returns DEFER and REQUIRE_MANUAL_REVIEW unchanged and creates no account', () => {
    const runtime = createAccountsRuntime();
    runtime.kernel.registerSubject({
      actorId: 'actor-defer',
      identityAssurance: 'VERIFIED',
      capabilities: [ActionType.OPEN_ACCOUNT],
      jurisdiction: 'GB',
      kycState: 'IN_PROGRESS',
      riskPosture: 'ACCEPTABLE',
      permittedPurposes: [ActionType.OPEN_ACCOUNT],
    });
    const deferred = runtime.accounts.openAccount(
      openIntent({ actorId: 'actor-defer', intentId: 'intent-defer', accountId: 'acct-defer' }),
    );
    assert.equal(deferred.decision.status, 'DEFER');
    assert.equal(deferred.account, undefined);

    runtime.kernel.registerSubject({
      actorId: 'actor-review',
      identityAssurance: 'UNVERIFIED',
      capabilities: [ActionType.OPEN_ACCOUNT],
      jurisdiction: 'GB',
      kycState: 'NOT_STARTED',
      riskPosture: 'ELEVATED',
      permittedPurposes: [ActionType.OPEN_ACCOUNT],
    });
    const review = runtime.accounts.openAccount(
      openIntent({
        actorId: 'actor-review',
        intentId: 'intent-review',
        accountId: 'acct-review',
      }),
    );
    assert.equal(review.decision.status, 'REQUIRE_MANUAL_REVIEW');
    assert.equal(review.account, undefined);
    assert.equal(runtime.accounts.accountCount(), 0);
  });

  it('rejects an expired Execution Authority and creates no account', () => {
    const clock = new FrozenClock(new Date('2026-08-13T12:00:00.000Z'));
    const issuer = new AuthorityIssuer('test-secret');
    const evidence = new EvidenceVault(clock);
    const expired = issuer.issue({
      authorityId: 'ea-expired',
      actionType: ActionType.OPEN_ACCOUNT,
      accountId: 'acct-exp',
      intentId: 'intent-exp',
      issuedAt: '2026-08-13T10:00:00.000Z',
      expiresAt: '2026-08-13T11:00:00.000Z',
    });
    const kernel: ComplianceKernelPort = {
      submit: (): AuthorizationDecision =>
        Object.freeze({
          status: 'ALLOW',
          intentId: 'intent-exp',
          actionType: ActionType.OPEN_ACCOUNT,
          proofs: [],
          executionAuthority: expired,
          reason: 'fixture ALLOW with expired authority',
          decidedAt: clock.now().toISOString(),
        }),
    };
    const accounts = new AccountsService(kernel, issuer, evidence, clock);
    const result = accounts.openAccount(
      openIntent({ intentId: 'intent-exp', accountId: 'acct-exp' }),
    );

    assert.equal(result.decision.status, 'ALLOW');
    assert.equal(result.executionRejected?.code, 'AUTHORITY_EXPIRED');
    assert.equal(result.account, undefined);
    assert.equal(accounts.accountCount(), 0);
    assert.ok(
      evidence.list().some((record) => record.kind === 'ACCOUNT_OPEN_AUTHORITY_REJECTED'),
    );
    assert.equal(evidence.verifyChain().ok, true);
  });

  it('rejects an Authority scoped to a different action', () => {
    const clock = new FrozenClock(new Date('2026-08-13T12:00:00.000Z'));
    const issuer = new AuthorityIssuer('test-secret');
    const evidence = new EvidenceVault(clock);
    const wrongAction = issuer.issue({
      authorityId: 'ea-wrong-action',
      actionType: 'POST_DEPOSIT',
      accountId: 'acct-001',
      intentId: 'intent-scope-action',
      issuedAt: '2026-08-13T12:00:00.000Z',
      expiresAt: '2026-08-13T13:00:00.000Z',
    });
    const result = openWithFixtureAuthority(issuer, evidence, clock, wrongAction, {
      intentId: 'intent-scope-action',
      accountId: 'acct-001',
    });
    assert.equal(result.executionRejected?.code, 'AUTHORITY_SCOPE_MISMATCH');
    assert.equal(result.account, undefined);
  });

  it('rejects an Authority scoped to a different account', () => {
    const clock = new FrozenClock(new Date('2026-08-13T12:00:00.000Z'));
    const issuer = new AuthorityIssuer('test-secret');
    const evidence = new EvidenceVault(clock);
    const wrongAccount = issuer.issue({
      authorityId: 'ea-wrong-account',
      actionType: ActionType.OPEN_ACCOUNT,
      accountId: 'acct-OTHER',
      intentId: 'intent-scope-account',
      issuedAt: '2026-08-13T12:00:00.000Z',
      expiresAt: '2026-08-13T13:00:00.000Z',
    });
    const result = openWithFixtureAuthority(issuer, evidence, clock, wrongAccount, {
      intentId: 'intent-scope-account',
      accountId: 'acct-001',
    });
    assert.equal(result.executionRejected?.code, 'AUTHORITY_SCOPE_MISMATCH');
    assert.equal(result.account, undefined);
  });

  it('the same intent submitted twice is idempotent', () => {
    const runtime = runtimeWithClearedActor();
    const intent = openIntent({ intentId: 'intent-idem' });
    const first = runtime.accounts.openAccount(intent);
    const second = runtime.accounts.openAccount(intent);

    assert.equal(first.decision.status, 'ALLOW');
    assert.equal(second.decision.status, 'ALLOW');
    assert.equal(second.replay, true);
    assert.equal(second.account?.id, first.account?.id);
    assert.equal(runtime.accounts.accountCount(), 1);
    assert.equal(runtime.accounts.listAccounts().length, 1);
    assert.equal(runtime.accounts.listEvents().length, 1);
    assert.ok(
      runtime.evidence.list().some((record) => record.kind === 'ACCOUNT_OPEN_REPLAY'),
    );
    assert.equal(runtime.evidence.verifyChain().ok, true);
  });

  it('verifyExecutionAuthority is the only producer of ValidatedExecutionAuthority', () => {
    const clock = new FrozenClock(new Date('2026-08-13T12:00:00.000Z'));
    const issuer = new AuthorityIssuer('test-secret');
    const authority = issuer.issue({
      authorityId: 'ea-ok',
      actionType: ActionType.OPEN_ACCOUNT,
      accountId: 'acct-001',
      intentId: 'intent-ok',
      issuedAt: '2026-08-13T12:00:00.000Z',
      expiresAt: '2026-08-13T13:00:00.000Z',
    });
    const verified = verifyExecutionAuthority(
      authority,
      {
        actionType: ActionType.OPEN_ACCOUNT,
        accountId: 'acct-001',
        intentId: 'intent-ok',
      },
      issuer,
      clock,
    );
    assert.equal(verified.ok, true);
    if (!verified.ok) {
      return;
    }
    const account = Account.fromValidatedAuthority(
      verified.value,
      openIntent().payload,
      clock.now().toISOString(),
    );
    assert.equal(account.id, 'acct-001');
    assert.equal(account.openedByAuthorityId, 'ea-ok');
  });

  it('does not flip simulation flags', () => {
    assert.equal(REAL_MONEY_ENABLED, false);
    const runtime = runtimeWithClearedActor();
    assert.equal(runtime.capabilities.REAL_MONEY_ENABLED, false);
    runtime.accounts.openAccount(openIntent());
    assert.equal(REAL_MONEY_ENABLED, false);
  });
});

function openWithFixtureAuthority(
  issuer: AuthorityIssuer,
  evidence: EvidenceVault,
  clock: FrozenClock,
  authority: ExecutionAuthority,
  ids: { intentId: string; accountId: string },
) {
  const kernel: ComplianceKernelPort = {
    submit: (): AuthorizationDecision =>
      Object.freeze({
        status: 'ALLOW',
        intentId: ids.intentId,
        actionType: ActionType.OPEN_ACCOUNT,
        proofs: [],
        executionAuthority: authority,
        reason: 'fixture ALLOW with scoped authority',
        decidedAt: clock.now().toISOString(),
      }),
  };
  const accounts = new AccountsService(kernel, issuer, evidence, clock);
  return accounts.openAccount(
    openIntent({ intentId: ids.intentId, accountId: ids.accountId }),
  );
}
