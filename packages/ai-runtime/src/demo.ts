import { FrozenClock } from '../../config/src/clock.ts';
import { asCustomerId } from '../../domain/src/customer.ts';
import { asJurisdiction } from '../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { DomainEventLog } from '../../events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../identity/src/simulation.ts';
import { ModelRegistry } from '../../model-registry/src/registry.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
import { UserAgentMandateEngine } from '../../sunrey-agent/src/engine.ts';
import { createProposalFromInference } from '../../sunrey-agent/src/inference.ts';
import { createAgentSandboxScenario } from '../../sunrey-agent/src/sandbox.ts';
import { localTestRequest } from './fixtures.ts';
import { createDefaultAiRuntimePolicy } from './policy.ts';
import { LocalTestAiProvider } from './providers/local-test.ts';
import { S3mAiProvider } from './providers/s3m.ts';
import { seedCanonicalAiModels } from './registry.ts';
import { AiRuntime } from './runtime.ts';
import { publicTraceView } from './tracing.ts';

const now = asUtcInstant('2026-08-19T12:00:00.000Z');
const clock = new FrozenClock(now);
const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
const identity = new SimulatedIdentityAdapter({ clock, keys, events: new DomainEventLog() });
identity.provisionSimulatedActor({
  actorId: 'operator_1',
  jurisdiction: asJurisdiction('GB'),
  identityId: 'id_ai_demo',
  customerId: asCustomerId('cust_ai_demo'),
  capabilities: ['VIEW_ACCOUNT'],
});
const actor = identity.service.resolveActorContext('operator_1');
if (!actor.ok) {
  throw new Error('demo operator required');
}

const registry = new ModelRegistry();
const seeded = seedCanonicalAiModels(registry, actor.value, now);
if (!seeded.ok) {
  throw new Error(seeded.error.message);
}

const runtime = new AiRuntime(clock, registry, createDefaultAiRuntimePolicy('S3M_PRIMARY'), {
  S3M: new S3mAiProvider(clock, false),
  LOCAL_TEST: new LocalTestAiProvider(clock),
});

const request = localTestRequest({
  taskClass: 'PAYMENT_PREPARATION',
  dataClass: 'SYNTHETIC',
  fixture: 'structured_financial_proposal',
  prompt: 'Prepare a bounded simulation payment',
});
const inferred = runtime.infer(request);
if (!inferred.ok || !inferred.value.response) {
  throw new Error(inferred.ok ? 'missing response' : inferred.error.detail);
}

const engine = new UserAgentMandateEngine({
  clock,
  kernel: { submit: () => ({ status: 'ALLOW', evidenceRecordId: 'ev_ai_demo' }) },
});
const sandbox = createAgentSandboxScenario('ai-runtime-demo');
const mandate = engine.createMandate({
  owner: { kind: 'USER', ownerId: 'user_demo', walletId: 'wallet_demo', accountId: sandbox.walletAccountId },
  agentLabel: 'ai-runtime-demo',
  modelRef: `${inferred.value.response.modelRef.modelId}@${inferred.value.response.modelRef.version}`,
  policyRef: 'policy:agent-mandates-v1',
  mode: 'SIMULATION_ONLY',
  environment: 'simulation',
  permissions: {
    actionClasses: ['READ_FINANCIAL_STATE', 'PREPARE_PAYMENT'],
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
  createdByActorId: 'user_demo',
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

const gate = engine.gate.toActionIntent({
  proposal: proposal.value,
  mandate: mandate.value,
  humanApproved: true,
  actorId: 'user_demo',
});

console.log(
  JSON.stringify(
    {
      flow: [
        'user request',
        'AI Runtime',
        'LocalTest provider',
        'structured tool intent',
        'SunRey Agent proposal',
        'ProposalGate',
      ],
      request: {
        requestId: request.requestId,
        taskClass: request.taskClass,
        dataClass: request.dataClass,
      },
      routing: inferred.value.trace.routingDecision.primary,
      toolIntent: inferred.value.response.toolIntents[0]?.name ?? null,
      executes: inferred.value.response.toolIntents[0]?.executes ?? null,
      grantsExecutionAuthority: inferred.value.response.grantsExecutionAuthority,
      mandate: mandate.value.mandateId,
      proposal: proposal.value.proposalId,
      proposalState: proposal.value.state,
      guaranteedReturn: proposal.value.guaranteedReturn,
      receivesMasterKey: false,
      proposalGate: gate.ok ? 'WOULD_BUILD_INTENT' : gate.code,
      stoppedBeforeExecution: true,
      trace: publicTraceView(inferred.value.trace),
    },
    (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
    2,
  ),
);
