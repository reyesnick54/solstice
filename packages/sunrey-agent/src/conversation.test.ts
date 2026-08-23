import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ConversationalActionRuntime,
  conversationNow,
  createConversationSandbox,
  extractSlotsFromText,
  fixtureCatalog,
  HIGH_IMPACT_ACKNOWLEDGEMENTS,
  InMemoryConversationStore,
  languageForStatus,
  missingSlotQuestions,
  resolveEntityReference,
  sanitizeAgentLanguage,
} from './conversation/index.ts';
import type { ConversationActor } from './conversation/types.ts';

function runtime(subjectId = 'cust_conversation') {
  return new ConversationalActionRuntime(new InMemoryConversationStore(), createConversationSandbox({ subjectId }));
}

function human(subjectId = 'cust_conversation', stepUp = false): ConversationActor {
  return {
    actorId: 'actor_human',
    subjectId,
    kind: 'HUMAN',
    sessionId: 'ses_1',
    deviceId: 'dev_1',
    authenticationAssurance: stepUp ? 'STEP_UP_SATISFIED' : 'AAL1',
  };
}

describe('conversational intent and slots', () => {
  it('treats intent as routing metadata only', () => {
    const slots = extractSlotsFromText('Send Ahmed 1,000 SAR.');
    assert.equal(slots.recipient?.raw, 'Ahmed');
    assert.equal(slots.currency?.raw, 'SAR');
    assert.equal(slots.amount?.guessed, false);
    const missing = missingSlotQuestions('PAYMENT_REQUEST', slots);
    assert.equal(missing.some((item) => item.slot === 'sourceAccount'), true);
  });

  it('asks for missing payment fields instead of guessing', () => {
    const svc = runtime();
    const session = svc.start({ subjectId: 'cust_conversation', now: conversationNow() });
    const turn = svc.handleTurn({
      conversationId: session.conversationId,
      actor: human(),
      text: 'Send Mark some money.',
      now: conversationNow(),
    });
    assert.equal(turn.ok, true);
    if (!turn.ok) {
      throw new Error('expected questions');
    }
    assert.equal(turn.languagePhase, 'COLLECTING');
    assert.equal(turn.card, null);
    assert.ok(turn.questions.length >= 1);
    assert.equal(turn.questions.every((item) => item.reason === 'REQUIRED' || item.reason === 'AMBIGUOUS'), true);
  });

  it('does not choose an arbitrary Mark', () => {
    const catalog = fixtureCatalog('cust_conversation');
    const resolved = resolveEntityReference(catalog, 'cust_conversation', 'recipient', 'Mark');
    assert.equal(resolved.ok, false);
    if (resolved.ok) {
      throw new Error('expected ambiguous');
    }
    assert.equal(resolved.code, 'ENTITY_AMBIGUOUS');
    assert.equal(resolved.candidates.length, 2);
  });
});

describe('FLOW A payment', () => {
  it('creates a payment Action Card, requires step-up, then reports completion after human approval', () => {
    const svc = runtime();
    const session = svc.start({ subjectId: 'cust_conversation', now: conversationNow() });
    const created = svc.handleTurn({
      conversationId: session.conversationId,
      actor: human(),
      text: 'Send Ahmed 1,000 SAR.',
      now: conversationNow(),
    });
    assert.equal(created.ok, true);
    if (!created.ok || !created.action || !created.card) {
      throw new Error('expected payment card');
    }
    assert.equal(created.card.type, 'PAYMENT');
    assert.equal(created.card.agentIsApprover, false);
    assert.equal(created.languagePhase, 'PROPOSAL_CREATED');
    assert.match(created.conversation.messages.at(-1)?.text ?? '', /not approved or completed/);
    assert.equal(created.card.availableActions.includes('APPROVE'), true);
    assert.equal(created.action.proposal?.clientFabricated, false);

    const blocked = svc.approve({
      actionId: created.action.actionId,
      actor: human(),
      now: conversationNow(),
      acknowledgements: HIGH_IMPACT_ACKNOWLEDGEMENTS,
    });
    assert.equal(blocked.ok, true);
    if (!blocked.ok || !blocked.action) {
      throw new Error('expected step-up hold');
    }
    assert.equal(blocked.action.status, 'AWAITING_STEP_UP');

    const approved = svc.approve({
      actionId: created.action.actionId,
      actor: human('cust_conversation', true),
      now: conversationNow(),
      acknowledgements: HIGH_IMPACT_ACKNOWLEDGEMENTS,
    });
    assert.equal(approved.ok, true);
    if (!approved.ok || !approved.action) {
      throw new Error('expected execution');
    }
    assert.equal(approved.action.status, 'COMPLETED');
    assert.equal(approved.action.approval?.originatedFromAgent, false);
    assert.equal(approved.languagePhase, 'COMPLETED');
    const pending = svc.listActions('cust_conversation', 'AWAITING_APPROVAL');
    assert.equal(pending.some((item) => item.actionId === created.action?.actionId), false);
    const done = svc.listActions('cust_conversation', 'COMPLETED');
    assert.equal(done.length, 1);
  });
});

