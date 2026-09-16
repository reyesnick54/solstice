import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../../config/src/clock.ts';
import { asCustomerId } from '../../../domain/src/customer.ts';
import { asJurisdiction } from '../../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { DomainEventLog } from '../../../events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../../identity/src/simulation.ts';
import { createSimulationKeyProvider } from '../../../security/src/simulation.ts';
import {
  AsyncInferenceExecutor,
} from '../../../ai-runtime/src/async-inference/index.ts';
import { InferenceModelCatalog } from '../../../ai-runtime/src/catalog.ts';
import { seedInferenceModelCatalog } from '../../../ai-runtime/src/catalog-seed.ts';
import { defaultAiPolicy } from '../../../ai-runtime/src/fixtures.ts';
import { AiModelGateway } from '../../../ai-runtime/src/gateway.ts';
import { requestIdFor } from '../../../ai-runtime/src/ids.ts';
import { LocalTestAiProvider } from '../../../ai-runtime/src/providers/local-test.ts';
import { seedCanonicalAiModels } from '../../../ai-runtime/src/registry.ts';
import { CANONICAL_LOCAL_TEST_MODEL_ID, CANONICAL_LOCAL_TEST_MODEL_VERSION } from '../../../ai-runtime/src/registry.ts';
import { asEconomicMandateId, asMandateVersion } from '../ids.ts';
import type { CompiledEconomicMandate } from '../mandate/types.ts';
import { ModelRegistry } from '../../../model-registry/src/registry.ts';
import { HeliosResearchBudgetPort, HeliosWorkOrchestrator } from './index.ts';

const NOW = asUtcInstant('2026-09-16T15:00:00.000Z');

function mandate(subjectId: string): CompiledEconomicMandate {
  return Object.freeze({
    mandateId: asEconomicMandateId('emd_h10'),
    version: asMandateVersion(1),
    subjectId,
    state: 'ACTIVE',
    sourceText: 'research only',
    currency: 'USD',
    goals: Object.freeze([]),
    hardConstraints: Object.freeze([]),
    softPreferences: Object.freeze([]),
    compiledAt: NOW,
    planningEligible: true,
  });
}

function setup(subjectId: string, customerId: string) {
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

describe('HELIOS H10 platform inference bridge', () => {
  it('reserves HELIOS research budget before async inference dispatch', () => {
    const { orchestrator, subjectId, customerId } = setup('id_h10', 'cust_h10');
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
      customerId: order.customerId,
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
      customerId: order.customerId,
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
    const { clock, orchestrator } = setup(subjectId, customerId);
    const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
    const identity = new SimulatedIdentityAdapter({ clock, keys, events: new DomainEventLog() });
    assert.equal(
      identity.provisionSimulatedActor({
        actorId: 'op_h10',
        jurisdiction: asJurisdiction('GB'),
        identityId: 'id_op_h10',
        customerId: asCustomerId('cust_async'),
        capabilities: ['VIEW_ACCOUNT'],
      }).ok,
      true,
    );
    const actor = identity.service.resolveActorContext('op_h10');
    if (!actor.ok) throw new Error('actor');
    const registry = new ModelRegistry();
    assert.equal(seedCanonicalAiModels(registry, actor.value, NOW).ok, true);
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
          actorId: 'id_async',
          subjectId: 'id_async',
          userApprovedExternal: false,
          mandateId: mandate(subjectId).mandateId,
          agentId: null,
        }),
        conversationId: null,
        userId: 'id_async',
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
      const polled = executor.poll(requestId, order.customerId);
      if (polled.ok && polled.job.state === 'COMPLETED') break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const finalJob = executor.poll(requestId, order.customerId);
    assert.equal(finalJob.ok, true);
    if (!finalJob.ok) throw new Error(finalJob.message);
    assert.equal(finalJob.job.state, 'COMPLETED');
  });
});
