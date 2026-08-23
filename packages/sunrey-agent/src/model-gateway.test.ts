import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asCustomerId } from '../../domain/src/customer.ts';
import { asJurisdiction } from '../../domain/src/jurisdiction.ts';
import { DomainEventLog } from '../../events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../identity/src/simulation.ts';
import { ModelRegistry } from '../../model-registry/src/registry.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
import { AiModelGateway } from '../../ai-runtime/src/gateway.ts';
import { requestIdFor } from '../../ai-runtime/src/ids.ts';
import { createDefaultAiRuntimePolicy } from '../../ai-runtime/src/policy.ts';
import { seedCanonicalAiModels } from '../../ai-runtime/src/registry.ts';
import {
  agentModelOutageIsNotFinancial,
  agentSafeStream,
  bindAgentModelGateway,
  refuseRawPublicLlm,
} from './model-gateway.ts';

const NOW = '2026-08-19T12:00:00.000Z' as const;

function operator() {
  const clock = new FrozenClock(NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const identity = new SimulatedIdentityAdapter({ clock, keys, events: new DomainEventLog() });
  identity.provisionSimulatedActor({
    actorId: 'operator_1',
    jurisdiction: asJurisdiction('GB'),
    identityId: 'id_agent_gw',
    customerId: asCustomerId('cust_agent_gw'),
    capabilities: ['VIEW_ACCOUNT'],
  });
  const actor = identity.service.resolveActorContext('operator_1');
  if (!actor.ok) {
    throw new Error('actor');
  }
  return { clock, actor: actor.value };
}

describe('Agent Model Gateway port', () => {
  it('calls the canonical Model Gateway and never exposes a raw public LLM', () => {
    const { clock, actor } = operator();
    const registry = new ModelRegistry();
    assert.equal(seedCanonicalAiModels(registry, actor, NOW).ok, true);
    const gateway = new AiModelGateway({
      clock,
      governanceRegistry: registry,
      policy: createDefaultAiRuntimePolicy('S3M_PRIMARY'),
    });
    const port = bindAgentModelGateway(gateway);
    const result = port.stream({
      requestId: requestIdFor('agent-stream'),
      purpose: 'GENERAL_ASSISTANT',
      taskClass: 'GENERAL_ASSISTANT',
      privacyClass: 'PUBLIC',
      jurisdictionRef: 'SIM',
      authorization: {
        actorId: 'user_1',
        subjectId: 'user_1',
        userApprovedExternal: false,
        mandateId: 'uam_demo',
        agentId: 'uag_demo',
      },
      conversationId: 'convo_agent',
      userId: 'user_1',
      prompt: 'Help me understand my sandbox account',
      context: [],
      correlationId: 'corr_agent',
    });
    assert.equal(result.ok, true);
    if (!result.ok) {
      throw new Error(result.error.detail);
    }
    assert.equal(agentSafeStream(result.value).every((event) => event.hiddenReasoning === false), true);
    assert.equal(agentModelOutageIsNotFinancial(result), true);
    const raw = refuseRawPublicLlm();
    assert.equal(raw.ok, false);
    if (!raw.ok) {
      assert.equal(raw.error.code, 'MODEL_POLICY_BLOCKED');
    }
  });
});
