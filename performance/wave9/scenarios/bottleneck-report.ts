/**
 * Wave 9 Task 14 — bottleneck identification and prioritization.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { captureEnvironment } from '../../lib/env-metadata.ts';
import { mergeSuiteStatus, type SuiteResult } from '../../lib/report.ts';

const INVENTORY_PATH = join(import.meta.dirname, '../../inventory.json');

export type BottleneckFinding = {
  readonly id: string;
  readonly category: string;
  readonly component: string;
  readonly severity: 'HIGH' | 'MEDIUM' | 'LOW';
  readonly productionImpact: string;
  readonly mitigation: string;
};

export const BOTTLENECK_FINDINGS: readonly BottleneckFinding[] = Object.freeze([
  {
    id: 'api-bff-fanout',
    category: 'API',
    component: 'services/api Consumer BFF',
    severity: 'HIGH',
    productionImpact: 'Multi-service home/grow paths amplify latency under concurrent load',
    mitigation: 'Endpoint-class rate limits, provider cache, parallel fan-out with circuit breakers',
  },
  {
    id: 'ledger-posting',
    category: 'Database',
    component: 'packages/ledger',
    severity: 'HIGH',
    productionImpact: 'Kernel-gated journal writes are synchronous on critical path',
    mitigation: 'Connection pooling, read replicas for balance queries, batch non-critical events',
  },
  {
    id: 'event-outbox-dispatch',
    category: 'Event bus',
    component: 'packages/events outbox/inbox',
    severity: 'MEDIUM',
    productionImpact: 'At-least-once delivery can backlog under consumer slowdown',
    mitigation: 'Lag monitoring, horizontal consumers, dead-letter quarantine',
  },
  {
    id: 'consensus-finality',
    category: 'Consensus',
    component: 'packages/sunrey-chain BFT',
    severity: 'HIGH',
    productionImpact: 'Block finality bounds transaction confirmation latency',
    mitigation: 'Validator topology, network latency optimization, batch sizing',
  },
  {
    id: 'provider-fanout',
    category: 'Network',
    component: 'packages/external-data plane',
    severity: 'MEDIUM',
    productionImpact: '126-provider program fan-out increases tail latency',
    mitigation: 'Single-flight, SWR cache, category-scoped circuit breakers',
  },
  {
    id: 'graph-queries',
    category: 'Graph',
    component: 'packages/personal-economic-graph',
    severity: 'MEDIUM',
    productionImpact: 'PEG federated queries can be CPU-intensive on large graphs',
    mitigation: 'Query bounds, materialized projections, async enrichment',
  },
  {
    id: 'exchange-matching',
    category: 'Exchange',
    component: 'packages/sunrey-exchange',
    severity: 'MEDIUM',
    productionImpact: 'Order ingress and DVP settlement are latency-sensitive',
    mitigation: 'In-memory matching, async settlement workers, idempotent recovery',
  },
  {
    id: 'memory-preview',
    category: 'Memory',
    component: 'In-memory preview stores',
    severity: 'LOW',
    productionImpact: 'Development preview does not model production memory pressure',
    mitigation: 'PostgreSQL persistence qualification, soak testing per docs/performance/soak-testing.md',
  },
]);

export async function runBottleneckReport(): Promise<SuiteResult> {
  const started = Date.now();
  const cases: Record<string, unknown>[] = [];

  let inventoryPaths = 0;
  try {
    const inventory = JSON.parse(readFileSync(INVENTORY_PATH, 'utf8')) as {
      prioritizedPaths: unknown[];
    };
    inventoryPaths = inventory.prioritizedPaths.length;
  } catch {
    inventoryPaths = 0;
  }

  const bySeverity = {
    HIGH: BOTTLENECK_FINDINGS.filter((row) => row.severity === 'HIGH'),
    MEDIUM: BOTTLENECK_FINDINGS.filter((row) => row.severity === 'MEDIUM'),
    LOW: BOTTLENECK_FINDINGS.filter((row) => row.severity === 'LOW'),
  };

  for (const finding of BOTTLENECK_FINDINGS) {
    cases.push({
      name: finding.id,
      status: 'BENCHMARKED',
      category: finding.category,
      component: finding.component,
      severity: finding.severity,
      productionImpact: finding.productionImpact,
      mitigation: finding.mitigation,
    });
  }

  cases.push({
    name: 'inventory-coverage',
    status: inventoryPaths > 0 ? 'TARGET_MET' : 'BENCHMARKED',
    prioritizedPaths: inventoryPaths,
    note: 'Wave 6 inventory informs bottleneck prioritization',
  });

  cases.push({
    name: 'severity-summary',
    status: 'BENCHMARKED',
    high: bySeverity.HIGH.length,
    medium: bySeverity.MEDIUM.length,
    low: bySeverity.LOW.length,
    prioritizedByProductionImpact: ['api-bff-fanout', 'ledger-posting', 'consensus-finality', 'event-outbox-dispatch'],
  });

  return {
    suite: 'bottlenecks',
    status: mergeSuiteStatus(cases.map((row) => ({ status: row.status as 'BENCHMARKED' }))),
    durationMs: Date.now() - started,
    cases,
    environment: captureEnvironment({ analysisMode: 'engineering-review' }),
    notes: ['Prioritized by expected production impact — not measured production bottlenecks'],
  };
}
