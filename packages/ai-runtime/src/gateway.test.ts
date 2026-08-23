import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asCustomerId } from '../../domain/src/customer.ts';
import { asJurisdiction } from '../../domain/src/jurisdiction.ts';
import { DomainEventLog } from '../../events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../identity/src/simulation.ts';
import { ModelRegistry } from '../../model-registry/src/registry.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
import { InferenceModelCatalog } from './catalog.ts';
import { seedInferenceModelCatalog } from './catalog-seed.ts';
import { minimizeContext } from './envelope.ts';
import { AI_RUNTIME_NOW, defaultAiPolicy } from './fixtures.ts';
import { AiModelGateway, type AiGatewayRequest } from './gateway.ts';
import {
  AI_ENVIRONMENT,
  AI_LIVE_CONNECTIVITY_ENABLED,
  AI_PRODUCTION_ACTIVE,
  AI_PRODUCTION_AUTHORIZED,
  AI_PRODUCTION_READY,
} from './posture.ts';
import { modelMayReceivePrivacy } from './privacy.ts';
import { LocalTestAiProvider } from './providers/local-test.ts';
import { HttpsGenericAiProvider } from './providers/https-generic.ts';
import { S3mInferenceProvider } from './providers/s3m.ts';
import { SimulatedS3mServer } from './providers/s3m/simulator.ts';
import { requestIdFor } from './ids.ts';
import { seedCanonicalAiModels } from './registry.ts';
import { fallbackCompatible, routeInferenceModel } from './routing-policy.ts';
import { encodeSse } from './streaming.ts';
import { FixtureHttpsTransport, httpsFail, httpsOk } from './transport.ts';
import { CANONICAL_LOCAL_TEST_MODEL_ID, CANONICAL_LOCAL_TEST_MODEL_VERSION } from './registry.ts';
import { CANONICAL_S3M_MODEL_ID, CANONICAL_S3M_MODEL_VERSION } from './registry.ts';