describe('FLOW B growth', () => {
  it('reads snapshot tools, issues a growth proposal, then revises on modification', () => {
    const svc = runtime();
    const session = svc.start({ subjectId: 'cust_conversation', now: conversationNow() });
    const created = svc.handleTurn({
      conversationId: session.conversationId,
      actor: human(),
      text: 'I have $10,000. How should I grow it?',
      now: conversationNow(),
    });
    assert.equal(created.ok, true);
    if (!created.ok || !created.action || !created.action.explanation) {
      throw new Error('expected growth proposal');
    }
    assert.equal(created.action.type, 'GROWTH');
    assert.equal(created.action.explanation.amount.uncertainty, 'FACT');
    assert.match(created.action.explanation.risks, /projections/i);
    assert.equal(created.action.explanation.inventedByModel, false);
    const prior = created.action.proposal?.proposalId;
    const modified = svc.handleTurn({
      conversationId: session.conversationId,
      actor: human(),
      text: 'Make it 500 instead.',
      now: conversationNow('2026-08-23T06:01:00.000Z'),
    });
    assert.equal(modified.ok, true);
    if (!modified.ok || !modified.action || !modified.card) {
      throw new Error('expected revised card');
    }
    assert.notEqual(modified.action.proposal?.proposalId, prior);
    assert.equal(modified.action.proposal?.version, 2);
    assert.equal(modified.card.financialTerms.amount.minorUnits, '50000');
    const approved = svc.approve({
      actionId: modified.action.actionId,
      actor: human('cust_conversation', true),
      now: conversationNow('2026-08-23T06:02:00.000Z'),
      acknowledgements: HIGH_IMPACT_ACKNOWLEDGEMENTS,
    });
    assert.equal(approved.ok, true);
    if (!approved.ok || !approved.action) {
      throw new Error('expected sandbox growth execution');
    }
    assert.equal(approved.action.status, 'COMPLETED');
  });
});

describe('FLOW C FX and FLOW D exchange', () => {
  it('quotes FX from the server and never claims completion at proposal time', () => {
    const svc = runtime();
    const session = svc.start({ subjectId: 'cust_conversation', now: conversationNow() });
    const created = svc.handleTurn({
      conversationId: session.conversationId,
      actor: human(),
      text: 'Convert $2,000 to Riyals.',
      now: conversationNow(),
    });
    assert.equal(created.ok, true);
    if (!created.ok || !created.card || !created.action) {
      throw new Error('expected FX card');
    }
    assert.equal(created.card.type, 'FX');
    assert.equal(created.card.financialTerms.rate?.source, 'FX_QUOTE_PROVIDER');
    assert.equal(created.card.financialTerms.rate?.uncertainty, 'FACT');
    assert.equal(sanitizeAgentLanguage('Your payment is complete', created.card.status).includes('complete'), false);
    const approved = svc.approve({
      actionId: created.action.actionId,
      actor: human('cust_conversation', true),
      now: conversationNow(),
      acknowledgements: HIGH_IMPACT_ACKNOWLEDGEMENTS,
    });
    assert.equal(approved.ok, true);
    if (!approved.ok || !approved.action) {
      throw new Error('expected FX execution');
    }
    assert.equal(approved.action.status, 'COMPLETED');
  });

  it('creates an exchange order proposal only for eligible sandbox assets', () => {
    const svc = runtime();
    const session = svc.start({ subjectId: 'cust_conversation', now: conversationNow() });
    const created = svc.handleTurn({
      conversationId: session.conversationId,
      actor: human(),
      text: 'Buy $500 of SunRey Coin.',
      now: conversationNow(),
    });
    assert.equal(created.ok, true);
    if (!created.ok || !created.card) {
      throw new Error('expected exchange card');
    }
    assert.equal(created.card.type, 'EXCHANGE');
    assert.equal(created.card.availableActions.includes('APPROVE'), true);
  });
});

describe('explainability and language safety', () => {
  it('labels fact estimate projection and unknown without confident conversion', () => {
    assert.match(languageForStatus('PROPOSAL_CREATED'), /not approved, submitted, or completed/);
    assert.match(languageForStatus('SUBMITTED'), /not completed/);
    assert.match(languageForStatus('COMPLETED'), /completion/);
  });
});
