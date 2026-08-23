import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asCustomerId } from '../../domain/src/customer.ts';
import { asJurisdiction } from '../../domain/src/jurisdiction.ts';
import { DomainEventLog } from '../../events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../identity/src/simulation.ts';
import { ModelRegistry } from '../../model-registry/src/registry.ts';
import { InMemorySecretProvider, secretRef } from '../../security/src/secrets.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
import { AI_RUNTIME_NOW, defaultAiPolicy, localTestRequest } from './fixtures.ts';
import { publicTraceView } from './tracing.ts';
import { seedCanonicalAiModels } from './registry.ts';
import { AiRuntime } from './runtime.ts';
import { parseStructuredOutput } from './structured.ts';
import { S3mAiProvider } from './providers/s3m.ts';
import { LocalTestAiProvider } from './providers/local-test.ts';
import { XaiGrokAiProvider } from './providers/xai-grok.ts';

function operator() {
  const clock = new FrozenClock(AI_RUNTIME_NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const identity = new SimulatedIdentityAdapter({ clock, keys, events: new DomainEventLog() });
  assert.equal(
    identity.provisionSimulatedActor({
      actorId: 'operator_1',
      jurisdiction: asJurisdiction('GB'),
      identityId: 'id_ai_op',
      customerId: asCustomerId('cust_ai_op'),
      capabilities: ['VIEW_ACCOUNT'],
    }).ok,
    true,
  );
  const actor = identity.service.resolveActorContext('operator_1');
  if (!actor.ok) {
    throw new Error('actor');
  }
  return actor.value;
}

function runtime(mode: 'S3M_PRIMARY' | 'S3M_ONLY' | 'GROK_DEMO_ONLY' | 'GROK_BETA_PRIMARY' | 'DUAL_SHADOW_COMPARE' = 'S3M_PRIMARY') {
  const clock = new FrozenClock(AI_RUNTIME_NOW);
  const registry = new ModelRegistry();
  const seeded = seedCanonicalAiModels(registry, operator(), AI_RUNTIME_NOW);
  assert.equal(seeded.ok, true);
  return new AiRuntime(clock, registry, defaultAiPolicy(mode), {
    S3M: new S3mAiProvider(clock, false),
    LOCAL_TEST: new LocalTestAiProvider(clock),
    XAI_GROK: new XaiGrokAiProvider(clock),
  });
}

describe('SunRey AI runtime', () => {
  it('resolves ModelRef through the canonical model registry', () => {
    const svc = runtime();
    const result = svc.infer(localTestRequest({ fixture: 'normal' }));
    if (!result.ok) {
      throw new Error(result.error.detail);
    }
    assert.equal(result.ok, true);
    assert.equal(result.value.response?.modelRef.modelId.startsWith('mdl_'), true);
    assert.equal(result.value.trace.success, true);
  });

  it('rejects invalid structured output', () => {
    const parsed = parseStructuredOutput({
      kind: 'FINANCIAL_PROPOSAL',
      action: 'PREPARE_PAYMENT',
      assetId: 'SUNREY_COIN',
      quantity: { minorUnits: 10.5, currency: 'SUNREY' },
      destinationOrMarket: 'dest_trusted',
      fees: { minorUnits: '1', currency: 'SUNREY' },
      operationalRationale: 'invalid float',
      guaranteedReturn: false,
    });
    assert.equal(parsed.ok, false);
    if (!parsed.ok) {
      assert.equal(parsed.error.code, 'FLOATING_POINT_MONEY_FORBIDDEN');
    }
    const svc = runtime();
    const result = svc.infer(localTestRequest({ fixture: 'malformed' }));
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code === 'INVALID_STRUCTURED_OUTPUT' || result.error.code === 'FLOATING_POINT_MONEY_FORBIDDEN', true);
    }
  });

  it('rejects malicious execute tools from provider output', () => {
    const svc = runtime();
    const result = svc.infer(localTestRequest({ fixture: 'malicious_tool' }));
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'FORBIDDEN_TOOL_REQUESTED');
    }
  });

  it('does not silently route S3M failures to Grok', () => {
    const svc = runtime('S3M_PRIMARY');
    const result = svc.infer(
      localTestRequest({
        dataClass: 'FINANCIAL_PRIVATE',
        taskClass: 'PAYMENT_PREPARATION',
        fixture: 'structured_financial_proposal',
      }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'S3M_UNAVAILABLE_NO_EXTERNAL_FALLBACK');
    }
  });

  it('selects LocalTest deterministically for synthetic S3M_PRIMARY fallback', () => {
    const first = runtime().infer(localTestRequest({ fixture: 'structured_financial_proposal' }));
    const second = runtime().infer(localTestRequest({ fixture: 'structured_financial_proposal' }));
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) {
      throw new Error('expected routing');
    }
    assert.equal(first.value.trace.routingDecision.primary, 'LOCAL_TEST');
    assert.equal(second.value.trace.routingDecision.primary, first.value.trace.routingDecision.primary);
    assert.equal(first.value.trace.routingDecision.providerSelfSelected, false);
    assert.equal(first.value.response?.grantsExecutionAuthority, false);
    assert.equal(first.value.response?.toolIntents[0]?.name, 'PREPARE_PAYMENT');
    assert.equal(first.value.response?.toolIntents[0]?.executes, false);
  });

  it('never releases private keys or authentication secrets', () => {
    const svc = runtime();
    const keys = svc.infer(localTestRequest({ dataClass: 'PRIVATE_KEY_MATERIAL', prompt: 'sign with this' }));
    assert.equal(keys.ok, false);
    if (!keys.ok) {
      assert.equal(keys.error.code, 'NEVER_RELEASE_DATA_CLASS');
    }
    const secrets = svc.infer(localTestRequest({ dataClass: 'AUTHENTICATION_SECRET' }));
    assert.equal(secrets.ok, false);
    const restricted = svc.infer(
      localTestRequest({
        dataClass: 'FINANCIAL_PRIVATE',
        userApprovedExternal: true,
        context: [
          {
            objectId: 'ctx_1',
            dataClass: 'FINANCIAL_PRIVATE',
            authorizedProviders: ['S3M'],
            userApproved: true,
            payload: { note: 'balances' },
          },
        ],
      }),
    );
    assert.equal(restricted.ok, false);
  });

  it('keeps secrets out of traces', () => {
    const svc = runtime();
    svc.infer(localTestRequest({ fixture: 'normal', prompt: 'hello secret://simulation/ai-provider-key' }));
    const trace = svc.latestTrace();
    assert.ok(trace);
    const view = JSON.stringify(publicTraceView(trace));
    assert.equal(view.includes('secret://'), false);
    assert.equal(trace.storedRawPrompt, false);
    assert.equal(trace.storedSecrets, false);
    assert.equal(trace.promptHash.length, 64);
    const provider = new InMemorySecretProvider('simulation', { 'ai-provider-key': 'sk-not-for-logs' });
    const resolved = provider.resolve(secretRef('simulation', 'ai-provider-key'));
    assert.equal(resolved.ok, true);
    if (resolved.ok) {
      assert.equal(String(resolved.value).includes('sk-'), false);
    }
  });

  it('provider failures do not bypass security', () => {
    const svc = runtime();
    const timeout = svc.infer(localTestRequest({ fixture: 'timeout' }));
    assert.equal(timeout.ok, false);
    if (!timeout.ok) {
      assert.equal(timeout.error.code, 'PROVIDER_TIMEOUT');
    }
    const unavailable = svc.infer(localTestRequest({ fixture: 'unavailable' }));
    assert.equal(unavailable.ok, false);
    assert.equal(svc.latestTrace()?.success, false);
  });

  it('streams a completed inference without granting execution authority', () => {
    const svc = runtime();
    const chunks = [...svc.inferStream(localTestRequest({ fixture: 'normal' }))];
    assert.ok(chunks.some((chunk) => chunk.kind === 'token'));
    assert.equal(chunks.at(-1)?.kind, 'done');
    assert.ok(chunks.every((chunk) => chunk.grantsExecutionAuthority === false));
    assert.ok(chunks.every((chunk) => chunk.executedFinancialMutation === false));
  });
});
