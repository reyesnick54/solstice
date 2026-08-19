import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asCustomerId } from '../../domain/src/customer.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { asJurisdiction } from '../../domain/src/jurisdiction.ts';
import { DomainEventLog } from '../../events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../identity/src/simulation.ts';
import { ModelRegistry } from '../../model-registry/src/registry.ts';
import { InMemorySecretProvider, secretRef } from '../../security/src/secrets.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
import { UserAgentMandateEngine } from '../../sunrey-agent/src/engine.ts';
import { createProposalFromInference, inferenceCannotExecute } from '../../sunrey-agent/src/inference.ts';
import { createAgentSandboxScenario } from '../../sunrey-agent/src/sandbox.ts';
import { AI_RUNTIME_NOW, defaultAiPolicy, s3mRequest } from './fixtures.ts';
import { createDefaultAiRuntimePolicy } from './policy.ts';
import { S3mAiProvider, S3mInferenceProvider } from './providers/s3m.ts';
import { resolveS3mProviderConfig } from './providers/s3m/configuration.ts';
import { SimulatedS3mServer } from './providers/s3m/simulator.ts';
import { seedCanonicalAiModels, CANONICAL_S3M_MODEL_ID, CANONICAL_S3M_MODEL_VERSION } from './registry.ts';
import { AiRuntime } from './runtime.ts';
import { publicTraceView } from './tracing.ts';
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
      identityId: 'id_s3m_op',
      customerId: asCustomerId('cust_s3m_op'),
      capabilities: ['VIEW_ACCOUNT'],
    }).ok,
    true,
  );
  const actor = identity.service.resolveActorContext('operator_1');
  assert.equal(actor.ok, true);
  if (!actor.ok) {
    throw new Error('actor');
  }
  return actor.value;
}

function seededRuntime(input: {
  readonly mode?: 'S3M_PRIMARY' | 'S3M_ONLY';
  readonly allowLocalTestFallback?: boolean;
  readonly s3m: S3mInferenceProvider;
  readonly secrets?: ConstructorParameters<typeof AiRuntime>[4];
}) {
  const clock = new FrozenClock(AI_RUNTIME_NOW);
  const registry = new ModelRegistry();
  assert.equal(seedCanonicalAiModels(registry, operator(), AI_RUNTIME_NOW).ok, true);
  const policy = Object.freeze({
    ...createDefaultAiRuntimePolicy(input.mode ?? 'S3M_PRIMARY'),
    ...(input.allowLocalTestFallback === undefined ? {} : { allowLocalTestFallback: input.allowLocalTestFallback }),
  });
  return new AiRuntime(
    clock,
    registry,
    policy,
    {
      S3M: input.s3m,
      LOCAL_TEST: new LocalTestAiProvider(clock),
      XAI_GROK: new XaiGrokAiProvider(clock),
    },
    input.secrets ?? null,
  );
}

