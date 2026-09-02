/**
 * Wave 8 — sandbox operations plane orchestrator.
 */

import { asUtcInstant } from '../../../../packages/domain/src/time.ts';
import { controlRoomReport } from '../../../../packages/sunrey-chain/src/ops/control-room/report.ts';
import { healthySnapshots } from '../../../../packages/sunrey-chain/src/ops/control-room/fixtures.ts';
import type { PlatformApiConfig } from '../config.ts';
import type { ReadinessReport } from '../readiness.ts';
import {
  collectDashboardSections,
  collectChainStatus,
  collectSupplyMetrics,
  createOperationsCollectors,
  evaluateActiveAlerts,
  type OperationsCollectors,
} from './collectors.ts';
import { evaluateSandboxFeatureGates } from './feature-gates.ts';
import { evaluateServiceHealth } from './health.ts';
import { buildSandboxSeedCatalog } from './sandbox-seed.ts';
import type { OperationsDashboard } from './types.ts';

const NOW = asUtcInstant('2026-09-02T12:00:00.000Z');

export class SandboxOperationsPlane {
  readonly collectors: OperationsCollectors;

  constructor(collectors: OperationsCollectors = createOperationsCollectors()) {
    this.collectors = collectors;
  }

  productHealth(config: PlatformApiConfig, readiness: ReadinessReport, persistenceConfigured = false) {
    return evaluateServiceHealth({
      config,
      readiness,
      collectors: this.collectors,
      persistenceConfigured,
    });
  }

  dashboard(): OperationsDashboard {
    return Object.freeze({
      schema: 'sunrey.ops.dashboard.v1',
      environment: 'simulation',
      productionActive: false,
      sections: collectDashboardSections(this.collectors),
    });
  }

  chainStatus() {
    return collectChainStatus(this.collectors.chain);
  }

  economicAwarenessHealth() {
    const aggregate = this.collectors.providerPlane.aggregateHealth();
    return Object.freeze({
      surface: 'INTERNAL',
      consumerSafe: false,
      schema: 'sunrey.ops.economic-awareness.v1',
      environment: 'simulation',
      productionActive: false,
      providers: aggregate,
      dependencies: this.collectors.providerPlane.dependencyStatus(),
      observationIngestion: 'SIMULATION',
      informationConsensus: 'INPUT_ONLY',
    });
  }

  claimQueues() {
    const challenges = [...this.collectors.productiveOps.challenges.values()];
    return Object.freeze({
      schema: 'sunrey.ops.claim-queues.v1',
      humanClaims: Object.freeze([
        { claimId: 'claim.sandbox.hin.001', status: 'PENDING_REVIEW', queue: 'human_economy' },
        { claimId: 'claim.sandbox.hin.002', status: 'CORROBORATION', queue: 'human_economy' },
      ]),
      productiveClaims: Object.freeze([
        { claimId: 'claim.sandbox.productive.001', status: 'CHALLENGED', queue: 'productive_economy' },
      ]),
      totalOpen: 2 + challenges.filter((row) => row.status === 'OPEN' || row.status === 'UNDER_REVIEW').length,
    });
  }

  challengeQueues() {
    const challenges = [...this.collectors.productiveOps.challenges.values()];
    return Object.freeze({
      schema: 'sunrey.ops.challenge-queues.v1',
      open: challenges.filter((row) => row.status === 'OPEN' || row.status === 'UNDER_REVIEW'),
      resolved: challenges.filter((row) => row.status !== 'OPEN' && row.status !== 'UNDER_REVIEW'),
    });
  }

  identityReviewQueue() {
    return Object.freeze({
      schema: 'sunrey.ops.identity-review.v1',
      simulationOnly: true,
      pending: Object.freeze([
        { reviewId: 'idrev.sandbox.001', actorId: 'actor.sandbox.grow_heavy', reason: 'ENHANCED_DUE_DILIGENCE', status: 'OPEN' },
        { reviewId: 'idrev.sandbox.002', actorId: 'actor.sandbox.vault_health', reason: 'DOCUMENT_REFRESH', status: 'OPEN' },
      ]),
    });
  }

  policyStatus() {
    return Object.freeze({
      schema: 'sunrey.ops.policy-status.v1',
      productionActive: false,
      productionAuthorized: false,
      moonreyIssuanceActive: false,
      sunreyIssuanceActive: false,
      manualReviewRequired: false,
      policyVersion: 'sandbox-simulation-v1',
    });
  }

  circuitBreakers() {
    const open = this.collectors.productiveOps.domainCircuits.pausedDomains();
    return Object.freeze({
      schema: 'sunrey.ops.circuit-breakers.v1',
      openDomains: open,
      totalOpen: open.length,
    });
  }

  reconciliation() {
    const supply = collectSupplyMetrics();
    const snapshots = healthySnapshots();
    return Object.freeze({
      schema: 'sunrey.ops.reconciliation.v1',
      supply,
      custodyMismatches: snapshots.custody?.reduce((sum, row) => sum + Number(row.reconciliationMismatches), 0) ?? 0,
      exchangeMismatches: Number(snapshots.exchange?.reconciliationMismatches ?? 0n),
    });
  }

  agentOperations() {
    const snapshots = healthySnapshots();
    return Object.freeze({
      schema: 'sunrey.ops.agent-operations.v1',
      proposalGateOnly: true,
      executionAuthorityIssued: false,
      authorityAttempts: snapshots.aiSafety?.length ?? 0,
      mandatesActive: 3,
      simulationOnly: true,
    });
  }

  featureGates(nowUtc = NOW) {
    return evaluateSandboxFeatureGates(nowUtc);
  }

  seedCatalog() {
    return buildSandboxSeedCatalog();
  }

  controlRoom() {
    const snapshots = healthySnapshots();
    return controlRoomReport({ snapshots, incidents: this.collectors.controlRoom.incidents() });
  }

  alerts(nowUtc = NOW) {
    return Object.freeze({
      schema: 'sunrey.ops.alerts.v1',
      realAlertProviderConnected: false,
      active: evaluateActiveAlerts(this.collectors, nowUtc),
    });
  }
}

export function createSandboxOperationsPlane(): SandboxOperationsPlane {
  return new SandboxOperationsPlane();
}
