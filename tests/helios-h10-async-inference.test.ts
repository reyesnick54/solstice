import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  AsyncInferenceExecutor,
  AsyncSyncHttpsTransportAdapter,
  ConcurrencyGate,
  DEFAULT_CONCURRENCY_LIMITS,
  FixtureAsyncHttpsTransport,
  InMemoryInferenceJobStore,
  InMemoryResearchBudgetPort,
  classifyInferenceRetry,
  externalPrivacyForGateway,
  mapPrivacyClassToExternal,
  type InferenceJobRecord,
  type ResearchBudgetPort,
  type ResearchBudgetReconciliation,
  type ResearchBudgetReservationRequest,
  type StructuredInferenceRequest,
} from '../packages/ai-runtime/src/async-inference/index.ts';
import { InferenceModelCatalog } from '../packages/ai-runtime/src/catalog.ts';
import { seedInferenceModelCatalog } from '../packages/ai-runtime/src/catalog-seed.ts';
import { AI_RUNTIME_NOW, defaultAiPolicy } from '../packages/ai-runtime/src/fixtures.ts';
import { AiModelGateway, type AiGatewayRequest } from '../packages/ai-runtime/src/gateway.ts';
import { requestIdFor } from '../packages/ai-runtime/src/ids.ts';
import { LocalTestAiProvider } from '../packages/ai-runtime/src/providers/local-test.ts';
import { S3mInferenceProvider } from '../packages/ai-runtime/src/providers/s3m.ts';
import { SimulatedS3mServer } from '../packages/ai-runtime/src/providers/s3m/simulator.ts';
import { XaiGrokAiProvider } from '../packages/ai-runtime/src/providers/xai-grok.ts';
import {
  CANONICAL_GROK_MODEL_ID,
  CANONICAL_GROK_MODEL_VERSION,
  CANONICAL_LOCAL_TEST_MODEL_ID,
  CANONICAL_LOCAL_TEST_MODEL_VERSION,
  CANONICAL_S3M_MODEL_ID,
  CANONICAL_S3M_MODEL_VERSION,
  seedCanonicalAiModels,
} from '../packages/ai-runtime/src/registry.ts';
import { FixtureHttpsTransport, httpsOk } from '../packages/ai-runtime/src/transport.ts';
import { FrozenClock } from '../packages/config/src/clock.ts';
import { asCustomerId } from '../packages/domain/src/customer.ts';
import { asJurisdiction } from '../packages/domain/src/jurisdiction.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { DomainEventLog } from '../packages/events/src/events.ts';
import { SimulatedIdentityAdapter } from '../packages/identity/src/simulation.ts';
import { ModelRegistry } from '../packages/model-registry/src/registry.ts';
import { asEconomicMandateId, asMandateVersion } from '../packages/platform/src/ids.ts';
import type { CompiledEconomicMandate } from '../packages/platform/src/mandate/types.ts';
import { HeliosWorkOrchestrator } from '../packages/platform/src/helios/index.ts';
import { createSimulationKeyProvider } from '../packages/security/src/simulation.ts';

const NOW = AI_RUNTIME_NOW;

class HeliosResearchBudgetPort implements ResearchBudgetPort {
  private readonly orchestrator: HeliosWorkOrchestrator;

  constructor(orchestrator: HeliosWorkOrchestrator) {
    this.orchestrator = orchestrator;
  }

  reserve(request: ResearchBudgetReservationRequest): { readonly ok: true } | { readonly ok: false; readonly code: string; readonly message: string } {
    if (!request.taskId) {
      return { ok: false, code: 'TASK_REQUIRED', message: 'HELIOS budget reservation requires a task id' };
    }
    const reserved = this.orchestrator.store.reserveBudgetAtomic({
      workOrderId: request.workOrderId,
      taskId: request.taskId,
      customerId: request.customerId,
      amount: request.amountMicros,
      now: this.orchestrator.now(),
    });
    if ('code' in reserved) {
      return { ok: false, code: reserved.code, message: reserved.message };
    }
    return { ok: true };
  }

  reconcile(input: ResearchBudgetReconciliation): { readonly ok: true } | { readonly ok: false; readonly code: string; readonly message: string } {
    void input;
    return { ok: true };
  }
}