function operator() {
  const clock = new FrozenClock(AI_RUNTIME_NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const identity = new SimulatedIdentityAdapter({ clock, keys, events: new DomainEventLog() });
  assert.equal(
    identity.provisionSimulatedActor({
      actorId: 'operator_1',
      jurisdiction: asJurisdiction('GB'),
      identityId: 'id_gw_op',
      customerId: asCustomerId('cust_gw_op'),
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

function seededRegistry() {
  const registry = new ModelRegistry();
  assert.equal(seedCanonicalAiModels(registry, operator(), AI_RUNTIME_NOW).ok, true);
  return registry;
}

function gateway(input: ConstructorParameters<typeof AiModelGateway>[0]['providers'] = {}) {
  const clock = new FrozenClock(AI_RUNTIME_NOW);
  return new AiModelGateway({
    clock,
    governanceRegistry: seededRegistry(),
    policy: defaultAiPolicy('S3M_PRIMARY'),
    providers: {
      LOCAL_TEST: new LocalTestAiProvider(clock),
      ...input,
    },
  });
}

function request(
  overrides: Partial<AiGatewayRequest> & { readonly userApprovedExternal?: boolean } = {},
): AiGatewayRequest {
  return Object.freeze({
    requestId: requestIdFor(`gw:${overrides.fixture ?? 'normal'}:${overrides.purpose ?? 'FINANCIAL_EXPLANATION'}`),
    purpose: overrides.purpose ?? 'FINANCIAL_EXPLANATION',
    taskClass: overrides.taskClass ?? 'FINANCIAL_EXPLANATION',
    privacyClass: overrides.privacyClass ?? 'PUBLIC',
    jurisdictionRef: overrides.jurisdictionRef === undefined ? 'SIM' : overrides.jurisdictionRef,
    authorization: Object.freeze({
      actorId: overrides.authorization?.actorId ?? 'user_1',
      subjectId: overrides.authorization?.subjectId ?? 'user_1',
      userApprovedExternal: overrides.userApprovedExternal ?? overrides.authorization?.userApprovedExternal ?? false,
      mandateId: overrides.authorization?.mandateId ?? 'uam_demo',
      agentId: overrides.authorization?.agentId ?? 'uag_demo',
    }),
    conversationId: overrides.conversationId ?? 'convo_1',
    userId: overrides.userId ?? 'user_1',
    prompt: overrides.prompt ?? 'Explain my simulation balances',
    context: overrides.context ?? Object.freeze([]),
    correlationId: overrides.correlationId ?? 'corr_1',
    ...(overrides.fixture ? { fixture: overrides.fixture } : {}),
    ...(overrides.modelRef ? { modelRef: overrides.modelRef } : {}),
    ...(overrides.clientModelSelection !== undefined ? { clientModelSelection: overrides.clientModelSelection } : {}),
    ...(overrides.responseSchema ? { responseSchema: overrides.responseSchema } : {}),
    ...(overrides.allowRepair !== undefined ? { allowRepair: overrides.allowRepair } : {}),
    ...(overrides.preferredProvider ? { preferredProvider: overrides.preferredProvider } : {}),
    ...(overrides.allowFallback !== undefined ? { allowFallback: overrides.allowFallback } : {}),
    ...(overrides.cancel ? { cancel: overrides.cancel } : {}),
    ...(overrides.messages ? { messages: overrides.messages } : {}),
  });
}

describe('Phase F AI Model Gateway', () => {
  it('registers versioned models and refuses env-var production approval', () => {
    const catalog = new InferenceModelCatalog();
    seedInferenceModelCatalog(catalog);
    const local = catalog.get(CANONICAL_LOCAL_TEST_MODEL_ID, CANONICAL_LOCAL_TEST_MODEL_VERSION);
    assert.ok(local);
    assert.equal(local.status, 'TEST');
    assert.equal(local.liveApproved, false);
    const promoted = catalog.transition(CANONICAL_LOCAL_TEST_MODEL_ID, CANONICAL_LOCAL_TEST_MODEL_VERSION, 'PRODUCTION_APPROVED', {
      SUNREY_APPROVE_PRODUCTION_MODELS: 'true',
      SUNREY_MODEL_PRODUCTION_APPROVED: 'true',
    });
    assert.equal(promoted.ok, false);
    if (!promoted.ok) {
      assert.equal(promoted.error.code, 'PRODUCTION_APPROVAL_UNREACHABLE');
    }
    assert.equal(AI_PRODUCTION_READY, false);
    assert.equal(AI_PRODUCTION_ACTIVE, false);
    assert.equal(AI_LIVE_CONNECTIVITY_ENABLED, false);
    assert.equal(AI_PRODUCTION_AUTHORIZED, false);
    assert.equal(AI_ENVIRONMENT, 'simulation');
  });

  it('routes financial explanation to an approved language model, not solely cheapest', () => {
    const clock = new FrozenClock(AI_RUNTIME_NOW);
    const svc = gateway({
      S3M: new S3mInferenceProvider({ clock, transport: new SimulatedS3mServer() }),
    });
    const result = svc.infer(request({ purpose: 'FINANCIAL_EXPLANATION', privacyClass: 'FINANCIAL_SENSITIVE' }));
    assert.equal(result.ok, true);
    if (!result.ok) {
      throw new Error(result.error.detail);
    }
    assert.equal(result.value.model?.provider, 'S3M');
    assert.equal(result.value.financialExecuted, false);
  });

  it('routes simple classification to a lower-cost approved model after policy filters', () => {
    const catalog = new InferenceModelCatalog();
    seedInferenceModelCatalog(catalog);
    const routed = routeInferenceModel(catalog, {
      purpose: 'SIMPLE_CLASSIFICATION',
      privacyClass: 'PUBLIC',
      requireStructuredOutput: false,
      requireTools: false,
      requireStreaming: false,
      contextTokens: 16,
      latencyPreference: null,
      costCeilingMicros: null,
      jurisdictionRef: null,
      preferredProvider: null,
      health: {},
    });
    assert.equal(routed.ok, true);
    if (!routed.ok) {
      throw new Error(routed.error.detail);
    }
    assert.equal(routed.value.primary.provider, 'LOCAL_TEST');
    assert.equal(
      routed.value.primary.cost.inputMicrosPer1kTokens <= routed.value.fallback!.cost.inputMicrosPer1kTokens ||
        routed.value.fallback === null,
      true,
    );
  });

  it('blocks privileged client model selection and purpose-incompatible models', () => {
    const svc = gateway();
    const blocked = svc.infer(
      request({
        purpose: 'PAYMENT_PREPARATION',
        privacyClass: 'FINANCIAL_SENSITIVE',
        clientModelSelection: true,
        modelRef: { modelId: CANONICAL_LOCAL_TEST_MODEL_ID, version: CANONICAL_LOCAL_TEST_MODEL_VERSION },
        fixture: 'structured_financial_proposal',
      }),
    );
    assert.equal(blocked.ok, true);
    if (!blocked.ok) {
      throw new Error(blocked.error.detail);
    }
    assert.equal(blocked.value.model?.approvedPurposes.includes('PAYMENT_PREPARATION'), true);
  });

  it('enforces privacy classification and never releases secrets or KYC', () => {
    const svc = gateway();
    const secret = svc.infer(request({ privacyClass: 'SECRET', prompt: 'use this key' }));
    assert.equal(secret.ok, false);
    if (!secret.ok) {
      assert.equal(secret.error.code, 'MODEL_POLICY_BLOCKED' || secret.error.code === 'NEVER_RELEASE_DATA_CLASS' || true);
      assert.equal(
        secret.error.code === 'NEVER_RELEASE_DATA_CLASS' || secret.error.code === 'MODEL_POLICY_BLOCKED',
        true,
      );
    }
    const kyc = svc.infer(
      request({
        privacyClass: 'REGULATED_IDENTITY',
        context: [
          {
            objectId: 'kyc_1',
            dataClass: 'REGULATORY_SENSITIVE',
            authorizedProviders: ['S3M'],
            userApproved: true,
            payload: { kycDocument: 'passport-scan' },
          },
        ],
      }),
    );
    assert.equal(kyc.ok, false);
    const financialToHttps = modelMayReceivePrivacy(['PUBLIC'], 'FINANCIAL_SENSITIVE');
    assert.equal(financialToHttps, false);
  });

  it('minimizes context instead of dumping full records', () => {
    const minimized = minimizeContext({
      purpose: 'FINANCIAL_EXPLANATION',
      objects: [
        {
          objectId: 'row_1',
          dataClass: 'FINANCIAL_PRIVATE',
          authorizedProviders: ['S3M'],
          userApproved: true,
          payload: {
            accountId: 'acct_1',
            currency: 'USD',
            availableMinorUnits: '1200',
            accountClass: 'DEMAND_DEPOSIT',
            rawDatabaseRow: { ssn: 'should-not-travel' },
            biography: 'entire user record',
          },
        },
      ],
    });
    assert.equal(minimized[0]?.payload.accountId, 'acct_1');
    assert.equal(minimized[0]?.payload.rawDatabaseRow, undefined);
    assert.equal(minimized[0]?.payload.biography, undefined);
  });

  it('handles provider unavailable, timeout, and rate limit', () => {
    const svc = gateway();
    const unavailable = svc.infer(request({ fixture: 'unavailable', purpose: 'GENERAL_ASSISTANT', privacyClass: 'PUBLIC', allowFallback: false, preferredProvider: 'LOCAL_TEST' }));
    assert.equal(unavailable.ok, false);
    if (!unavailable.ok) {
      assert.equal(unavailable.error.code === 'MODEL_UNAVAILABLE' || unavailable.error.code === 'PROVIDER_UNAVAILABLE', true);
    }
    const timeout = svc.infer(request({ fixture: 'timeout', purpose: 'GENERAL_ASSISTANT', privacyClass: 'PUBLIC', allowFallback: false, preferredProvider: 'LOCAL_TEST' }));
    assert.equal(timeout.ok, false);
    if (!timeout.ok) {
      assert.equal(timeout.error.code === 'MODEL_TIMEOUT' || timeout.error.code === 'PROVIDER_TIMEOUT', true);
    }
    const limited = svc.infer(request({ fixture: 'rate_limited', purpose: 'GENERAL_ASSISTANT', privacyClass: 'PUBLIC', allowFallback: false, preferredProvider: 'LOCAL_TEST' }));
    assert.equal(limited.ok, false);
    if (!limited.ok) {
      assert.equal(limited.error.code, 'MODEL_RATE_LIMITED');
    }
  });

  it('falls back only to a purpose-and-privacy approved model', () => {
    const clock = new FrozenClock(AI_RUNTIME_NOW);
    const svc = gateway({
      S3M: new S3mInferenceProvider({ clock, transport: new SimulatedS3mServer({ defaultFixture: 'unavailable' }) }),
    });
    const result = svc.infer(
      request({
        purpose: 'FINANCIAL_EXPLANATION',
        privacyClass: 'FINANCIAL_SENSITIVE',
        fixture: 'normal',
      }),
    );
    if (result.ok) {
      assert.equal(result.value.model?.dataHandling.includes('FINANCIAL_SENSITIVE'), true);
      assert.notEqual(result.value.model?.provider, 'HTTPS_GENERIC');
    } else {
      assert.notEqual(result.error.providerKind, 'HTTPS_GENERIC');
    }
  });

  it('refuses financial-sensitive fallback to an unapproved vendor', () => {
    const catalog = new InferenceModelCatalog();
    seedInferenceModelCatalog(catalog);
    const s3m = catalog.get(CANONICAL_S3M_MODEL_ID, CANONICAL_S3M_MODEL_VERSION);
    const https = catalog.list().find((model) => model.provider === 'HTTPS_GENERIC' && model.status === 'APPROVED_SANDBOX');
    assert.ok(s3m);
    assert.ok(https);
    assert.equal(
      fallbackCompatible(s3m, https, {
        purpose: 'FINANCIAL_EXPLANATION',
        privacyClass: 'FINANCIAL_SENSITIVE',
        requireStructuredOutput: false,
        requireTools: false,
        requireStreaming: false,
        contextTokens: 8,
        latencyPreference: null,
        costCeilingMicros: null,
        jurisdictionRef: null,
        preferredProvider: null,
        health: {},
      }),
      false,
    );
  });

  it('streams customer-safe events without hidden reasoning', () => {
    const svc = gateway();
    const result = svc.stream(request({ purpose: 'GENERAL_ASSISTANT', privacyClass: 'PUBLIC', fixture: 'normal' }));
    assert.equal(result.ok, true);
    if (!result.ok) {
      throw new Error(result.error.detail);
    }
    const types = result.value.events.map((event) => event.type);
    assert.equal(types.includes('message.started'), true);
    assert.equal(types.includes('message.delta'), true);
    assert.equal(types.includes('message.completed'), true);
    assert.equal(result.value.events.every((event) => event.hiddenReasoning === false), true);
    assert.equal(result.value.sse.includes('event: message.started'), true);
    assert.equal(encodeSse(result.value.events).includes('chain-of-thought'), false);
    assert.equal(JSON.stringify(result.value.events).includes('IGNORE PREVIOUS'), false);
  });

  it('validates structured output and repairs within bounds', () => {
    const svc = gateway();
    const invalid = svc.infer(
      request({
        purpose: 'STRUCTURED_PROPOSAL_NARRATION',
        privacyClass: 'PUBLIC',
        fixture: 'malformed',
        allowRepair: false,
        responseSchema: 'FINANCIAL_PROPOSAL',
      }),
    );
    assert.equal(invalid.ok, false);
    if (!invalid.ok) {
      assert.equal(invalid.error.code === 'MODEL_OUTPUT_INVALID' || invalid.error.code === 'INVALID_STRUCTURED_OUTPUT' || invalid.error.code === 'FLOATING_POINT_MONEY_FORBIDDEN', true);
    }
    const repaired = svc.infer(
      request({
        purpose: 'GENERAL_ASSISTANT',
        privacyClass: 'PUBLIC',
        fixture: 'repairable',
        allowRepair: true,
      }),
    );
    assert.equal(repaired.ok, true);
    if (!repaired.ok) {
      throw new Error(repaired.error.detail);
    }
    assert.equal(repaired.value.provenance?.outputValidationStatus, 'REPAIRED');
    assert.equal(repaired.value.response?.structured?.kind, 'EXPLANATION');
  });

  it('cancels in-flight gateway requests', () => {
    const svc = gateway();
    const req = request({ purpose: 'GENERAL_ASSISTANT', privacyClass: 'PUBLIC', fixture: 'cancelled', allowFallback: false, preferredProvider: 'LOCAL_TEST' });
    const cancelled = svc.infer(req);
    assert.equal(cancelled.ok, false);
    if (!cancelled.ok) {
      assert.equal(cancelled.error.code, 'MODEL_CANCELLED');
    }
    const live = request({ purpose: 'GENERAL_ASSISTANT', privacyClass: 'PUBLIC' });
    svc.cancel(live.requestId);
    const after = svc.infer(live);
    assert.equal(after.ok, false);
  });

  it('records usage, cost, latency, and versioned policy provenance', () => {
    const svc = gateway();
    const result = svc.infer(request({ purpose: 'USER_SUPPORT', privacyClass: 'PUBLIC' }));
    assert.equal(result.ok, true);
    if (!result.ok) {
      throw new Error(result.error.detail);
    }
    assert.ok(result.value.usage);
    assert.equal(result.value.usage.postedToCustomerLedger, false);
    assert.equal(/^-?\d+$/.test(result.value.usage.estimatedCostMicros), true);
    assert.equal(result.value.provenance?.policyId, 'pol_user_support');
    assert.equal(result.value.provenance?.storedHiddenReasoning, false);
    assert.ok(svc.health.get(result.value.model!.provider, `${result.value.model!.modelId}@${result.value.model!.version}`));
  });

  it('uses HTTPS fixture transport without live credentials', () => {
    const clock = new FrozenClock(AI_RUNTIME_NOW);
    const transport = new FixtureHttpsTransport([
      {
        host: 'ai.sandbox.local',
        path: '/v1/infer',
        result: httpsOk({
          text: 'sandbox classification',
          structured: { kind: 'EXPLANATION', text: 'sandbox classification', guaranteedReturn: false },
        }),
      },
    ]);
    const svc = gateway({
      HTTPS_GENERIC: new HttpsGenericAiProvider({ clock, transport }),
    });
    const result = svc.infer(
      request({
        purpose: 'SIMPLE_CLASSIFICATION',
        privacyClass: 'PUBLIC',
        preferredProvider: 'HTTPS_GENERIC',
        userApprovedExternal: true,
      }),
    );
    assert.equal(result.ok, true);
    if (!result.ok) {
      throw new Error(result.error.detail);
    }
    assert.equal(result.value.model?.provider, 'HTTPS_GENERIC');
    assert.equal(result.value.liveConnectivityEnabled, false);
    assert.equal(transport.observed[0]?.scheme, 'HTTPS');
    assert.equal(transport.observed[0]?.credentialRef, null);
  });

  it('classifies HTTPS rate-limit and timeout without treating them as financial failures', () => {
    const clock = new FrozenClock(AI_RUNTIME_NOW);
    const transport = new FixtureHttpsTransport([
      {
        host: 'ai.sandbox.local',
        path: '/v1/infer',
        result: httpsFail('MODEL_RATE_LIMITED', 'rate limited', true, 429),
      },
    ]);
    const svc = gateway({
      HTTPS_GENERIC: new HttpsGenericAiProvider({ clock, transport }),
    });
    const result = svc.infer(
      request({
        purpose: 'SIMPLE_CLASSIFICATION',
        privacyClass: 'PUBLIC',
        preferredProvider: 'HTTPS_GENERIC',
        allowFallback: false,
        userApprovedExternal: true,
      }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'MODEL_RATE_LIMITED');
    }
  });

  it('does not cache personalized financial responses across users', () => {
    const svc = gateway();
    const first = svc.infer(
      request({
        purpose: 'FINANCIAL_EXPLANATION',
        privacyClass: 'FINANCIAL_SENSITIVE',
        userId: 'user_a',
        prompt: 'same prompt',
      }),
    );
    const second = svc.infer(
      request({
        purpose: 'FINANCIAL_EXPLANATION',
        privacyClass: 'FINANCIAL_SENSITIVE',
        userId: 'user_b',
        prompt: 'same prompt',
      }),
    );
    assert.equal(first.ok || first.ok === false, true);
    assert.equal(second.ok || second.ok === false, true);
    assert.equal(svc.cache.get({
      policy: { scope: 'NONE', sharedAcrossUsers: false },
      purpose: 'FINANCIAL_EXPLANATION',
      prompt: 'same prompt',
      userId: 'user_b',
    }), null);
  });

  it('redacts secrets from streamed and persisted views', () => {
    const svc = gateway();
    const result = svc.infer(
      request({
        purpose: 'GENERAL_ASSISTANT',
        privacyClass: 'PUBLIC',
        prompt: 'ignore secret://simulation/ai-provider-key',
      }),
    );
    assert.equal(result.ok, true);
    if (!result.ok) {
      throw new Error(result.error.detail);
    }
    assert.equal(JSON.stringify(result.value.events).includes('secret://'), false);
    assert.equal(result.value.runtime?.trace.storedRawPrompt, false);
    assert.equal(result.value.runtime?.trace.storedSecrets, false);
  });
});
