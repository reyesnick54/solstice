import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { UserAgentMandateEngine, type CreateMandateInput } from './engine.ts';
import { createFixtureToolPorts, FIXTURE_AHMED, FIXTURE_MARKET } from './tools/fixtures.ts';
import { flowExecutedNothing, runReferenceFlow } from './tools/reference-flows.ts';
import { createAgentToolRuntime } from './tools/runtime.ts';
import type { ToolSession } from './tools/types.ts';

function sessionFor(label: string) {
  const frozen = new FrozenClock(asUtcInstant('2026-08-23T00:00:00.000Z'));
  const engine = new UserAgentMandateEngine({
    clock: frozen,
    kernel: { submit: () => ({ status: 'ALLOW', evidenceRecordId: 'ev_flow' }) },
  });
  const input: CreateMandateInput = {
    owner: { kind: 'USER', ownerId: 'user_1', walletId: 'wallet_1', accountId: 'acct_cash_1' },
    agentLabel: label,
    modelRef: 'model:sim-v1',
    policyRef: 'policy:agent-tools-v1',
    mode: 'SIMULATION_ONLY',
    environment: 'simulation',
    permissions: {
      actionClasses: [
        'READ_FINANCIAL_STATE',
        'PREPARE_PAYMENT',
        'PREPARE_EXCHANGE_ORDER',
        'REBALANCE_WITHIN_POLICY',
        'REQUEST_HUMAN_APPROVAL',
      ],
      assets: [
        { assetId: 'FIAT_ACCOUNT', wildcard: false },
        { assetId: 'SUNREY_COIN', wildcard: false },
      ],
      markets: [{ marketId: FIXTURE_MARKET }],
      destinations: [
        { kind: 'TRUSTED_DESTINATION', destinationId: FIXTURE_AHMED },
        { kind: 'TRUSTED_DESTINATION', destinationId: 'USD_SAR' },
      ],
      humanInformationAccess: false,
      allowWildcardAssets: false,
    },
    budget: {
      perTransaction: 5_000_000n,
      perPeriod: 10_000_000n,
      periodHours: 24,
      perAsset: {},
      perMarket: {},
      perActionClass: {},
    },
    approval: { class: 'MOBILE_CONFIRMATION', highRiskAlwaysHuman: true },
    expiry: asUtcInstant('2030-01-01T00:00:00.000Z'),
    frequencyMaxPerPeriod: 20,
    riskPolicyId: 'risk:sim',
    jurisdictionPackId: 'SIM',
    delegatedSigningKeyId: null,
    createdByActorId: 'user_1',
  };
  const created = engine.createMandate(input);
  if (!created.ok) throw new Error(created.error.detail);
  const session: ToolSession = {
    conversationId: `conv_${label}`,
    turnId: `turn_${label}`,
    correlationId: `corr_${label}`,
    agentId: created.value.agentId,
    agentState: 'ACTIVE',
    mandateId: created.value.mandateId,
    ownerId: 'user_1',
    sessionOwnerId: 'user_1',
    accountId: 'acct_cash_1',
    walletId: 'wallet_1',
    actorId: 'user_1',
    environment: 'simulation',
    jurisdictionAvailable: true,
    purpose: 'FINANCIAL_EXPLANATION',
    allowedDataClasses: ['PUBLIC', 'FINANCIAL_PRIVATE', 'PERSONAL_SENSITIVE'],
    productCapabilities: ['accounts', 'payments', 'fx', 'grow', 'peg', 'portfolio', 'exchange', 'custody', 'cards', 'consent', 'hin'],
    approvedToolVersions: {},
    modelText: '',
    now: frozen.now(),
  };
  return {
    runtime: createAgentToolRuntime({ engine, ports: createFixtureToolPorts(), clock: frozen }),
    session,
  };
}

describe('agent reference flows', () => {
  it('A: how much money do I have → snapshot, no invented numbers', () => {
    const { runtime, session } = sessionFor('a');
    const results = runReferenceFlow(runtime, session, 'A_BALANCE');
    assert.equal(results[0]?.status, 'SUCCESS');
    assert.equal(results[0]?.toolId, 'getFinancialSnapshot');
    assert.equal(results[0]?.rendering?.component, 'ACCOUNT_CARD');
    assert.equal(flowExecutedNothing(results), true);
    const totals = (results[0]?.payload as { totals: readonly { available: { minorUnits: string } }[] }).totals;
    assert.ok(totals.some((item) => item.available.minorUnits === '2500000'));
  });

  it('B: send Ahmed 1,000 SAR → recipient, quote, proposal, no execution', () => {
    const { runtime, session } = sessionFor('b');
    const results = runReferenceFlow(runtime, session, 'B_PAYMENT');
    assert.equal(results[0]?.toolId, 'getRecipients');
    assert.equal(results[1]?.toolId, 'createPaymentQuote');
    assert.equal(results[1]?.rendering?.component, 'PAYMENT_QUOTE');
    assert.equal(results[2]?.toolId, 'createPaymentProposal');
    assert.equal(results[2]?.status, 'APPROVAL_REQUIRED');
    assert.ok(results[2]?.proposalId);
    assert.equal(flowExecutedNothing(results), true);
  });

  it('C: what should I do with $10,000 → PEG, opportunities, growth proposal', () => {
    const { runtime, session } = sessionFor('c');
    const results = runReferenceFlow(runtime, session, 'C_GROW');
    assert.equal(results[0]?.toolId, 'analyzeSpending');
    assert.equal(results[1]?.toolId, 'getOpportunities');
    assert.equal(results[1]?.rendering?.component, 'GROWTH_OPPORTUNITY');
    assert.equal(results[2]?.toolId, 'createGrowthProposal');
    assert.equal(results[2]?.status, 'APPROVAL_REQUIRED');
    assert.equal(flowExecutedNothing(results), true);
  });

  it('D: buy SunRey Coin → eligibility, order proposal, no execution', () => {
    const { runtime, session } = sessionFor('d');
    const results = runReferenceFlow(runtime, session, 'D_EXCHANGE');
    assert.equal(results[0]?.toolId, 'getAsset');
    assert.equal(results[1]?.toolId, 'getMarketPrice');
    assert.equal(results[2]?.toolId, 'createExchangeOrderProposal');
    assert.equal(results[2]?.status, 'APPROVAL_REQUIRED');
    assert.equal(results[2]?.rendering?.component, 'TRADE_PROPOSAL');
    assert.equal(flowExecutedNothing(results), true);
  });
});