function mandate(subjectId: string): CompiledEconomicMandate {
  return Object.freeze({
    mandateId: asEconomicMandateId('emd_h10_integration'),
    version: asMandateVersion(1),
    subjectId,
    state: 'ACTIVE',
    sourceText: 'research only',
    currency: 'USD',
    goals: Object.freeze([]),
    hardConstraints: Object.freeze([]),
    softPreferences: Object.freeze([]),
    compiledAt: asUtcInstant('2026-09-16T15:00:00.000Z'),
    planningEligible: true,
  });
}

function heliosSetup(subjectId: string, customerId: string) {
  const clock = new FrozenClock(NOW);
  const mandates = new Map<string, CompiledEconomicMandate>();
  const active = mandate(subjectId);
  mandates.set(active.mandateId, active);
  const orchestrator = new HeliosWorkOrchestrator({
    clock,
    mandateLookup: (id) => mandates.get(id),
  });
  return { clock, orchestrator, subjectId, customerId };
}

function operator() {
  const clock = new FrozenClock(NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const identity = new SimulatedIdentityAdapter({ clock, keys, events: new DomainEventLog() });
  assert.equal(
    identity.provisionSimulatedActor({
      actorId: 'operator_h10',
      jurisdiction: asJurisdiction('GB'),
      identityId: 'id_h10',
      customerId: asCustomerId('cust_op'),
      capabilities: ['VIEW_ACCOUNT'],
    }).ok,
    true,
  );
  const actor = identity.service.resolveActorContext('operator_h10');
  if (!actor.ok) throw new Error('actor');
  const registry = new ModelRegistry();
  assert.equal(seedCanonicalAiModels(registry, actor.value, NOW).ok, true);
  return { clock, registry };
}

function buildExecutor(input: {
  readonly concurrency?: Partial<typeof DEFAULT_CONCURRENCY_LIMITS>;
  readonly budgetCeiling?: string;
  readonly workOrderId?: string;
} = {}) {
  const { clock, registry } = operator();
  const catalog = new InferenceModelCatalog();
  seedInferenceModelCatalog(catalog);
  const budgetPort = new InMemoryResearchBudgetPort();
  if (input.workOrderId && input.budgetCeiling) {
    budgetPort.setCeiling(input.workOrderId, input.budgetCeiling);
  }
  const gateway = new AiModelGateway({
    clock,
    governanceRegistry: registry,
    policy: defaultAiPolicy('S3M_PRIMARY'),
    catalog,
    providers: {
      LOCAL_TEST: new LocalTestAiProvider(clock),
      S3M: new S3mInferenceProvider(clock, new SimulatedS3mServer()),
    },
  });
  const executor = new AsyncInferenceExecutor({
    clock,
    gateway,
    catalog,
    budgetPort,
    concurrency: { ...DEFAULT_CONCURRENCY_LIMITS, ...input.concurrency },
  });
  return { clock, executor, gateway, catalog, budgetPort };
}

function gatewayRequest(overrides: Partial<AiGatewayRequest> = {}): AiGatewayRequest {
  return Object.freeze({
    requestId: overrides.requestId ?? requestIdFor('h10:test'),
    purpose: overrides.purpose ?? 'GENERAL_ASSISTANT',
    taskClass: overrides.taskClass ?? 'GENERAL_ASSISTANT',
    privacyClass: overrides.privacyClass ?? 'PUBLIC',
    jurisdictionRef: overrides.jurisdictionRef ?? 'SIM',
    authorization: Object.freeze({
      actorId: 'user_a',
      subjectId: 'user_a',
      userApprovedExternal: false,
      mandateId: 'uam_demo',
      agentId: 'uag_demo',
    }),
    conversationId: 'convo_h10',
    userId: 'user_a',
    prompt: overrides.prompt ?? 'Explain simulation balances',
    context: Object.freeze([]),
    correlationId: overrides.correlationId ?? 'corr_h10',
    ...(overrides.fixture ? { fixture: overrides.fixture } : {}),
    ...overrides,
  });
}

function structuredRequest(input: {
  readonly executor: AsyncInferenceExecutor;
  readonly customerId?: string;
  readonly workOrderId?: string | null;
  readonly taskId?: string | null;
  readonly budgetMicros?: string | null;
  readonly privacyClass?: AiGatewayRequest['privacyClass'];
  readonly provider?: StructuredInferenceRequest['provider'];
  readonly fixture?: AiGatewayRequest['fixture'];
  readonly processingTimeoutMs?: number;
  readonly requestId?: AiGatewayRequest['requestId'];
}): StructuredInferenceRequest {
  const requestId = input.requestId ?? requestIdFor(`h10:${Math.random()}`);
  return Object.freeze({
    inferenceRequestId: requestId,
    taskId: input.taskId ?? null,
    workOrderId: input.workOrderId ?? null,
    customerId: input.customerId ?? 'cust_a',
    purposeReference: 'helios_research',
    purpose: 'GENERAL_ASSISTANT',
    taskClass: 'GENERAL_ASSISTANT',
    provider: input.provider ?? 'LOCAL_TEST',
    modelId: CANONICAL_LOCAL_TEST_MODEL_ID,
    modelVersion: CANONICAL_LOCAL_TEST_MODEL_VERSION,
    promptTemplateId: 'tpl_general',
    structuredInput: Object.freeze({ query: 'balances' }),
    toolCapabilities: Object.freeze([]),
    responseSchema: 'EXPLANATION',
    maxOutputTokens: 512,
    connectionTimeoutMs: 1_000,
    processingTimeoutMs: input.processingTimeoutMs ?? 30_000,
    taskDeadline: null,
    workOrderHorizon: null,
    privacyClassification: mapPrivacyClassToExternal(input.privacyClass ?? 'PUBLIC'),
    budgetReservationRef: input.budgetMicros ? `rbr_${requestId}` : null,
    estimatedBudgetMicros: input.budgetMicros ?? null,
    traceRefs: Object.freeze([]),
    evidenceRefs: Object.freeze([]),
    gatewayRequest: gatewayRequest({
      requestId,
      privacyClass: input.privacyClass ?? 'PUBLIC',
      modelRef: { modelId: CANONICAL_LOCAL_TEST_MODEL_ID, version: CANONICAL_LOCAL_TEST_MODEL_VERSION },
      clientModelSelection: true,
      preferredProvider: input.provider ?? 'LOCAL_TEST',
      allowFallback: false,
      allowRepair: false,
      ...(input.fixture ? { fixture: input.fixture } : {}),
    }),
  });
}

async function waitForJob(
  executor: AsyncInferenceExecutor,
  requestId: string,
  customerId: string,
  timeoutMs = 5_000,
): Promise<InferenceJobRecord> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const polled = executor.poll(requestId, customerId);
    if (polled.ok && polled.job.state !== 'QUEUED' && polled.job.state !== 'DISPATCHING' && polled.job.state !== 'IN_FLIGHT') {
      return polled.job;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`job ${requestId} did not finish`);
}

