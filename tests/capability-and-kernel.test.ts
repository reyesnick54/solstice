import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CapabilityTokenIssuer } from '../packages/platform/src/capability/AgentCapabilityToken.ts';
import { createControlPlane } from '../packages/platform/src/runtime.ts';
import { PersonalEconomyAgent } from '../packages/agent/src/runtime/PersonalEconomyAgent.ts';
import { compileMandate } from '../packages/agent/src/mandates/compile.ts';
import { claims, context, issueToken, NOW, USD, account } from './helpers.ts';
import { asUtcInstant } from '../packages/contracts/src/time.ts';
import { asTokenId } from '../packages/contracts/src/ids.ts';
import { ActionType } from '../packages/platform/src/kernel/ActionIntent.ts';
import { isGateRejection } from '../packages/platform/src/gate/ProposalGate.ts';

describe('capability token infrastructure', () => {
  it('rejects a proposal exceeding the per-transaction limit before the Kernel', () => {
    const runtime = createControlPlane();
    const token = issueToken(runtime.tokens, { perTransactionLimit: USD(1_000n) });
    const agent = new PersonalEconomyAgent({
      context: context(),
      claims: token,
      mandates: [],
    });
    const proposal = agent.proposeInvestmentSweep({
      sourceAccountId: 'acct_dep',
      targetAccountId: 'acct_inv',
      amount: USD(5_000n),
      now: NOW,
      proposalId: 'over_limit',
    });
    const beforeEvents = runtime.events.list().length;
    const result = runtime.gate.submitProposal(proposal, token, NOW);
    assert.equal(result.outcome, 'BLOCKED');
    if (result.outcome === 'BLOCKED') {
      assert.equal(result.code, 'PER_TRANSACTION_LIMIT');
    }
    const submitted = runtime.events.list().filter((e) => e.name === 'kernel.intent.submitted');
    assert.equal(submitted.length, 0);
    assert.equal(runtime.events.list().length > beforeEvents, true);
    assert.equal(runtime.kernel.journalCount(), 0);
    assert.equal(runtime.authorityIssuer.issuedCount(), 0);
  });

  it('a revoked token blocks all proposals immediately', () => {
    const runtime = createControlPlane();
    const token = issueToken(runtime.tokens);
    const revoked = runtime.tokens.revoke(token, NOW);
    const agent = new PersonalEconomyAgent({
      context: context(),
      claims: token,
      mandates: [],
    });
    const proposal = agent.proposeInvestmentSweep({
      sourceAccountId: 'acct_dep',
      targetAccountId: 'acct_inv',
      amount: USD(100n),
      now: NOW,
      proposalId: 'revoked',
    });
    const result = runtime.gate.submitProposal(proposal, revoked, NOW);
    assert.equal(result.outcome, 'BLOCKED');
    if (result.outcome === 'BLOCKED') {
      assert.equal(result.code, 'TOKEN_REVOKED');
    }
    assert.equal(runtime.events.list().some((e) => e.name === 'kernel.intent.submitted'), false);
  });

  it('an expired token blocks proposals', () => {
    const runtime = createControlPlane();
    const token = issueToken(runtime.tokens, {
      expiresAt: asUtcInstant('2026-01-01T00:00:00.000Z'),
    });
    const agent = new PersonalEconomyAgent({
      context: context(),
      claims: token,
      mandates: [],
    });
    const proposal = agent.proposeInvestmentSweep({
      sourceAccountId: 'acct_dep',
      targetAccountId: 'acct_inv',
      amount: USD(100n),
      now: NOW,
      proposalId: 'expired',
    });
    const result = runtime.gate.submitProposal(proposal, token, NOW);
    assert.equal(result.outcome, 'BLOCKED');
    if (result.outcome === 'BLOCKED') {
      assert.equal(result.code, 'TOKEN_EXPIRED');
    }
  });

  it('a forbidden data category is unreachable on the assembled snapshot', async () => {
    const { assembleFinancialContext } = await import(
      '../packages/platform/src/assembler/FinancialContextAssembler.ts'
    );
    const { asCustomerId, asAccountId } = await import('../packages/contracts/src/ids.ts');
    const snapshot = assembleFinancialContext(
      {
        customerId: asCustomerId('cust_test'),
        asOf: NOW,
        currency: 'USD',
        accounts: [account('acct_dep', 'deposits', USD(1n), false)],
        recentTransactions: [
          {
            id: 'secret_txn',
            accountId: asAccountId('acct_dep'),
            accountClass: 'deposits',
            amount: USD(1n),
            direction: 'OUTFLOW',
            merchantName: 'hidden',
            occurredAt: NOW,
            recurringGroupId: null,
          },
        ],
        recurringPatterns: [],
        monthlyEssentialSpending: USD(1n),
        highCostDebt: [],
        nearTermObligations: [],
        userGoals: [],
        realizedGainsThisWeek: USD(0n),
        piiFullName: 'Ada Lovelace',
        taxId: '123-45-6789',
      },
      claims({ forbiddenDataCategories: ['PII_FULL_NAME', 'TAX_ID', 'TRANSACTIONS'] }),
    );
    assert.equal('piiFullName' in snapshot, false);
    assert.equal('taxId' in snapshot, false);
    assert.equal(snapshot.recentTransactions.length, 0);
    assert.ok(snapshot.strippedDataCategories.includes('TRANSACTIONS'));
    assert.equal(snapshot.writePath, false);
  });
});

