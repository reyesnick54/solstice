/**
 * Subscription intelligence workload — recurring detection and classification.
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
import { captureEnvironment } from '../lib/env-metadata.ts';
import type { SuiteResult } from '../lib/report.ts';
import type { QualificationStatus } from '../lib/targets.ts';
import { summarizeLatencyMs, timeMs } from '../lib/stats.ts';

const NOW = asUtcInstant('2026-08-31T12:00:00.000Z');
const HISTORY_SIZES = [50, 200, 500, 1000] as const;

function event(eventType: DomainEvent['eventType'], payload: Record<string, unknown>, eventId: string): DomainEvent {
  return { eventType, schemaVersion: 1, occurredAt: NOW, eventId, payload } as DomainEvent;
}

async function seedTransactionHistory(
  peg: EconomicGraphService,
  actor: unknown,
  subjectId: string,
  customerId: string,
  count: number,
) {
  peg.registerAccountCurrency('acct_checking', 'USD');
  peg.openGraph(actor, subjectId, asCustomerId(customerId));
  const merchants = ['netflix', 'spotify', 'amazon', 'gym', 'insurance', 'utility'];
  const events: DomainEvent[] = [
    event(
      'AccountOpened',
      {
        accountId: 'acct_checking',
        ownerId: customerId,
        accountClass: 'DEMAND_DEPOSIT',
        executionAuthorityId: 'ea',
        intentId: 'I-open',
      },
      'evt_open',
    ),
  ];
  for (let i = 0; i < count; i += 1) {
    events.push(
      event(
        'CardTransactionSettled',
        {
          cardId: 'card_1',
          customerId,
          merchantRef: merchants[i % merchants.length],
          amountMinorUnits: String(500 + (i % 20) * 100),
          currency: 'USD',
          transactionRef: `tx_${i}`,
        },
        `evt_tx_${i}`,
      ),
    );
  }
  peg.ingestAll(events, subjectId);
  peg.materializeRecurring(subjectId);
}

export async function runSubscriptionIntelligenceBaseline(): Promise<SuiteResult> {
  const started = Date.now();
  const cases: Record<string, unknown>[] = [];

  for (const historySize of HISTORY_SIZES) {
    const clock = new FrozenClock(NOW);
    const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
    const events = new DomainEventLog();
    const evidence = new EvidenceVault(clock);
    const identity = new SimulatedIdentityAdapter({ clock, keys, events, evidence });
    const subjectId = `sub_perf_${historySize}`;
    const customerId = `cust_${subjectId}`;
    identity.provisionSimulatedActor({
      actorId: `actor_${subjectId}`,
      jurisdiction: asJurisdiction('US'),
      identityId: subjectId,
      customerId: asCustomerId(customerId),
      capabilities: ['VIEW_GROWTH_PLAN', 'VIEW_ECONOMIC_GRAPH', 'DECLARE_ECONOMIC_FACT'],
    });
    const actor = identity.service.resolveActorContext(`actor_${subjectId}`);
    if (!actor.ok) throw new Error('actor failed');
    const peg = new EconomicGraphService({ clock, events });
    await seedTransactionHistory(peg, actor.value, subjectId, customerId, historySize);
    const grow = new GrowthOrchestrator({ clock, peg, events, evidence });

    const detectMs = await timeMs(() => grow.discoverCustomerOpportunities(actor.value, subjectId));
    cases.push({
      name: `history-${historySize}`,
      historySize,
      status: 'BENCHMARKED',
      detectLatencyMs: detectMs,
      complexityNote: historySize >= 500 ? 'monitor for superlinear growth' : 'within expected envelope',
    });
  }

  const latencies = cases.map((row) => row.detectLatencyMs as number);
  const detect = summarizeLatencyMs(latencies);
  const first = latencies[0] ?? 1;
  const last = latencies[latencies.length - 1] ?? 1;
  const superlinear = last > first * 50;
  const suiteStatus: QualificationStatus = superlinear ? 'TARGET_NOT_MET' : 'BENCHMARKED';

  return {
    suite: 'subscription-intelligence',
    status: suiteStatus,
    durationMs: Date.now() - started,
    cases,
    environment: captureEnvironment({ benchmarkTool: 'growth-opportunity-detectors' }),
    aggregate: { detect },
    ...(superlinear ? { notes: ['Possible superlinear behavior at large history sizes'] } : {}),
  };
}
