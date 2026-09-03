// @ts-nocheck
/**
 * Wave 8 — operations plane collectors.
 *
 * Aggregates read-only operational snapshots from canonical owners.
 */

import { FrozenClock } from '../../../../packages/config/src/clock.ts';
import { asUtcInstant } from '../../../../packages/domain/src/time.ts';
import { emptyBook, expectedTotal, observedTotal, supplyReconciles } from '../../../../packages/sunrey-chain/src/economics/supply.ts';
import { ControlRoom } from '../../../../packages/sunrey-chain/src/ops/control-room/control-room.ts';
import { healthySnapshots } from '../../../../packages/sunrey-chain/src/ops/control-room/fixtures.ts';
import { operationalState } from '../../../../packages/sunrey-chain/src/ops/control-room/readiness.ts';
import { evaluateDomainAlerts } from '../../../../packages/sunrey-chain/src/ops/control-room/alerts.ts';
import { energyOperationsFixture } from '../../../../packages/sunrey-chain/src/productive/operations/fixtures.ts';
import {
  catalogTotal,
  createProviderObservabilityPlane,
  type ProviderObservabilityPlane,
} from '../../../../packages/sunrey-chain/src/provider-runtime/universal/observability/index.ts';
import {
  createUniversalProviderRuntime,
  seedSimulationProviders,
} from '../../../../packages/sunrey-chain/src/provider-runtime/universal/index.ts';
import { SimulationChainAdapter } from '../../../../packages/sunrey-chain/src/simulation.ts';
import {
  SIMULATION_ADAPTER_ID,
  SIMULATION_CHAIN_ID,
  SIMULATION_NETWORK_ID,
} from '../../../../packages/sunrey-chain/src/ids.ts';
import type { DashboardMetricSection } from './types.ts';

const NOW = asUtcInstant('2026-09-02T12:00:00.000Z');

export type OperationsCollectors = {
  readonly providerPlane: ProviderObservabilityPlane;
  readonly controlRoom: ControlRoom;
  readonly chain: SimulationChainAdapter;
  readonly productiveOps: ReturnType<typeof energyOperationsFixture>;
};

export function createOperationsCollectors(): OperationsCollectors {
  const clock = new FrozenClock(NOW);
  const runtime = createUniversalProviderRuntime({ nowMs: () => Date.parse(NOW) });
  seedSimulationProviders(runtime, NOW);
  const providerPlane = createProviderObservabilityPlane(runtime, { catalogTotal: catalogTotal() });
  const controlRoom = new ControlRoom(clock);
  const snapshots = healthySnapshots();
  controlRoom.ingest(snapshots);
  const chain = new SimulationChainAdapter(clock);
  chain.advanceBlocks(12);
  const productiveOps = energyOperationsFixture();
  productiveOps.openChallenge({
    challengeId: 'challenge.sandbox.productive.001',
    claimId: 'claim.sandbox.productive.001',
    reason: 'SOURCE_INDEPENDENCE_INSUFFICIENT',
    challengerId: 'actor.sandbox.reviewer',
    evidenceCommitment: 'commitment.sandbox.challenge.001',
  });
  return Object.freeze({ providerPlane, controlRoom, chain, productiveOps });
}

export function collectChainStatus(chain: SimulationChainAdapter) {
  const health = chain.getHealth();
  return Object.freeze({
    networkId: SIMULATION_NETWORK_ID,
    chainId: SIMULATION_CHAIN_ID,
    adapterId: SIMULATION_ADAPTER_ID,
    blockHeight: health.height,
    finalityPolicyBlocks: 2,
    consensusState: health.status === 'AVAILABLE' ? 'ACTIVE' : 'STALLED',
    validatorStatus: 'SIMULATION_VALIDATORS_ACTIVE',
    mempoolPending: 0,
    productionMainnet: false,
    observedAt: health.observedAt,
  });
}

export function collectSupplyMetrics() {
  const sunrey = emptyBook('SUNREY_COIN', 'sandbox-v1');
  sunrey.genesisAllocated = 1_000_000_000n;
  sunrey.circulating = 250_000_000n;
  sunrey.locked = 50_000_000n;
  const moonrey = emptyBook('MOONREY_COIN', 'sandbox-v1');
  moonrey.genesisAllocated = 500_000_000n;
  moonrey.circulating = 120_000_000n;
  const sunreyRecon = supplyReconciles(sunrey);
  const moonreyRecon = supplyReconciles(moonrey);
  return Object.freeze({
    sunreySupply: expectedTotal(sunrey).toString(),
    moonreySupply: expectedTotal(moonrey).toString(),
    sunreyReconciled: sunreyRecon,
    moonreyReconciled: moonreyRecon,
    sunreyObserved: observedTotal(sunrey).toString(),
    moonreyObserved: observedTotal(moonrey).toString(),
  });
}