describe('kernel handling of agent-originated intents', () => {
  it('ALLOWS a sweep with an agreement and REFUSES one without; neither posts a journal', () => {
    const runtime = createControlPlane();
    const token = issueToken(runtime.tokens);
    const invest = compileMandate({
      customerId: 'cust_test',
      sourceText: 'invest surplus cash',
      claims: token,
      currency: 'USD',
      compiledAt: NOW,
      version: 1,
    });
    assert.equal(invest.ok, true);
    if (!invest.ok) return;

    const ctx = context({
      accounts: [
        account('acct_dep_ok', 'deposits', USD(100_000n), true),
        account('acct_dep_no', 'deposits', USD(100_000n), false),
        account('acct_inv', 'investments', USD(0n), false),
      ],
    });
    const agent = new PersonalEconomyAgent({
      context: ctx,
      claims: token,
      mandates: [invest.value],
    });

    const allowed = agent.proposeInvestmentSweep({
      sourceAccountId: 'acct_dep_ok',
      targetAccountId: 'acct_inv',
      amount: USD(1_000n),
      now: NOW,
      proposalId: 'ok_sweep',
    });
    const refused = agent.proposeInvestmentSweep({
      sourceAccountId: 'acct_dep_no',
      targetAccountId: 'acct_inv',
      amount: USD(1_000n),
      now: NOW,
      proposalId: 'bad_sweep',
    });

    const a = runtime.gate.submitProposal(allowed, token, NOW);
    const b = runtime.gate.submitProposal(refused, token, NOW);
    assert.equal(a.outcome, 'ALLOWED');
    assert.equal(b.outcome, 'REFUSED');
    if (b.outcome === 'REFUSED') {
      assert.match(b.reason, /MISSING_DEPOSIT_INVESTMENT_AGREEMENT/);
    }
    assert.equal(runtime.ledger.count(), 0);
    assert.equal(runtime.authorityIssuer.issuedCount(), 0);
    assert.equal(isGateRejection(a), false);
  });

  it('refuses subscription cancellation as an external mutation', () => {
    const runtime = createControlPlane();
    const token = issueToken(runtime.tokens);
    const ctx = context({
      recurringPatterns: [
        {
          groupId: 'rec_x',
          merchantName: 'Unused Mag',
          typicalAmount: USD(999n),
          cadence: 'MONTHLY',
          lastSeenAt: NOW,
          classification: 'UNUSED',
        },
      ],
    });
    const agent = new PersonalEconomyAgent({ context: ctx, claims: token, mandates: [] });
    const emitted = agent.proposeSubscriptions(NOW);
    assert.equal(emitted.proposals.length, 1);
    const decision = runtime.gate.submitProposal(emitted.proposals[0]!, token, NOW);
    assert.equal(decision.outcome, 'REFUSED');
    if (decision.outcome === 'REFUSED') {
      assert.match(decision.reason, /EXTERNAL_SUBSCRIPTION_MUTATION_FORBIDDEN/);
    }
  });

  it('SET_MANDATE is an ActionIntent through the Kernel', () => {
    const runtime = createControlPlane();
    const token = issueToken(runtime.tokens);
    const compiled = compileMandate({
      customerId: 'cust_test',
      sourceText: 'keep $10000 liquid',
      claims: token,
      currency: 'USD',
      compiledAt: NOW,
      version: 1,
    });
    assert.equal(compiled.ok, true);
    if (!compiled.ok) return;
    const decision = runtime.kernel.submit({
      actionType: ActionType.SET_MANDATE,
      payload: { mandate: compiled.value },
      idempotencyKey: 'm1',
      actorId: 'human',
      origin: 'HUMAN',
      requestedAt: NOW,
    });
    assert.equal(decision.outcome, 'ALLOWED');
    assert.equal(runtime.kernel.listMandates('cust_test').length, 1);
  });
});

describe('token issuer', () => {
  it('issues distinct signed tokens', () => {
    const issuer = new CapabilityTokenIssuer('test-secret');
    const a = issueToken(issuer, { tokenId: asTokenId('tok_a') });
    const b = issueToken(issuer, { tokenId: asTokenId('tok_b') });
    assert.notEqual(a.signature, b.signature);
    assert.equal(issuer.verify(a, NOW).ok, true);
  });
});
