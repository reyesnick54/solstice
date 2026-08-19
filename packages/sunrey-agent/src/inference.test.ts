import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asCustomerId } from '../../domain/src/customer.ts';
import { asJurisdiction } from '../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { DomainEventLog } from '../../events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../identity/src/simulation.ts';
import { ModelRegistry } from '../../model-registry/src/registry.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
import { AiRuntime } from '../../ai-runtime/src/runtime.ts';
import { createDefaultAiRuntimePolicy } from '../../ai-runtime/src/policy.ts';
import { LocalTestAiProvider } from '../../ai-runtime/src/providers/local-test.ts';
import { S3mAiProvider } from '../../ai-runtime/src/providers/s3m.ts';
import { localTestRequest } from '../../ai-runtime/src/fixtures.ts';
import { seedCanonicalAiModels } from '../../ai-runtime/src/registry.ts';
import { UserAgentMandateEngine } from './engine.ts';
import { createProposalFromInference } from './inference.ts';
import { createAgentSandboxScenario } from './sandbox.ts';

const NOW = asUtcInstant('2026-08-19T12:00:00.000Z');

describe('sunrey-agent inference port', () => {
  it('turns a prepare tool intent into a mandate-bound proposal without executing', () => {
    const clock = new FrozenClock(NOW);
    const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
    const identity = new SimulatedIdentityAdapter({ clock, keys, events: new DomainEventLog() });
    identity.provisionSimulatedActor({
      actorId: 'operator_1',
      jurisdiction: asJurisdiction('GB'),
      identityId: 'id_agent_ai',
      customerId: asCustomerId('cust_agent_ai'),
      capabilities: ['VIEW_ACCOUNT'],
    });
    const actor = identity.service.resolveActorContext('operator_1');
    assert.equal(actor.ok, true);
    if (!actor.ok) {
      throw new Error('actor');
    }
    const registry = new ModelRegistry();
    assert.equal(seedCanonicalAiModels(registry, actor.value, NOW).ok, true);
    const runtime = new AiRuntime(clock, registry, createDefaultAiRuntimePolicy('S3M_PRIMARY'), {
      S3M: new S3mAiProvider(clock, false),
      LOCAL_TEST: new LocalTestAiProvider(clock),
    });
    const engine = new UserAgentMandateEngine({
      clock,
      kernel: { submit: () => ({ status: 'ALLOW', evidenceRecordId: 'ev_inf' }) },
    });
    const sandbox = createAgentSandboxScenario('inference-port');
    const mandate = engine.createMandate({
      owner: { kind: 'USER', ownerId: 'user_1', walletId: 'wallet_1', accountId: sandbox.walletAccountId },
      agentLabel: 'inference-port',
      modelRef: 'mdl_sunrey_local_test@local-test-v1',
      policyRef: 'policy:agent-mandates-v1',
      mode: 'SIMULATION_ONLY',
      environment: 'simulation',
      permissions: {
        actionClasses: ['PREPARE_PAYMENT'],
        assets: [{ assetId: 'SUNREY_COIN', wildcard: false }],
        markets: [{ marketId: sandbox.marketId }],
        destinations: [{ kind: 'SPECIFIC_ADDRESS', destinationId: 'dest_trusted' }],
        humanInformationAccess: false,
        allowWildcardAssets: false,
      },
      budget: { perTransaction: 50n, perPeriod: 200n, periodHours: 24, perAsset: {}, perMarket: {}, perActionClass: {} },
      approval: { class: 'NO_ADDITIONAL_APPROVAL_WITHIN_MANDATE', highRiskAlwaysHuman: true },
      expiry: asUtcInstant('2030-01-01T00:00:00.000Z'),
      frequencyMaxPerPeriod: 4,
      riskPolicyId: 'risk:sim',
      jurisdictionPackId: 'SIM',
      delegatedSigningKeyId: null,
      createdByActorId: 'user_1',
    });
    if (!mandate.ok) {
      throw new Error(mandate.error.detail);
    }
    assert.equal(mandate.ok, true);
    const inferred = runtime.infer(localTestRequest({ fixture: 'structured_financial_proposal' }));
    assert.equal(inferred.ok, true);
    if (!inferred.ok || !inferred.value.response) {
      throw new Error('inference');
    }
    const proposal = createProposalFromInference(engine, {
      mandateId: mandate.value.mandateId,
      response: inferred.value.response,
      networkId: 'net_sunrey_simulation',
    });
    if (!proposal.ok) {
      throw new Error(proposal.error.detail);
    }
    assert.equal(proposal.ok, true);
    assert.equal(proposal.value.guaranteedReturn, false);
    assert.equal(engine.getAgent(mandate.value.agentId)?.receivesMasterKey, false);
    const executed = engine.requestExecution(proposal.value.proposalId, {
      wallet: {
        walletId: 'wallet_1',
        accountId: sandbox.walletAccountId,
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
    assert.equal(executed.ok, true);
    if (executed.ok) {
      assert.equal(executed.value.finality, 'NOT_SUBMITTED');
    }
  });
});
