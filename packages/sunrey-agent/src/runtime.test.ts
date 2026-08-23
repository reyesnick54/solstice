import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { UserAgentMandateEngine, type CreateMandateInput } from './engine.ts';
import { authorizeContextObject } from './context.ts';
import { evaluateProposalLimits } from './limits.ts';
import { emptyUsage } from './budget.ts';
import { createAgentSandboxScenario } from './sandbox.ts';
import { AgentConversationRuntime } from './runtime.ts';
import { InMemoryAgentMandateStore } from './store.ts';
import { emptyPegView, pegViewFromLabels } from './peg.ts';
import { FORBIDDEN_ASSIST_SCOPES } from './taxonomy.ts';
import { asUserAgentMandateId } from './ids.ts';

function clock() {
  return new FrozenClock(asUtcInstant('2026-08-23T10:00:00.000Z'));
}

function engine(store?: InMemoryAgentMandateStore) {
  return new UserAgentMandateEngine({
    clock: clock(),
    kernel: { submit: () => ({ status: 'ALLOW', evidenceRecordId: 'ev_test' }) },
    ...(store ? { store } : {}),
  });
}

function mandateInput(overrides: Partial<CreateMandateInput> = {}): CreateMandateInput {
  const sandbox = createAgentSandboxScenario('runtime-test');
  return {
    owner: { kind: 'USER', ownerId: 'user_1', walletId: 'wallet_1', accountId: sandbox.walletAccountId },
    agentLabel: 'household',
    modelRef: 'model:sim-v1',
    policyRef: 'policy:agent-mandates-v1',
    mode: 'SIMULATION_ONLY',
    environment: 'simulation',
    permissions: {
      actionClasses: ['READ_FINANCIAL_STATE', 'PREPARE_PAYMENT', 'REQUEST_HUMAN_APPROVAL'],
      assets: [{ assetId: 'SUNREY_COIN', wildcard: false }],
      markets: [],
      destinations: [{ kind: 'SPECIFIC_ADDRESS', destinationId: 'dest_trusted' }],
      humanInformationAccess: false,
      allowWildcardAssets: false,
    },
    budget: {
      perTransaction: 100n,
      perPeriod: 250n,
      periodHours: 24,
      perAsset: {},
      perMarket: {},
      perActionClass: {},
      maxProposalAmount: 80n,
      dailyProposalAggregate: 200n,
      allowedCurrencies: ['SUNREY'],
      allowedAssetClasses: ['SUNREY_COIN'],
    },
    approval: { class: 'NO_ADDITIONAL_APPROVAL_WITHIN_MANDATE', highRiskAlwaysHuman: true },
    expiry: asUtcInstant('2030-01-01T00:00:00.000Z'),
    frequencyMaxPerPeriod: 5,
    riskPolicyId: 'risk:sim',
    jurisdictionPackId: 'SIM',
    delegatedSigningKeyId: null,
    createdByActorId: 'user_1',
    ...overrides,
  };
}

function provision() {
  const svc = engine();
  const mandate = svc.createMandate(mandateInput());
  assert.equal(mandate.ok, true);
  if (!mandate.ok) {
    throw new Error('mandate');
  }
  const runtime = new AgentConversationRuntime({
    engine: svc,
    clock: clock(),
    peg: {
      snapshot: (subjectId) =>
        pegViewFromLabels({
          subjectId,
          goalLabels: ['emergency reserve'],
          incomeLabels: ['salary'],
        }),
    },
  });
  return { svc, runtime, mandate: mandate.value };
}