export function collectDashboardSections(collectors: OperationsCollectors): readonly DashboardMetricSection[] {
  const snapshots = healthySnapshots();
  const providerHealth = collectors.providerPlane.aggregateHealth();
  const supply = collectSupplyMetrics();
  const chain = collectChainStatus(collectors.chain);
  const challenges = [...collectors.productiveOps.challenges.values()];
  const productiveMetrics = collectors.productiveOps.metrics.snapshot();
  const observationCount = Object.values(productiveMetrics.observations_by_domain).reduce((sum, value) => sum + value, 0);
  return Object.freeze([
    {
      section: 'chain',
      metrics: Object.freeze({
        blockHeight: chain.blockHeight,
        finalityPolicyBlocks: chain.finalityPolicyBlocks,
        consensusState: chain.consensusState,
        validatorStatus: chain.validatorStatus,
        mempoolPending: chain.mempoolPending,
      }),
    },
    {
      section: 'supply',
      metrics: Object.freeze({
        sunreySupply: supply.sunreySupply,
        moonreySupply: supply.moonreySupply,
        sunreyReconciled: supply.sunreyReconciled,
        moonreyReconciled: supply.moonreyReconciled,
      }),
    },
    {
      section: 'providers',
      metrics: Object.freeze({
        totalProviders: providerHealth.total,
        healthyProviders: providerHealth.healthy,
        degradedProviders: providerHealth.degraded,
        unavailableProviders: providerHealth.unhealthy,
      }),
    },
    {
      section: 'observation_ingestion',
      metrics: Object.freeze({
        productiveObservations: observationCount,
        claimChallengesOpen: challenges.filter((row) => row.status === 'OPEN' || row.status === 'UNDER_REVIEW').length,
      }),
    },
    {
      section: 'information_consensus',
      metrics: Object.freeze({
        receiptsPending: 0,
        corroborationRequired: 2,
        simulationOnly: true,
      }),
    },
    {
      section: 'human_claims',
      metrics: Object.freeze({
        queueDepth: 2,
        conflictRate: 0,
        simulationOnly: true,
      }),
    },
    {
      section: 'productive_claims',
      metrics: Object.freeze({
        queueDepth: challenges.length,
        openChallenges: challenges.filter((row) => row.status === 'OPEN').length,
      }),
    },
    {
      section: 'peve',
      metrics: Object.freeze({
        valuationActive: false,
        simulationReferenceOnly: true,
      }),
    },
    {
      section: 'gpuv',
      metrics: Object.freeze({
        conversionActive: false,
        simulationReferenceOnly: true,
      }),
    },
    {
      section: 'policy',
      metrics: Object.freeze({
        productionActive: false,
        decisionsToday: 0,
        manualReviewRequired: false,
      }),
    },
    {
      section: 'authorization',
      metrics: Object.freeze({
        authDenials: snapshots.security?.signatureFailure ? 1 : 0,
        agentAuthorityAttempts: snapshots.aiSafety?.length ?? 0,
      }),
    },
    {
      section: 'exchange',
      metrics: Object.freeze({
        openOrders: 2,
        pendingSettlements: snapshots.exchange?.pendingSettlements?.toString() ?? '0',
        simulationOnly: true,
      }),
    },
    {
      section: 'api_health',
      metrics: Object.freeze({
        platformApi: 'PROCESS_UP',
        consumerBff: 'PROCESS_UP',
        operationalState: operationalState({ snapshots, incidents: [] }),
      }),
    },
    {
      section: 'reconciliation',
      metrics: Object.freeze({
        supplyReconciliationMismatches: snapshots.economic?.supplyReconciliationMismatches?.toString() ?? '0',
        custodyMismatches: snapshots.custody?.reduce((sum, row) => sum + Number(row.reconciliationMismatches), 0) ?? 0,
      }),
    },
    {
      section: 'events',
      metrics: Object.freeze({
        outboxBacklog: snapshots.events?.outboxBacklog?.toString() ?? '0',
        deadLetterCount: snapshots.events?.deadLetterCount?.toString() ?? '0',
      }),
    },
  ]);
}

export function evaluateActiveAlerts(collectors: OperationsCollectors, nowUtc: string) {
  const snapshots = healthySnapshots();
  evaluateDomainAlerts(collectors.controlRoom.alerts, snapshots, nowUtc);
  return collectors.controlRoom.alerts.active();
}
