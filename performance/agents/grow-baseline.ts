/**
 * Grow My Money orchestration benchmark — separates deterministic backend from AI latency.
 */

import { FrozenClock } from '../../packages/config/src/clock.ts';
import { asCustomerId } from '../../packages/domain/src/customer.ts';
import { asJurisdiction } from '../../packages/domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../packages/domain/src/time.ts';
import { EvidenceVault } from '../../packages/evidence/src/vault.ts';
import { DomainEventLog, type DomainEvent } from '../../packages/events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../packages/identity/src/simulation.ts';
import { EconomicGraphService } from '../../packages/personal-economic-graph/src/service.ts';
import { GrowthOrchestrator } from '../../packages/platform/src/service.ts';
import { createSimulationKeyProvider } from '../../packages/security/src/simulation.ts';
import { s3mRequest } from '../../packages/ai-runtime/src/fixtures.ts';
import { createDefaultAiRuntimePolicy } from '../../packages/ai-runtime/src/policy.ts';
import { seedCanonicalAiModels } from '../../packages/ai-runtime/src/registry.ts';
import { AiRuntime } from '../../packages/ai-runtime/src/runtime.ts';
import { ModelRegistry } from '../../packages/model-registry/src/registry.ts';
import { S3mInferenceProvider } from '../../packages/ai-runtime/src/providers/s3m/adapter.ts';
import { SimulatedS3mServer } from '../../packages/ai-runtime/src/providers/s3m/simulator.ts';
import { captureEnvironment } from '../lib/env-metadata.ts';
import type { SuiteResult } from '../lib/report.ts';
import { evaluateLatencyTarget, QUALIFICATION_TARGETS, type QualificationStatus } from '../lib/targets.ts';
import { summarizeLatencyMs, timeMs } from '../lib/stats.ts';

const NOW = asUtcInstant('2026-08-31T12:00:00.000Z');
const SAMPLES = 20;

function event(eventType: DomainEvent['eventType'], payload: Record<string, unknown>, eventId: string): DomainEvent {
  return { eventType, schemaVersion: 1, occurredAt: NOW, eventId, payload } as DomainEvent;
}

function seedPeg(peg: EconomicGraphService, actor: unknown, subjectId: string, customerId: string): void {
  peg.registerAccountCurrency('acct_usd_checking', 'USD');
  peg.openGraph(actor, subjectId, asCustomerId(customerId));
  peg.registerOverlay({
    sourceEventId: 'evt_sub',
    subjectId,
    classification: 'SUBSCRIPTION',
    counterpart: { kind: 'MERCHANT', ref: 'sim_stream', label: 'SimStream' },
  });
  peg.ingestAll(
    [
      event(
        'AccountOpened',
        {
          accountId: 'acct_usd_checking',
          ownerId: customerId,
          accountClass: 'DEMAND_DEPOSIT',
          executionAuthorityId: 'ea',
          intentId: 'I-open',
        },
        'evt_open',
      ),
      event(
        'DepositPosted',
        { journalId: 'j1', accountId: 'acct_usd_checking', amountMinorUnits: '500000', currency: 'USD' },
        'evt_dep',
      ),
      event(
        'CardTransactionSettled',
        {
          cardId: 'card_1',
          customerId,
          merchantRef: 'sim_stream',
          amountMinorUnits: '1599',
          currency: 'USD',
          transactionRef: 'stream_1',
        },
        'evt_sub',
      ),
    ],
    subjectId,
  );
  peg.materializeRecurring(subjectId);
}