describe('Chunk 102 S3M primary provider', () => {
  it('selects S3M in S3M_PRIMARY when S3M is healthy and the task is eligible', () => {
    const clock = new FrozenClock(AI_RUNTIME_NOW);
    const svc = seededRuntime({
      mode: 'S3M_PRIMARY',
      s3m: new S3mInferenceProvider({ clock, transport: new SimulatedS3mServer() }),
    });
    const result = svc.infer(
      s3mRequest({
        taskClass: 'GROWTH_PLANNING',
        dataClass: 'FINANCIAL_PRIVATE',
        prompt: 'Analyze my finances and tell me how to grow my money.',
        context: [
          {
            objectId: 'ctx_fin',
            dataClass: 'FINANCIAL_PRIVATE',
            authorizedProviders: ['S3M'],
            userApproved: true,
            payload: { note: 'class breakdown only' },
          },
        ],
      }),
    );
    if (!result.ok) {
      throw new Error(result.error.detail);
    }
    assert.equal(result.value.trace.routingDecision.primary, 'S3M');
    assert.equal(result.value.response?.providerKind, 'S3M');
    assert.equal(result.value.response?.grantsExecutionAuthority, false);
  });

  it('never routes S3M_ONLY elsewhere, even when LocalTest is healthy', () => {
    const clock = new FrozenClock(AI_RUNTIME_NOW);
    const unavailable = new S3mAiProvider(clock, false);
    const svc = seededRuntime({ mode: 'S3M_ONLY', s3m: unavailable });
    const result = svc.infer(s3mRequest({ dataClass: 'SYNTHETIC', fixture: 'structured_financial_proposal' }));
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'S3M_UNAVAILABLE_NO_EXTERNAL_FALLBACK');
      assert.equal(result.error.providerKind, 'S3M');
    }
    assert.notEqual(svc.latestTrace()?.routingDecision.primary, 'LOCAL_TEST');
    assert.notEqual(svc.latestTrace()?.routingDecision.primary, 'XAI_GROK');
  });

  it('returns provider-unavailable from S3M_PRIMARY unless policy permits another provider', () => {
    const clock = new FrozenClock(AI_RUNTIME_NOW);
    const svc = seededRuntime({
      mode: 'S3M_PRIMARY',
      allowLocalTestFallback: false,
      s3m: new S3mAiProvider(clock, false),
    });
    const result = svc.infer(s3mRequest({ dataClass: 'SYNTHETIC' }));
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'S3M_UNAVAILABLE_NO_EXTERNAL_FALLBACK');
    }
  });

  it('respects restricted context release policy and does not externalize private data', () => {
    const clock = new FrozenClock(AI_RUNTIME_NOW);
    const svc = seededRuntime({
      mode: 'S3M_PRIMARY',
      s3m: new S3mInferenceProvider({ clock, transport: new SimulatedS3mServer() }),
    });
    const denied = svc.infer(
      s3mRequest({
        dataClass: 'FINANCIAL_PRIVATE',
        userApprovedExternal: true,
        context: [
          {
            objectId: 'ctx_private',
            dataClass: 'FINANCIAL_PRIVATE',
            authorizedProviders: ['XAI_GROK'],
            userApproved: true,
            payload: { note: 'must not leave to an unauthorized provider' },
          },
        ],
      }),
    );
    assert.equal(denied.ok, false);
    if (!denied.ok) {
      assert.ok(
        denied.error.code === 'CONTEXT_RELEASE_DENIED' ||
          denied.error.code === 'S3M_UNAVAILABLE_NO_EXTERNAL_FALLBACK',
      );
      assert.notEqual(denied.error.providerKind, 'XAI_GROK');
    }
    const keys = svc.infer(s3mRequest({ dataClass: 'PRIVATE_KEY_MATERIAL' }));
    assert.equal(keys.ok, false);
    if (!keys.ok) {
      assert.equal(keys.error.code, 'NEVER_RELEASE_DATA_CLASS');
    }
  });

  it('rejects S3M output that cannot execute directly and keeps tool intents bounded', () => {
    const clock = new FrozenClock(AI_RUNTIME_NOW);
    const provider = new S3mInferenceProvider({
      clock,
      transport: new SimulatedS3mServer({ defaultFixture: 'prohibited_tool' }),
    });
    const svc = seededRuntime({ s3m: provider });
    const result = svc.infer(s3mRequest({ taskClass: 'EXCHANGE_ORDER_PREPARATION' }));
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'FORBIDDEN_TOOL_REQUESTED');
    }
    assert.equal(provider.safetyEvents().some((event) => event.kind === 'PROHIBITED_TOOL_REJECTED'), true);
    const healthy = new S3mInferenceProvider({ clock, transport: new SimulatedS3mServer() });
    const okRuntime = seededRuntime({ s3m: healthy });
    const growth = okRuntime.infer(s3mRequest({ taskClass: 'GROWTH_PLANNING' }));
    assert.equal(growth.ok, true);
    if (!growth.ok || !growth.value.response) {
      throw new Error('expected S3M growth proposal');
    }
    assert.equal(inferenceCannotExecute(growth.value.response), true);
    assert.equal(growth.value.response.toolIntents.every((intent) => intent.executes === false), true);
    assert.equal(healthy.s3mCapabilities().mayExecute, false);
    assert.equal(healthy.s3mCapabilities().streaming, false);
  });

  it('rejects malformed S3M structured output', () => {
    const clock = new FrozenClock(AI_RUNTIME_NOW);
    const provider = new S3mInferenceProvider({
      clock,
      transport: new SimulatedS3mServer({ defaultFixture: 'malformed' }),
    });
    const svc = seededRuntime({ s3m: provider });
    const result = svc.infer(s3mRequest());
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(
        result.error.code === 'INVALID_STRUCTURED_OUTPUT' || result.error.code === 'FLOATING_POINT_MONEY_FORBIDDEN',
      );
    }
    assert.equal(provider.safetyEvents().some((event) => event.kind === 'MALFORMED_OUTPUT_REJECTED'), true);
  });

  it('fails safely on S3M timeout and does not retry indefinitely', () => {
    const clock = new FrozenClock(AI_RUNTIME_NOW);
    const server = new SimulatedS3mServer({ defaultFixture: 'timeout' });
    const provider = new S3mInferenceProvider({
      clock,
      transport: server,
      config: { maxAttempts: 2, timeoutMs: 10 },
    });
    const svc = seededRuntime({ s3m: provider });
    const result = svc.infer(s3mRequest());
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'PROVIDER_TIMEOUT');
    }
    assert.equal(server.observedInferencePaths.length, 2);
    assert.equal(provider.safetyEvents().some((event) => event.kind === 'TIMEOUT'), true);
  });

  it('produces a deterministic provider-unavailable failure', () => {
    const clock = new FrozenClock(AI_RUNTIME_NOW);
    const first = seededRuntime({
      mode: 'S3M_ONLY',
      s3m: new S3mInferenceProvider({ clock, transport: new SimulatedS3mServer({ healthy: false }) }),
    }).infer(s3mRequest({ dataClass: 'SYNTHETIC' }));
    const second = seededRuntime({
      mode: 'S3M_ONLY',
      s3m: new S3mInferenceProvider({ clock, transport: new SimulatedS3mServer({ healthy: false }) }),
    }).infer(s3mRequest({ dataClass: 'SYNTHETIC' }));
    assert.equal(first.ok, false);
    assert.equal(second.ok, false);
    if (!first.ok && !second.ok) {
      assert.equal(first.error.code, second.error.code);
      assert.ok(first.error.code === 'PROVIDER_UNHEALTHY' || first.error.code === 'S3M_UNAVAILABLE_NO_EXTERNAL_FALLBACK');
    }
  });

  it('never places authentication secrets in logs, traces, or safety events', () => {
    const clock = new FrozenClock(AI_RUNTIME_NOW);
    const secret = 'sk-not-for-logs-or-traces';
    const secrets = new InMemorySecretProvider('simulation', { 's3m-credential': secret });
    const provider = new S3mInferenceProvider({
      clock,
      secrets,
      config: { credentialRef: secretRef('simulation', 's3m-credential') },
      transport: new SimulatedS3mServer(),
    });
    const svc = seededRuntime({ s3m: provider, secrets });
    const result = svc.infer(s3mRequest({ prompt: 'hello secret://simulation/s3m-credential' }));
    assert.equal(result.ok, true);
    const view = JSON.stringify(publicTraceView(svc.latestTrace()!));
    const events = JSON.stringify(provider.safetyEvents());
    const meta = JSON.stringify(provider.providerMetadata());
    assert.equal(view.includes(secret), false);
    assert.equal(events.includes(secret), false);
    assert.equal(meta.includes(secret), false);
    assert.equal(view.includes('secret://'), false);
    assert.equal(String(secrets.resolve(secretRef('simulation', 's3m-credential')).ok ? 'ok' : 'no'), 'ok');
  });

  it('sends financial proposals through packages/sunrey-agent and ProposalGate', () => {
    const clock = new FrozenClock(AI_RUNTIME_NOW);
    const svc = seededRuntime({
      s3m: new S3mInferenceProvider({ clock, transport: new SimulatedS3mServer() }),
    });
    const inferred = svc.infer(s3mRequest({ taskClass: 'GROWTH_PLANNING' }));
    assert.equal(inferred.ok, true);
    if (!inferred.ok || !inferred.value.response) {
      throw new Error('expected S3M proposal');
    }
    const engine = new UserAgentMandateEngine({
      clock,
      kernel: { submit: () => ({ status: 'BLOCK', evidenceRecordId: 'ev_s3m_block' }) },
    });
    const sandbox = createAgentSandboxScenario('s3m-test');
    const mandate = engine.createMandate({
      owner: { kind: 'USER', ownerId: 'user_s3m', walletId: 'wallet_s3m', accountId: sandbox.walletAccountId },
      agentLabel: 's3m-test',
      modelRef: `${CANONICAL_S3M_MODEL_ID}@${CANONICAL_S3M_MODEL_VERSION}`,
      policyRef: 'policy:agent-mandates-v1',
      mode: 'SIMULATION_ONLY',
      environment: 'simulation',
      permissions: {
        actionClasses: ['READ_FINANCIAL_STATE', 'PREPARE_PAYMENT', 'PREPARE_EXCHANGE_ORDER'],
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
      createdByActorId: 'user_s3m',
    });
    if (!mandate.ok) {
      throw new Error(mandate.error.detail);
    }
    const proposal = createProposalFromInference(engine, {
      mandateId: mandate.value.mandateId,
      response: inferred.value.response,
      networkId: 'net_sunrey_simulation',
    });
    if (!proposal.ok) {
      throw new Error(proposal.error.detail);
    }
    assert.equal(proposal.value.guaranteedReturn, false);
    const gate = engine.gate.toActionIntent({
      proposal: proposal.value,
      mandate: mandate.value,
      humanApproved: true,
      actorId: 'user_s3m',
    });
    assert.equal(gate.ok, false);
    if (!gate.ok) {
      assert.equal(gate.code, 'SIMULATION_CANNOT_SUBMIT');
    }
    const submitted = engine.gate.submitToKernel({
      proposal: proposal.value,
      mandate: mandate.value,
      humanApproved: true,
      actorId: 'user_s3m',
    });
    assert.equal(submitted.ok, false);
  });

  it('keeps compliance and wallet controls authoritative', () => {
    const clock = new FrozenClock(AI_RUNTIME_NOW);
    const provider = new S3mInferenceProvider({ clock, transport: new SimulatedS3mServer() });
    assert.equal(provider.s3mCapabilities().mayOverrideKernel, false);
    assert.equal(provider.s3mCapabilities().mayOverrideRisk, false);
    assert.equal(provider.s3mCapabilities().mayOverrideJurisdiction, false);
    assert.equal(provider.s3mCapabilities().mayHoldMasterKeys, false);
    assert.equal(provider.capabilities().mayIssueExecutionAuthority, false);
    const svc = seededRuntime({ s3m: provider });
    assert.equal(defaultAiPolicy('S3M_PRIMARY').s3mUnavailableFallsBackToGrok, false);
    const result = svc.infer(s3mRequest({ taskClass: 'GROWTH_PLANNING' }));
    assert.equal(result.ok, true);
    if (!result.ok || !result.value.response) {
      throw new Error('expected response');
    }
    assert.equal(result.value.response.grantsExecutionAuthority, false);
  });

  it('registers the S3M model binding without a real-world performance claim', () => {
    const registry = new ModelRegistry();
    assert.equal(seedCanonicalAiModels(registry, operator(), AI_RUNTIME_NOW).ok, true);
    const model = registry.get(CANONICAL_S3M_MODEL_ID, CANONICAL_S3M_MODEL_VERSION);
    assert.ok(model);
    assert.equal(model?.type, 'AI_MODEL_REFERENCE');
    assert.equal(model?.simulationOnly, true);
    assert.equal(model?.liveApproved, false);
    assert.equal(model?.configurationCanonical.includes('S3M'), true);
    assert.equal(model?.configurationCanonical.includes('claimsRealWorldPerformance":false'), true);
    assert.equal(model?.limitations.some((item) => item.includes('no real-world performance claim')), true);
  });

  it('reads configurable transport contract values and does not hard-code credentials', () => {
    const env = {
      S3M_BASE_URL: 's3m-local://simulator',
      S3M_MODEL_ID: 'mdl_sunrey_s3m',
      S3M_MODEL_VERSION: 's3m-sim-v1',
      S3M_TIMEOUT_MS: '2500',
      S3M_INFERENCE_PATH: 'configured-inference',
      S3M_HEALTH_PATH: 'configured-health',
      S3M_CONTEXT_WINDOW_TOKENS: '8192',
    };
    const config = resolveS3mProviderConfig({ env });
    assert.equal(config.baseUrl, 's3m-local://simulator');
    assert.equal(config.timeoutMs, 2500);
    assert.equal(config.endpoints.inferencePath, 'configured-inference');
    assert.equal(config.contextSizeTokens, 8192);
    const clock = new FrozenClock(AI_RUNTIME_NOW);
    const server = new SimulatedS3mServer();
    const provider = new S3mInferenceProvider({ clock, transport: server, config: { env } });
    const svc = seededRuntime({ s3m: provider });
    assert.equal(svc.infer(s3mRequest()).ok, true);
    assert.equal(server.observedInferencePaths.includes('configured-inference'), true);
    assert.equal(server.observedHealthPaths.includes('configured-health'), true);
    assert.equal(provider.s3mCapabilities().contextSizeTokens, 8192);
  });

  it('opens the circuit after bounded consecutive failures', () => {
    const clock = new FrozenClock(AI_RUNTIME_NOW);
    const server = new SimulatedS3mServer({ defaultFixture: 'unavailable' });
    const provider = new S3mInferenceProvider({
      clock,
      transport: server,
      config: { maxAttempts: 1, circuitFailureThreshold: 2, circuitCooldownMs: 1_000 },
    });
    const first = provider.infer({
      requestId: s3mRequest().requestId,
      taskClass: 'GENERAL_ASSISTANT',
      modelRef: { modelId: CANONICAL_S3M_MODEL_ID, version: CANONICAL_S3M_MODEL_VERSION },
      promptHash: 'abc',
      releasedContext: [],
    });
    const second = provider.infer({
      requestId: s3mRequest().requestId,
      taskClass: 'GENERAL_ASSISTANT',
      modelRef: { modelId: CANONICAL_S3M_MODEL_ID, version: CANONICAL_S3M_MODEL_VERSION },
      promptHash: 'abc',
      releasedContext: [],
    });
    assert.equal(first.ok, false);
    assert.equal(second.ok, false);
    const third = provider.infer({
      requestId: s3mRequest().requestId,
      taskClass: 'GENERAL_ASSISTANT',
      modelRef: { modelId: CANONICAL_S3M_MODEL_ID, version: CANONICAL_S3M_MODEL_VERSION },
      promptHash: 'abc',
      releasedContext: [],
    });
    assert.equal(third.ok, false);
    if (!third.ok) {
      assert.equal(third.error.code, 'PROVIDER_UNAVAILABLE');
      assert.equal(third.error.detail.includes('circuit breaker'), true);
    }
    assert.equal(provider.safetyEvents().some((event) => event.kind === 'CIRCUIT_OPEN'), true);
  });
});