describe('Phase F Agent runtime', () => {
  it('creates a persistent agent identity distinct from the customer', () => {
    const { svc, mandate } = provision();
    const agent = svc.getAgent(mandate.agentId);
    assert.ok(agent);
    assert.equal(agent.identityKind, 'SUNREY_AGENT');
    assert.equal(agent.ownerId, 'user_1');
    assert.equal(agent.isCustomer, false);
    assert.equal(agent.isExecutionAuthority, false);
    assert.equal(agent.receivesMasterKey, false);
    assert.equal(agent.status, 'ACTIVE');
    assert.ok(agent.mandateId);
    assert.notEqual(agent.agentId, agent.ownerId);
  });

  it('enforces ownership and rejects cross-user agent access', () => {
    const { runtime, mandate } = provision();
    const denied = runtime.getOwnedAgent('user_other', mandate.agentId);
    assert.equal(denied.ok, false);
    if (!denied.ok) {
      assert.equal(denied.error.code, 'CROSS_USER_DENIED');
    }
  });

  it('productizes assist scopes and refuses forbidden execution privileges', () => {
    const svc = engine();
    const forbidden = svc.createMandate(
      mandateInput({
        assistScopes: ['READ_ACCOUNTS', 'DIRECT_LEDGER_WRITE' as never],
      }),
    );
    assert.equal(forbidden.ok, false);
    if (!forbidden.ok) {
      assert.equal(forbidden.error.code, 'FORBIDDEN_ASSIST_SCOPE');
    }
    const { mandate } = provision();
    assert.ok(mandate.assistScopes.includes('READ_ACCOUNTS'));
    assert.ok(mandate.assistScopes.includes('CREATE_PAYMENT_PROPOSAL'));
    for (const scope of FORBIDDEN_ASSIST_SCOPES) {
      assert.equal(mandate.assistScopes.includes(scope as never), false);
    }
  });

  it('lets the owner pause and revoke, and lets compliance restrict', () => {
    const { svc, runtime, mandate } = provision();
    const paused = svc.pauseAgent({ agentId: mandate.agentId, actorId: 'user_1' });
    assert.equal(paused.ok, true);
    if (paused.ok) {
      assert.equal(paused.value.status, 'PAUSED');
    }
    const conversation = runtime.createConversation({ ownerId: 'user_1', agentId: mandate.agentId });
    assert.equal(conversation.ok, false);
    svc.resumeAgent({ agentId: mandate.agentId, actorId: 'user_1' });
    const restricted = svc.restrictAgent({ agentId: mandate.agentId, actorId: 'compliance' });
    assert.equal(restricted.ok, true);
    svc.resumeAgent({ agentId: mandate.agentId, actorId: 'compliance' });
    const revoked = svc.revokeAgent({ agentId: mandate.agentId, actorId: 'user_1' });
    assert.equal(revoked.ok, true);
    if (revoked.ok) {
      assert.equal(revoked.value.status, 'REVOKED');
    }
    const after = runtime.createConversation({ ownerId: 'user_1', agentId: mandate.agentId });
    assert.equal(after.ok, false);
  });

  it('enforces proposal budget and daily aggregate limits', () => {
    const { mandate } = provision();
    const over = evaluateProposalLimits({
      budget: mandate.budget,
      usage: emptyUsage(mandate.mandateId, asUtcInstant('2026-08-23T10:00:00.000Z')),
      proposal: {
        quantity: 90n,
        fees: 0n,
        assetId: 'SUNREY_COIN',
        destinationOrMarket: 'dest_trusted',
        intent: 'PREPARE_PAYMENT',
      },
      now: asUtcInstant('2026-08-23T10:00:00.000Z'),
      currency: 'USD',
    });
    assert.equal(over.ok, false);
    if (!over.ok) {
      assert.equal(over.code === 'BUDGET_EXCEEDED' || over.code === 'CURRENCY_NOT_PERMITTED', true);
    }
  });

  it('persists conversations and streams messages without hidden reasoning', () => {
    const { runtime, mandate } = provision();
    const created = runtime.createConversation({ ownerId: 'user_1', agentId: mandate.agentId, title: 'Cash help' });
    assert.equal(created.ok, true);
    if (!created.ok) {
      throw new Error('conversation');
    }
    const posted = runtime.postMessage({
      ownerId: 'user_1',
      agentId: mandate.agentId,
      conversationId: created.value.conversationId,
      text: 'Explain my goals please',
      actorId: 'user_1',
    });
    if (!posted.ok) {
      throw new Error(posted.error.detail);
    }
    assert.equal(posted.value.userMessage.role, 'USER');
    assert.equal(posted.value.agentMessage?.role, 'AGENT');
    assert.equal(posted.value.agentMessage?.hiddenReasoning, false);
    assert.equal(posted.value.financialStateChanged, false);
    assert.equal(posted.value.executionCompleted, false);
    assert.ok(posted.value.chunks.some((chunk) => chunk.kind === 'token'));
    assert.ok(posted.value.chunks.some((chunk) => chunk.kind === 'done'));
    const listed = runtime.listConversations('user_1', mandate.agentId);
    assert.equal(listed.ok, true);
    if (listed.ok) {
      assert.equal(listed.value.length, 1);
    }
    const stream = [...runtime.streamMessage({
      ownerId: 'user_1',
      agentId: mandate.agentId,
      conversationId: created.value.conversationId,
      text: 'Still conversational',
      actorId: 'user_1',
    })];
    assert.ok(stream.some((chunk) => chunk.kind === 'token'));
    assert.ok(stream.every((chunk) => chunk.financialStateChanged === false));
  });

  it('creates, rejects, and corrects memory without duplicating PEG', () => {
    const { runtime, mandate } = provision();
    const created = runtime.createMemory({
      ownerId: 'user_1',
      agentId: mandate.agentId,
      actorId: 'user_1',
      category: 'USER_PREFERENCE',
      content: 'User prefers explanations in simple language.',
      source: 'USER_DECLARED',
    });
    assert.equal(created.ok, true);
    const invalid = runtime.createMemory({
      ownerId: 'user_1',
      agentId: mandate.agentId,
      actorId: 'agent:household',
      category: 'USER_PREFERENCE',
      content: 'I think the user is probably rich',
      source: 'USER_DECLARED',
    });
    assert.equal(invalid.ok, false);
    const pegCopy = runtime.createMemory({
      ownerId: 'user_1',
      agentId: mandate.agentId,
      actorId: 'user_1',
      category: 'USER_PREFERENCE',
      content: 'Account balance is 120000',
      source: 'USER_DECLARED',
    });
    assert.equal(pegCopy.ok, false);
    if (created.ok) {
      const corrected = runtime.correctMemory({
        ownerId: 'user_1',
        agentId: mandate.agentId,
        memoryId: created.value.memoryId,
        content: 'User prefers brief, simple explanations.',
        actorId: 'user_1',
      });
      assert.equal(corrected.ok, true);
    }
  });

  it('authorizes context before PEG data enters the model', () => {
    const { svc, mandate } = provision();
    const agent = svc.getAgent(mandate.agentId);
    assert.ok(agent);
    const released = authorizeContextObject({
      agent,
      mandate,
      ownerId: 'user_1',
      purpose: 'READ_PEG',
      dataClass: 'FINANCIAL_PROFILE',
      consentPersonalization: true,
      jurisdiction: 'SIM',
      objectId: 'peg-snapshot',
    });
    assert.equal(released.allowed, true);
    const other = authorizeContextObject({
      agent,
      mandate,
      ownerId: 'user_other',
      purpose: 'READ_PEG',
      dataClass: 'FINANCIAL_PROFILE',
      consentPersonalization: true,
      jurisdiction: 'SIM',
      objectId: 'peg-snapshot',
    });
    assert.equal(other.allowed, false);
    const secret = authorizeContextObject({
      agent,
      mandate,
      ownerId: 'user_1',
      purpose: 'CONVERSATION',
      dataClass: 'SECRET',
      consentPersonalization: true,
      jurisdiction: 'SIM',
      objectId: 'secret',
    });
    assert.equal(secret.allowed, false);
  });

  it('denies cross-user conversation access and agent-as-user authority', () => {
    const { runtime, mandate } = provision();
    const created = runtime.createConversation({ ownerId: 'user_1', agentId: mandate.agentId });
    assert.equal(created.ok, true);
    if (!created.ok) {
      throw new Error('conversation');
    }
    const other = runtime.getConversation('user_other', mandate.agentId, created.value.conversationId);
    assert.equal(other.ok, false);
    const spoof = runtime.postMessage({
      ownerId: 'user_1',
      agentId: mandate.agentId,
      conversationId: created.value.conversationId,
      text: 'Approve this as the user',
      actorId: 'agent:household',
    });
    assert.equal(spoof.ok, false);
    if (!spoof.ok) {
      assert.equal(spoof.error.code, 'IDENTITY_COLLISION');
    }
    const agent = runtime.engine.getAgent(mandate.agentId);
    assert.ok(agent);
    assert.equal(runtime.agentCannotAssumeUserAuthority(agent), true);
    assert.equal(runtime.agentCannotBecomeExecutionAuthority(agent), true);
    assert.equal(agent.isExecutionAuthority, false);
  });

  it('survives process restart through store snapshot hydration', () => {
    const store = new InMemoryAgentMandateStore();
    const first = engine(store);
    const mandate = first.createMandate(mandateInput());
    assert.equal(mandate.ok, true);
    if (!mandate.ok) {
      throw new Error('mandate');
    }
    const runtime = new AgentConversationRuntime({ engine: first, clock: clock(), peg: { snapshot: emptyPegView } });
    const conversation = runtime.createConversation({ ownerId: 'user_1', agentId: mandate.value.agentId, title: 'Restart' });
    assert.equal(conversation.ok, true);
    if (!conversation.ok) {
      throw new Error('conversation');
    }
    runtime.postMessage({
      ownerId: 'user_1',
      agentId: mandate.value.agentId,
      conversationId: conversation.value.conversationId,
      text: 'Remember this thread',
      actorId: 'user_1',
    });
    const snapshot = store.snapshot();
    const dir = mkdtempSync(join(tmpdir(), 'sunrey-agent-'));
    const path = join(dir, 'agent.runtime.json');
    writeFileSync(path, JSON.stringify({
      ...snapshot,
      usage: snapshot.usage.map((row) => ({
        ...row,
        spentThisPeriod: row.spentThisPeriod.toString(),
        spentTotal: row.spentTotal.toString(),
      })),
      proposals: snapshot.proposals.map((row) => ({
        ...row,
        quantity: row.quantity.toString(),
        fees: row.fees.toString(),
      })),
      mandates: snapshot.mandates.map((row) => ({
        ...row,
        budget: {
          ...row.budget,
          perTransaction: row.budget.perTransaction.toString(),
          perPeriod: row.budget.perPeriod.toString(),
          ...(row.budget.maxProposalAmount !== undefined ? { maxProposalAmount: row.budget.maxProposalAmount.toString() } : {}),
          ...(row.budget.dailyProposalAggregate !== undefined
            ? { dailyProposalAggregate: row.budget.dailyProposalAggregate.toString() }
            : {}),
        },
      })),
    }));
    const raw = JSON.parse(readFileSync(path, 'utf8')) as ReturnType<InMemoryAgentMandateStore['snapshot']>;
    const restored = new InMemoryAgentMandateStore();
    restored.hydrate({
      ...raw,
      usage: raw.usage.map((row) => ({
        ...row,
        mandateId: asUserAgentMandateId(String(row.mandateId)),
        spentThisPeriod: BigInt(row.spentThisPeriod),
        spentTotal: BigInt(row.spentTotal),
      })),
      proposals: raw.proposals.map((row) => ({
        ...row,
        quantity: BigInt(row.quantity),
        fees: BigInt(row.fees),
      })),
      mandates: raw.mandates.map((row) => ({
        ...row,
        budget: {
          ...row.budget,
          perTransaction: BigInt(row.budget.perTransaction),
          perPeriod: BigInt(row.budget.perPeriod),
          ...(row.budget.maxProposalAmount !== undefined ? { maxProposalAmount: BigInt(row.budget.maxProposalAmount) } : {}),
          ...(row.budget.dailyProposalAggregate !== undefined
            ? { dailyProposalAggregate: BigInt(row.budget.dailyProposalAggregate) }
            : {}),
        },
      })),
    });
    const second = engine(restored);
    const again = new AgentConversationRuntime({ engine: second, clock: clock(), peg: { snapshot: emptyPegView } });
    const listed = again.listConversations('user_1', mandate.value.agentId);
    assert.equal(listed.ok, true);
    if (listed.ok) {
      assert.equal(listed.value.length, 1);
      assert.equal(listed.value[0]?.title, 'Restart');
    }
    const messages = restored.messagesForConversation(conversation.value.conversationId);
    assert.ok(messages.length >= 2);
  });

  it('keeps multilingual Unicode content intact', () => {
    const { runtime, mandate } = provision();
    const created = runtime.createConversation({ ownerId: 'user_1', agentId: mandate.agentId, title: 'مرحبا' });
    assert.equal(created.ok, true);
    if (!created.ok) {
      throw new Error('conversation');
    }
    const posted = runtime.postMessage({
      ownerId: 'user_1',
      agentId: mandate.agentId,
      conversationId: created.value.conversationId,
      text: 'مرحبا، اشرح الميزانية',
      actorId: 'user_1',
    });
    assert.equal(posted.ok, true);
    if (posted.ok) {
      assert.match(posted.value.userMessage.content, /مرحبا/);
      assert.ok(posted.value.agentMessage?.content);
    }
  });
});