async function buildGrowFixture() {
  const clock = new FrozenClock(NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);
  const identity = new SimulatedIdentityAdapter({ clock, keys, events, evidence });
  const subjectId = 'id_grow_perf';
  const customerId = 'cust_grow_perf';
  identity.provisionSimulatedActor({
    actorId: 'actor_grow_perf',
    jurisdiction: asJurisdiction('US'),
    identityId: subjectId,
    customerId: asCustomerId(customerId),
    capabilities: ['VIEW_GROWTH_PLAN', 'VIEW_ECONOMIC_GRAPH', 'DECLARE_ECONOMIC_FACT', 'CONFIRM_ECONOMIC_MANDATE'],
  });
  const actor = identity.service.resolveActorContext('actor_grow_perf');
  if (!actor.ok) throw new Error('actor context failed');
  const peg = new EconomicGraphService({ clock, events });
  seedPeg(peg, actor.value, subjectId, customerId);
  const grow = new GrowthOrchestrator({ clock, peg, events, evidence });
  const compiled = grow.interpretAndCompile(actor.value, {
    subjectId,
    sourceText: 'Build emergency reserve. Review subscriptions. Keep $5,000 liquid.',
  });
  if (!compiled.ok) throw new Error(compiled.error.message);
  const active = grow.confirmAndActivate(actor.value, subjectId);
  if (!active.ok) throw new Error(active.error.message);
  return { actor: actor.value, grow, subjectId };
}

export async function runGrowBaseline(): Promise<SuiteResult> {
  const started = Date.now();
  const cases: Record<string, unknown>[] = [];
  const { actor, grow, subjectId } = await buildGrowFixture();

  const opportunitySamples: number[] = [];
  const proposalSamples: number[] = [];

  for (let i = 0; i < SAMPLES; i += 1) {
    opportunitySamples.push(
      await timeMs(() => {
        grow.discoverCustomerOpportunities(actor, subjectId);
      }),
    );
    proposalSamples.push(
      await timeMs(() => {
        grow.plan(actor, subjectId);
      }),
    );
  }

  const opportunities = summarizeLatencyMs(opportunitySamples);
  const proposals = summarizeLatencyMs(proposalSamples);
  const proposalStatus = evaluateLatencyTarget(QUALIFICATION_TARGETS.grow.proposalCreation, proposals);

  const clock = new FrozenClock(NOW);
  const s3m = new S3mInferenceProvider({
    clock,
    transport: new SimulatedS3mServer({ defaultFixture: 'grow_my_money' }),
    config: {
      baseUrl: 's3m-local://simulator',
      inferencePath: 'configured-inference',
      healthPath: 'configured-health',
      contextSizeTokens: 8192,
    },
  });
  const registry = new ModelRegistry();
  seedCanonicalAiModels(registry, actor, NOW);
  const runtime = new AiRuntime(clock, registry, createDefaultAiRuntimePolicy('S3M_PRIMARY'), { S3M: s3m });
  const aiSamples: number[] = [];
  for (let i = 0; i < 10; i += 1) {
    aiSamples.push(
      await timeMs(async () => {
        const request = s3mRequest({
          taskClass: 'GROWTH_PLANNING',
          dataClass: 'USER_APPROVED_CONTEXT',
          prompt: 'Explain emergency fund priority for simulation user.',
        });
        const result = runtime.infer(request);
        if (!result.ok) throw new Error(result.error.message);
      }),
    );
  }
  const aiLatency = summarizeLatencyMs(aiSamples);

  cases.push(
    { name: 'opportunity-ingestion', category: 'deterministic-backend', status: 'BENCHMARKED', latency: opportunities },
    { name: 'proposal-creation', category: 'deterministic-backend', status: proposalStatus, latency: proposals },
    {
      name: 's3m-inference',
      category: 'external-ai',
      status: 'BENCHMARKED',
      latency: aiLatency,
      note: 'Simulator only — not live provider latency',
    },
  );

  const suiteStatus: QualificationStatus = proposalStatus === 'TARGET_NOT_MET' ? 'TARGET_NOT_MET' : 'TARGET_MET';

  return {
    suite: 'grow',
    status: suiteStatus,
    durationMs: Date.now() - started,
    cases,
    environment: captureEnvironment({ benchmarkTool: 'grow-orchestrator-in-process' }),
  };
}
