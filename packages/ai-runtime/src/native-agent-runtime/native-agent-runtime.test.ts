import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../../config/src/clock.ts';
import { asCustomerId } from '../../../domain/src/customer.ts';
import { asJurisdiction } from '../../../domain/src/jurisdiction.ts';
import { DomainEventLog } from '../../../events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../../identity/src/simulation.ts';
import { ModelRegistry } from '../../../model-registry/src/registry.ts';
import { createSimulationKeyProvider } from '../../../security/src/simulation.ts';
import { seedInferenceModelCatalog } from '../catalog-seed.ts';
import { AI_RUNTIME_NOW, defaultAiPolicy } from '../fixtures.ts';
import { AiModelGateway } from '../gateway.ts';
import { InferenceModelCatalog } from '../catalog.ts';
import { LocalTestAiProvider } from '../providers/local-test.ts';
import { requestIdFor } from '../ids.ts';
import { CANONICAL_LOCAL_TEST_MODEL_ID, CANONICAL_LOCAL_TEST_MODEL_VERSION, seedCanonicalAiModels } from '../registry.ts';
import type { AiGatewayRequest } from '../gateway.ts';
import {
  assessNativeAgentRuntimeQualification,
  HELIOS_NATIVE_AGENT_RUNTIME_QUALIFIED,
  NativeSessionModelGateway,
} from './index.ts';

function operator() {
  const clock = new FrozenClock(AI_RUNTIME_NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const identity = new SimulatedIdentityAdapter({ clock, keys, events: new DomainEventLog() });
  assert.equal(
    identity.provisionSimulatedActor({
      actorId: 'native11_op',
      jurisdiction: asJurisdiction('GB'),
      identityId: 'id_native11',
      customerId: asCustomerId('cust_native11'),
      capabilities: ['VIEW_ACCOUNT'],
    }).ok,
    true,
  );
  const actor = identity.service.resolveActorContext('native11_op');
  if (!actor.ok) {
    throw new Error('actor');
  }
  return actor.value;
}

describe('native agent runtime (ai-runtime)', () => {
  it('qualifies the inference plane extension', () => {
    const report = assessNativeAgentRuntimeQualification(AI_RUNTIME_NOW);
    assert.equal(report.marker, HELIOS_NATIVE_AGENT_RUNTIME_QUALIFIED);
  });

  it('records session usage through the canonical gateway wrapper', () => {
    const registry = new ModelRegistry();
    assert.equal(seedCanonicalAiModels(registry, operator(), AI_RUNTIME_NOW).ok, true);
    const catalog = new InferenceModelCatalog();
    seedInferenceModelCatalog(catalog);
    const gateway = new AiModelGateway({
      clock: new FrozenClock(AI_RUNTIME_NOW),
      governanceRegistry: registry,
      policy: defaultAiPolicy(),
      catalog,
      providers: { LOCAL_TEST: new LocalTestAiProvider(new FrozenClock(AI_RUNTIME_NOW)) },
    });
    const sessionGateway = new NativeSessionModelGateway({ gateway });
    const sessionId = 'nas_test_1';
    const requestId = requestIdFor('native11');
    const base: AiGatewayRequest = Object.freeze({
      requestId,
      purpose: 'FINANCIAL_EXPLANATION',
      taskClass: 'FINANCIAL_EXPLANATION',
      privacyClass: 'PUBLIC',
      jurisdictionRef: 'SIM',
      authorization: Object.freeze({
        actorId: 'native11_op',
        subjectId: 'cust_native11',
        userApprovedExternal: false,
        mandateId: 'uam_demo',
        agentId: 'uag_demo',
      }),
      conversationId: sessionId,
      userId: 'cust_native11',
      prompt: 'Summarize simulation balances.',
      context: Object.freeze([]),
      correlationId: 'corr_native11',
      fixture: 'normal',
      modelRef: { modelId: CANONICAL_LOCAL_TEST_MODEL_ID, version: CANONICAL_LOCAL_TEST_MODEL_VERSION },
    });
    const result = sessionGateway.infer({ ...base, nativeSessionId: sessionId });
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(result.value.outcome, 'SUCCESS');
    assert.ok(sessionGateway.sessionUsage.snapshot(sessionId));
  });
});
