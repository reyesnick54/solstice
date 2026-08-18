import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { runSunReyAgent } from './cli.ts';
import { UserAgentMandateEngine } from './engine.ts';
import { evaluateAgentExchangePath } from './exchange.ts';
import { createAgentSandboxScenario } from './sandbox.ts';
import { authorizeWithWallet, walletAuthorizationView } from './wallet.ts';

describe('agent mandate integrations', () => {
  it('uses Chunk 95 eligibility and price protection', () => {
    const ok = evaluateAgentExchangePath({
      marketId: 'mkt_sunrey_moonrey',
      approvedMarketIds: ['mkt_sunrey_moonrey'],
      marketState: 'OPEN',
      quantity: 10n,
      notional: 10n,
      priceUnits: 100n,
      referenceUnits: 100n,
      participantEligible: true,
      accountRestricted: false,
      settlementHealthy: true,
    });
    assert.equal(ok.dvpRequired, true);
    const halted = evaluateAgentExchangePath({
      marketId: 'mkt_sunrey_moonrey',
      approvedMarketIds: ['mkt_sunrey_moonrey'],
      marketState: 'HALTED',
      quantity: 10n,
      notional: 10n,
      priceUnits: 100n,
      referenceUnits: 100n,
      participantEligible: true,
      accountRestricted: false,
      settlementHealthy: true,
    });
    assert.equal(halted.eligible, false);
  });

  it('refuses AI identity and master-key wallet authorization', () => {
    const view = walletAuthorizationView({
      walletId: 'wallet_1',
      accountId: 'acct_1',
      networkId: 'net_sunrey_simulation',
      delegatedKeyId: 'delegated-1',
    });
    assert.equal(view.masterKeyHeldByAgent, false);
    const ai = authorizeWithWallet({
      account: {
        schemaVersion: 1,
        accountId: 'acct_1',
        address: {
          schemaVersion: 1,
          text: 'sr1sim',
          binaryHex: '00',
          networkId: 'net_sunrey_simulation',
          networkClass: 'DEVELOPMENT',
          addressClass: 'POLICY_ACCOUNT',
          algorithm: 'ED25519_V1',
          payloadHex: '00',
        },
        ownerActorId: 'user_1',
        controllerActorIds: ['user_1'],
        accountType: 'POLICY_ACCOUNT',
        authorizationPolicy: {
          schemaVersion: 1,
          kind: 'SINGLE_SIGNATURE',
          threshold: 1,
          authorizedKeyIds: ['k1'],
          roleBindings: {},
          recoveryKeyIds: [],
        },
        nonce: 0n,
        approvedCryptoSuites: ['ED25519'],
        recoveryPolicyReference: null,
        createdHeight: 1,
        status: 'ACTIVE',
        keys: [],
        delegatedLimits: [],
        pendingRecovery: null,
        pendingRotation: null,
        securityHoldPolicy: null,
      },
      bodyHash: 'aa',
      signatures: [],
      currentHeight: 1,
      signerIsAiIdentity: true,
      usesMasterKey: false,
      delegatedKeyId: null,
    });
    assert.equal(ai.ok, false);
  });

  it('runs CLI mandate create/show/simulation/audit', () => {
    const svc = new UserAgentMandateEngine({
      clock: new FrozenClock(asUtcInstant('2026-08-18T00:00:00.000Z')),
      kernel: { submit: () => ({ status: 'ALLOW', evidenceRecordId: 'ev' }) },
    });
    const created = runSunReyAgent(svc, ['mandate', 'create']);
    assert.equal(created.ok, true);
    const mandateId = (created.payload as { mandateId: string }).mandateId;
    const shown = runSunReyAgent(svc, ['mandate', 'show', mandateId]);
    assert.equal(shown.ok, true);
    const sim = runSunReyAgent(svc, ['simulation']);
    assert.equal(sim.ok, true);
    const audit = runSunReyAgent(svc, ['audit']);
    assert.equal(audit.ok, true);
    const perms = runSunReyAgent(svc, ['permissions', mandateId]);
    assert.equal(perms.ok, true);
    const activity = runSunReyAgent(svc, ['activity', 'wallet_cli']);
    assert.equal(activity.ok, true);
    const sandbox = createAgentSandboxScenario('cli');
    assert.equal(sandbox.productionEligible, false);
  });

  it('returns a kernel refusal unchanged', () => {
    const svc = new UserAgentMandateEngine({
      clock: new FrozenClock(asUtcInstant('2026-08-18T00:00:00.000Z')),
      kernel: { submit: () => ({ status: 'BLOCK', evidenceRecordId: 'ev_block' }) },
    });
    const created = svc.createMandate({
      owner: { kind: 'USER', ownerId: 'user_1', walletId: 'wallet_1', accountId: 'acct_1' },
      agentLabel: 'k',
      modelRef: 'model:sim-v1',
      policyRef: 'policy:agent-mandates-v1',
      mode: 'PRODUCTION',
      environment: 'simulation',
      permissions: {
        actionClasses: ['EXECUTE_PREAPPROVED_PAYMENT'],
        assets: [{ assetId: 'SUNREY_COIN', wildcard: false }],
        markets: [],
        destinations: [{ kind: 'SPECIFIC_ADDRESS', destinationId: 'dest_trusted' }],
        humanInformationAccess: false,
        allowWildcardAssets: false,
      },
      budget: { perTransaction: 10n, perPeriod: 10n, periodHours: 24, perAsset: {}, perMarket: {}, perActionClass: {} },
      approval: { class: 'NO_ADDITIONAL_APPROVAL_WITHIN_MANDATE', highRiskAlwaysHuman: true },
      expiry: asUtcInstant('2030-01-01T00:00:00.000Z'),
      frequencyMaxPerPeriod: 3,
      riskPolicyId: 'risk:sim',
      jurisdictionPackId: 'SIM',
      delegatedSigningKeyId: null,
      createdByActorId: 'user_1',
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      throw new Error('expected mandate');
    }
    const proposal = svc.createProposal({
      mandateId: created.value.mandateId,
      intent: 'EXECUTE_PREAPPROVED_PAYMENT',
      reasonCode: 'PAY',
      strategyRef: null,
      assetId: 'SUNREY_COIN',
      quantity: 1n,
      destinationOrMarket: 'dest_trusted',
      fees: 0n,
      expectedOutcomeClass: 'PAYMENT_SUBMITTED_FOR_AUTHORIZATION',
      operationalRationale: 'kernel should refuse',
      modelRef: 'model:sim-v1',
      networkId: 'net_sunrey_simulation',
    });
    assert.equal(proposal.ok, true);
    if (!proposal.ok) {
      throw new Error('expected proposal');
    }
    const executed = svc.requestExecution(proposal.value.proposalId, {
      wallet: {
        walletId: 'wallet_1',
        accountId: 'acct_1',
        networkId: 'net_sunrey_simulation',
        policyHash: 'wp',
        delegatedKeyId: null,
        masterKeyHeldByAgent: false,
      },
      networkId: 'net_sunrey_simulation',
      jurisdiction: { packId: 'SIM', actionAvailable: true },
      risk: { restricted: false, reason: null, isWalletAuthority: false },
      kernelStateHash: 'k',
      humanApproved: true,
      actorId: 'user_1',
      signerIsAiIdentity: false,
      usesMasterKey: false,
    });
    assert.equal(executed.ok, false);
    if (executed.ok) {
      throw new Error('expected kernel refusal');
    }
    assert.equal(executed.error.code, 'COMPLIANCE_REFUSED');
    assert.match(executed.error.detail, /BLOCK/);
  });
});