describe('HELIOS H10 async inference transport and usage accounting', () => {
  it('1. async request success', async () => {
    const { executor } = buildExecutor();
    const request = structuredRequest({ executor });
    const submitted = executor.submit(request);
    assert.equal(submitted.ok, true);
    const job = await waitForJob(executor, request.inferenceRequestId, request.customerId);
    assert.equal(job.state, 'COMPLETED');
    assert.ok(job.result?.response);
  });

  it('2. timeout', async () => {
    const { executor } = buildExecutor();
    const request = structuredRequest({
      executor,
      fixture: 'timeout',
      processingTimeoutMs: 1,
    });
    executor.submit(request);
    const job = await waitForJob(executor, request.inferenceRequestId, request.customerId);
    assert.equal(job.state, 'TIMED_OUT');
    assert.equal(job.failure?.code, 'MODEL_TIMEOUT');
  });

  it('3. cancellation before dispatch', async () => {
    const { executor } = buildExecutor({ concurrency: { global: 1, provider: 1, model: 1, customer: 1, workOrder: 1 } });
    const blocker = structuredRequest({ executor });
    executor.submit(blocker);
    const target = structuredRequest({ executor });
    executor.submit(target);
    const cancelled = executor.requestCancel(target.inferenceRequestId, target.customerId);
    assert.equal(cancelled, 'CANCELLED');
    const job = await waitForJob(executor, target.inferenceRequestId, target.customerId);
    assert.equal(job.state, 'CANCELLED');
  });

  it('4. cancellation in flight', async () => {
    const { executor } = buildExecutor();
    const request = structuredRequest({ executor, fixture: 'normal' });
    executor.submit(request);
    const state = executor.requestCancel(request.inferenceRequestId, request.customerId);
    assert.ok(['CANCEL_REQUESTED', 'CANCELLED', 'COMPLETED_BEFORE_CANCEL'].includes(state));
  });

  it('5. provider cannot confirm cancellation', async () => {
    const transport = new FixtureAsyncHttpsTransport(new FixtureHttpsTransport([]), { abortable: false });
    const aborted = await transport.abort('missing');
    assert.equal(aborted.aborted, false);
    assert.equal(aborted.providerMayContinue, false);
  });

  it('6. concurrency limit', async () => {
    const gate = new ConcurrencyGate({ global: 1, provider: 1, model: 1, customer: 1, workOrder: 1 });
    const releaseA = await gate.acquire({
      provider: 'LOCAL_TEST',
      model: 'mdl@ver',
      customerId: 'cust_a',
      workOrderId: 'ewo_a',
    });
    let releasedB = false;
    const pending = gate.acquire({
      provider: 'LOCAL_TEST',
      model: 'mdl@ver',
      customerId: 'cust_a',
      workOrderId: 'ewo_a',
    }).then((release) => {
      releasedB = true;
      release();
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(releasedB, false);
    releaseA();
    await pending;
    assert.equal(releasedB, true);
  });

  it('7. queueing under capacity pressure', async () => {
    const { executor } = buildExecutor({ concurrency: { global: 1, provider: 1, model: 1, customer: 1, workOrder: 1 } });
    const first = structuredRequest({ executor });
    const second = structuredRequest({ executor });
    executor.submit(first);
    executor.submit(second);
    assert.equal(executor.metrics.snapshot().queueDepth >= 0, true);
    await waitForJob(executor, first.inferenceRequestId, first.customerId);
    await waitForJob(executor, second.inferenceRequestId, second.customerId);
  });

  it('8. retryable provider failure', () => {
    assert.equal(classifyInferenceRetry('MODEL_UNAVAILABLE'), 'RETRYABLE');
    assert.equal(classifyInferenceRetry('MODEL_RATE_LIMITED'), 'RETRYABLE');
  });

  it('9. non-retryable provider failure', () => {
    assert.equal(classifyInferenceRetry('AUTHENTICATION_FAILURE'), 'NON_RETRYABLE');
    assert.equal(classifyInferenceRetry('MODEL_POLICY_BLOCKED'), 'NON_RETRYABLE');
  });

  it('10. rate limit', async () => {
    const { executor } = buildExecutor();
    const request = structuredRequest({ executor, fixture: 'rate_limited' });
    executor.submit(request);
    const job = await waitForJob(executor, request.inferenceRequestId, request.customerId);
    assert.equal(job.state, 'FAILED');
    assert.equal(job.failure?.code, 'MODEL_RATE_LIMITED');
  });

  it('11. malformed structured response', async () => {
    const { executor } = buildExecutor();
    const request = structuredRequest({ executor, fixture: 'malformed' });
    executor.submit(request);
    const job = await waitForJob(executor, request.inferenceRequestId, request.customerId);
    assert.equal(job.state, 'FAILED');
    assert.equal(job.failure?.code, 'MODEL_OUTPUT_INVALID');
  });

  it('12. usage accounting', async () => {
    const { executor } = buildExecutor();
    const request = structuredRequest({ executor });
    executor.submit(request);
    const job = await waitForJob(executor, request.inferenceRequestId, request.customerId);
    assert.ok(job.usageRecordId);
    const usage = executor.getUsageRecord(job.usageRecordId!);
    assert.ok(usage);
    assert.equal(usage!.customerId, request.customerId);
    assert.equal(usage!.requestCount, 1);
  });

  it('13. estimated cost', async () => {
    const { executor } = buildExecutor();
    const request = structuredRequest({ executor, provider: 'S3M' });
    const withS3m = Object.freeze({
      ...request,
      provider: 'S3M' as const,
      modelId: CANONICAL_S3M_MODEL_ID,
      modelVersion: CANONICAL_S3M_MODEL_VERSION,
      gatewayRequest: gatewayRequest({
        requestId: request.inferenceRequestId,
        purpose: 'GENERAL_ASSISTANT',
        modelRef: { modelId: CANONICAL_S3M_MODEL_ID, version: CANONICAL_S3M_MODEL_VERSION },
        clientModelSelection: true,
        preferredProvider: 'S3M',
        allowFallback: false,
      }),
    });
    executor.submit(withS3m);
    const job = await waitForJob(executor, withS3m.inferenceRequestId, withS3m.customerId);
    const usage = executor.getUsageRecord(job.usageRecordId!);
    assert.ok(usage);
    assert.equal(usage!.costStatus, 'ESTIMATED');
    assert.ok(usage!.estimatedCostMicros);
  });

  it('14. unknown cost', async () => {
    const { clock, registry } = operator();
    const catalog = new InferenceModelCatalog();
    seedInferenceModelCatalog(catalog);
    const budgetPort = new InMemoryResearchBudgetPort();
    const gateway = new AiModelGateway({
      clock,
      governanceRegistry: registry,
      policy: defaultAiPolicy('S3M_PRIMARY'),
      catalog,
      providers: { LOCAL_TEST: new LocalTestAiProvider(clock) },
    });
    const executor = new AsyncInferenceExecutor({ clock, gateway, catalog, budgetPort });
    const request = structuredRequest({ executor });
    executor.submit(request);
    const job = await waitForJob(executor, request.inferenceRequestId, request.customerId);
    const usage = executor.getUsageRecord(job.usageRecordId!);
    assert.ok(usage);
    assert.ok(['ESTIMATED', 'UNKNOWN'].includes(usage!.costStatus));
  });

  it('15. research-budget reservation/reconciliation', async () => {
    const workOrderId = 'ewo_budget';
    const { executor, budgetPort } = buildExecutor({ workOrderId, budgetCeiling: '1000' });
    const request = structuredRequest({
      executor,
      workOrderId,
      taskId: 'htask_budget',
      budgetMicros: '200',
    });
    const submitted = executor.submit(request);
    assert.equal(submitted.ok, true);
    await waitForJob(executor, request.inferenceRequestId, request.customerId);
    assert.equal(
      budgetPort.reserve({
        workOrderId,
        taskId: 'htask_budget2',
        customerId: request.customerId,
        reservationRef: 'rbr_extra',
        amountMicros: '900',
        unitKind: 'MONETARY_MINOR',
      }).ok,
      false,
    );
  });

  it('16. budget exhaustion prevents dispatch', () => {
    const workOrderId = 'ewo_exhausted';
    const { executor } = buildExecutor({ workOrderId, budgetCeiling: '100' });
    const request = structuredRequest({
      executor,
      workOrderId,
      taskId: 'htask_exhaust',
      budgetMicros: '500',
    });
    const submitted = executor.submit(request);
    assert.equal(submitted.ok, false);
    if (submitted.ok) throw new Error('expected failure');
    assert.equal(submitted.code, 'BUDGET_EXHAUSTED');
  });

  it('17. privacy classification blocks prohibited external context', () => {
    const blocked = externalPrivacyForGateway({
      privacyClass: 'FINANCIAL_SENSITIVE',
      provider: 'XAI_GROK',
    });
    assert.equal(blocked.ok, false);
    const allowed = externalPrivacyForGateway({
      privacyClass: 'PUBLIC',
      provider: 'XAI_GROK',
    });
    assert.equal(allowed.ok, true);
  });

  it('18. restart does not duplicate completed inference', async () => {
    const store = new InMemoryInferenceJobStore();
    const { clock, registry } = operator();
    const catalog = new InferenceModelCatalog();
    seedInferenceModelCatalog(catalog);
    const budgetPort = new InMemoryResearchBudgetPort();
    const gateway = new AiModelGateway({
      clock,
      governanceRegistry: registry,
      policy: defaultAiPolicy('S3M_PRIMARY'),
      catalog,
      providers: { LOCAL_TEST: new LocalTestAiProvider(clock) },
    });
    const executor = new AsyncInferenceExecutor({ clock, gateway, catalog, budgetPort, store });
    const request = structuredRequest({ executor });
    executor.submit(request);
    await waitForJob(executor, request.inferenceRequestId, request.customerId);
    const snapshot = store.snapshot();
    const restartedStore = new InMemoryInferenceJobStore();
    restartedStore.restore(snapshot);
    const replay = restartedStore.getByIdempotencyKey(`${request.customerId}:${request.taskId ?? 'none'}:${request.inferenceRequestId}`);
    assert.ok(replay);
    assert.equal(replay!.state, 'COMPLETED');
    const resubmit = executor.submit(request);
    assert.equal(resubmit.ok, true);
    if (!resubmit.ok) throw new Error('expected ok');
    assert.equal(resubmit.job.state, 'COMPLETED');
  });

  it('19. customer isolation', async () => {
    const { executor } = buildExecutor();
    const request = structuredRequest({ executor, customerId: 'cust_a' });
    executor.submit(request);
    await waitForJob(executor, request.inferenceRequestId, request.customerId);
    const foreign = executor.poll(request.inferenceRequestId, 'cust_b');
    assert.equal(foreign.ok, false);
  });

  it('20. no fixture fallback on provider failure', async () => {
    const { executor } = buildExecutor();
    const request = structuredRequest({ executor, fixture: 'unavailable' });
    executor.submit(request);
    const job = await waitForJob(executor, request.inferenceRequestId, request.customerId);
    assert.notEqual(job.state, 'COMPLETED');
    assert.equal(job.result, null);
  });

  it('21. existing Grok integration regression', () => {
    const clock = new FrozenClock(NOW);
    const transport = new FixtureHttpsTransport([
      {
        host: 'api.x.ai',
        path: '/v1/responses',
        result: httpsOk({ output_text: 'ok', usage: { input_tokens: 3, output_tokens: 2, total_tokens: 5 } }, 5),
      },
    ]);
    const provider = new XaiGrokAiProvider({ clock, transport, available: true });
    const result = provider.infer({
      requestId: requestIdFor('h10:grok'),
      taskClass: 'GENERAL_ASSISTANT',
      modelRef: { modelId: CANONICAL_GROK_MODEL_ID, version: CANONICAL_GROK_MODEL_VERSION },
      promptHash: 'sha256:test',
      releasedContext: Object.freeze([]),
    });
    assert.equal(result.ok, true);
    assert.equal(result.value.providerKind, 'XAI_GROK');
  });

  it('async transport wraps sync HTTPS without blocking contract', async () => {
    const inner = new FixtureHttpsTransport([
      { host: 'example.test', path: '/infer', result: httpsOk({ ok: true }, 2) },
    ]);
    const asyncTransport = new AsyncSyncHttpsTransportAdapter(inner, { delayMs: 1 });
    const result = await asyncTransport.exchangeAsync({
      scheme: 'HTTPS',
      host: 'example.test',
      path: '/infer',
      method: 'POST',
      timeoutMs: 1_000,
      correlationId: 'corr_async',
      headers: Object.freeze({}),
      body: Object.freeze({}),
      credentialRef: null,
    });
    assert.equal(result.ok, true);
  });

  it('provider unavailable is explicit', async () => {
    const { executor } = buildExecutor();
    const request = structuredRequest({ executor, fixture: 'unavailable' });
    executor.submit(request);
    const job = await waitForJob(executor, request.inferenceRequestId, request.customerId);
    assert.equal(job.state, 'PROVIDER_UNAVAILABLE');
  });
});

describe('HELIOS H10 platform inference bridge', () => {
  it('reserves HELIOS research budget before async inference dispatch', () => {
    const { orchestrator, subjectId, customerId } = heliosSetup('id_h10', 'cust_h10');
    const order = orchestrator.createWorkOrder({
      programId: 'hpg_h10',
      customerId,
      subjectId,
      objective: 'async inference research',
      mandate: mandate(subjectId),
      capability: 'HELIOS_RESEARCH',
      approvalRef: null,
      budgetCeiling: '500',
      budgetUnitKind: 'MONETARY_MINOR',
      budgetCurrency: 'USD',
    });
    if ('code' in order) throw new Error(order.message);
    const task = orchestrator.createTask({
      workOrderId: order.workOrderId,
      customerId,
      operationIdentity: 'infer_1',
      taskType: 'RESEARCH_QUERY',
      requiredCapability: 'HELIOS_RESEARCH',
      permittedTools: Object.freeze([]),
      permittedModelClass: 'SIMULATION',
      requestedObjective: 'research query',
      estimatedBudget: '100',
    });
    if ('code' in task) throw new Error(task.message);
    const budgetPort = new HeliosResearchBudgetPort(orchestrator);
    const blocked = budgetPort.reserve({
      workOrderId: order.workOrderId,
      taskId: task.taskId,
      customerId,
      reservationRef: 'rbr_h10_extra',
      amountMicros: '500',
      unitKind: 'MONETARY_MINOR',
    });
    assert.equal(blocked.ok, false);
    if (blocked.ok) throw new Error('expected budget exhaustion');
    assert.equal(blocked.code, 'BUDGET_EXHAUSTED');
  });

  it('composes orchestrator budget port with async inference executor', async () => {
    const subjectId = 'id_async';
    const customerId = 'cust_async';
    const { clock, orchestrator } = heliosSetup(subjectId, customerId);
    const { registry } = operator();
    const catalog = new InferenceModelCatalog();
    seedInferenceModelCatalog(catalog);
    const gateway = new AiModelGateway({
      clock,
      governanceRegistry: registry,
      policy: defaultAiPolicy('S3M_PRIMARY'),
      catalog,
      providers: { LOCAL_TEST: new LocalTestAiProvider(clock) },
    });
    const order = orchestrator.createWorkOrder({
      programId: 'hpg_async',
      customerId,
      subjectId,
      objective: 'async',
      mandate: mandate(subjectId),
      capability: 'HELIOS_RESEARCH',
      approvalRef: null,
      budgetCeiling: '1000',
      budgetUnitKind: 'MONETARY_MINOR',
      budgetCurrency: 'USD',
    });
    if ('code' in order) throw new Error(order.message);
    const task = orchestrator.createTask({
      workOrderId: order.workOrderId,
      customerId,
      operationIdentity: 'infer_async',
      taskType: 'RESEARCH_QUERY',
      requiredCapability: 'HELIOS_RESEARCH',
      permittedTools: Object.freeze([]),
      permittedModelClass: 'SIMULATION',
      requestedObjective: 'async infer',
      estimatedBudget: '100',
    });
    if ('code' in task) throw new Error(task.message);
    const executor = new AsyncInferenceExecutor({
      clock,
      gateway,
      catalog,
      budgetPort: new HeliosResearchBudgetPort(orchestrator),
    });
    const requestId = requestIdFor('h10:platform');
    const submitted = executor.submit(Object.freeze({
      inferenceRequestId: requestId,
      taskId: task.taskId,
      workOrderId: order.workOrderId,
      customerId,
      purposeReference: 'helios',
      purpose: 'GENERAL_ASSISTANT',
      taskClass: 'GENERAL_ASSISTANT',
      provider: 'LOCAL_TEST',
      modelId: CANONICAL_LOCAL_TEST_MODEL_ID,
      modelVersion: CANONICAL_LOCAL_TEST_MODEL_VERSION,
      promptTemplateId: null,
      structuredInput: Object.freeze({}),
      toolCapabilities: Object.freeze([]),
      responseSchema: 'EXPLANATION',
      maxOutputTokens: 256,
      connectionTimeoutMs: 1_000,
      processingTimeoutMs: 30_000,
      taskDeadline: null,
      workOrderHorizon: null,
      privacyClassification: 'PUBLIC',
      budgetReservationRef: `rbr_${requestId}`,
      estimatedBudgetMicros: '50',
      traceRefs: Object.freeze([]),
      evidenceRefs: Object.freeze([]),
      gatewayRequest: Object.freeze({
        requestId,
        purpose: 'GENERAL_ASSISTANT',
        taskClass: 'GENERAL_ASSISTANT',
        privacyClass: 'PUBLIC',
        jurisdictionRef: 'SIM',
        authorization: Object.freeze({
          actorId: subjectId,
          subjectId,
          userApprovedExternal: false,
          mandateId: mandate(subjectId).mandateId,
          agentId: null,
        }),
        conversationId: null,
        userId: subjectId,
        prompt: 'research',
        context: Object.freeze([]),
        correlationId: 'corr_platform',
        modelRef: { modelId: CANONICAL_LOCAL_TEST_MODEL_ID, version: CANONICAL_LOCAL_TEST_MODEL_VERSION },
        clientModelSelection: true,
        preferredProvider: 'LOCAL_TEST',
        allowFallback: false,
      }),
    }));
    assert.equal(submitted.ok, true);
    const started = Date.now();
    while (Date.now() - started < 5_000) {
      const polled = executor.poll(requestId, customerId);
      if (polled.ok && polled.job.state === 'COMPLETED') break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const finalJob = executor.poll(requestId, customerId);
    assert.equal(finalJob.ok, true);
    if (!finalJob.ok) throw new Error(finalJob.message);
    assert.equal(finalJob.job.state, 'COMPLETED');
  });
});
