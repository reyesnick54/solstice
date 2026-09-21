import { addMs } from '@solstice/config';
import type { UtcInstant } from '@solstice/domain';
import type {
  MandateRuntimeRegistration,
  RuntimeCycleRecord,
  RuntimeMetricsSnapshot,
  RuntimeStoreSnapshot,
  ScheduledWorkItem,
  SupervisionControl,
} from './types.ts';

function emptyMetrics(): RuntimeMetricsSnapshot {
  return Object.freeze({
    opportunitiesDiscovered: 0,
    opportunitiesRejected: 0,
    strategiesEvaluated: 0,
    tradesExecuted: 0,
    paperTradesExecuted: 0,
    noActionDecisions: 0,
    providerErrors: 0,
    riskBlocks: 0,
    complianceBlocks: 0,
    reconciliationExceptions: 0,
    queueLatencyMsP50: 0,
    queueLatencyMsP99: 0,
    decisionLatencyMsP50: 0,
    decisionLatencyMsP99: 0,
    pendingScheduledWork: 0,
    activeRegistrations: 0,
  });
}

export class InMemoryHeliosRuntimeStore {
  private readonly registrations = new Map<string, MandateRuntimeRegistration>();
  private readonly scheduledWork = new Map<string, ScheduledWorkItem>();
  private readonly idempotencyIndex = new Map<string, string>();
  private readonly cycles = new Map<string, RuntimeCycleRecord>();
  private readonly supervision = new Map<string, SupervisionControl>();
  private metrics = emptyMetrics();
  private queueLatencies: number[] = [];
  private decisionLatencies: number[] = [];
  private shutdownRequested = false;

  putRegistration(registration: MandateRuntimeRegistration): void {
    this.registrations.set(registration.registrationId, registration);
  }

  getRegistration(registrationId: string): MandateRuntimeRegistration | undefined {
    return this.registrations.get(registrationId);
  }

  listActiveRegistrations(): readonly MandateRuntimeRegistration[] {
    return Object.freeze([...this.registrations.values()].filter((row) => row.active));
  }

  listRegistrationsForCustomer(customerId: string): readonly MandateRuntimeRegistration[] {
    return Object.freeze(
      [...this.registrations.values()].filter((row) => row.customerId === customerId),
    );
  }

  putScheduledWork(item: ScheduledWorkItem): ScheduledWorkItem | 'DUPLICATE' {
    const idemKey = `${item.customerId}:${item.idempotencyKey}`;
    const existingId = this.idempotencyIndex.get(idemKey);
    if (existingId) {
      const existing = this.scheduledWork.get(existingId);
      if (existing && existing.state === 'PENDING') {
        return 'DUPLICATE';
      }
    }
    this.scheduledWork.set(item.scheduleId, item);
    this.idempotencyIndex.set(idemKey, item.scheduleId);
    return item;
  }

  getScheduledWork(scheduleId: string): ScheduledWorkItem | undefined {
    return this.scheduledWork.get(scheduleId);
  }

  updateScheduledWork(item: ScheduledWorkItem): void {
    this.scheduledWork.set(item.scheduleId, item);
  }

  listDueWork(now: UtcInstant, customerId?: string): readonly ScheduledWorkItem[] {
    return Object.freeze(
      [...this.scheduledWork.values()]
        .filter((row) => {
          if (row.state !== 'PENDING') return false;
          if (row.dueAt > now) return false;
          if (customerId && row.customerId !== customerId) return false;
          return true;
        })
        .sort((a, b) => (a.dueAt < b.dueAt ? -1 : a.dueAt > b.dueAt ? 1 : 0)),
    );
  }

  recoverExpiredLeases(now: UtcInstant): readonly ScheduledWorkItem[] {
    const recovered: ScheduledWorkItem[] = [];
    for (const row of this.scheduledWork.values()) {
      if (row.state !== 'CLAIMED') continue;
      if (!row.leaseExpiresAt || row.leaseExpiresAt > now) continue;
      const updated = Object.freeze({
        ...row,
        state: 'PENDING' as const,
        leaseWorkerId: null,
        leaseExpiresAt: null,
      });
      this.scheduledWork.set(row.scheduleId, updated);
      recovered.push(updated);
    }
    return Object.freeze(recovered);
  }

  putCycle(cycle: RuntimeCycleRecord): void {
    this.cycles.set(cycle.cycleId, cycle);
  }

  getCycle(cycleId: string): RuntimeCycleRecord | undefined {
    return this.cycles.get(cycleId);
  }

  getIncompleteCycle(registrationId: string): RuntimeCycleRecord | undefined {
    return [...this.cycles.values()].find(
      (row) => row.registrationId === registrationId && row.completedAt === null,
    );
  }

  putSupervision(control: SupervisionControl): void {
    this.supervision.set(`${control.scope}:${control.scopeKey}`, control);
  }

  getSupervision(scope: SupervisionControl['scope'], scopeKey: string): SupervisionControl | undefined {
    return this.supervision.get(`${scope}:${scopeKey}`);
  }

  listSupervision(): readonly SupervisionControl[] {
    return Object.freeze([...this.supervision.values()]);
  }

  requestShutdown(): void {
    this.shutdownRequested = true;
  }

  isShutdownRequested(): boolean {
    return this.shutdownRequested;
  }

  clearShutdown(): void {
    this.shutdownRequested = false;
  }

  recordQueueLatency(ms: number): void {
    this.queueLatencies.push(ms);
    if (this.queueLatencies.length > 500) {
      this.queueLatencies = this.queueLatencies.slice(-500);
    }
  }

  recordDecisionLatency(ms: number): void {
    this.decisionLatencies.push(ms);
    if (this.decisionLatencies.length > 500) {
      this.decisionLatencies = this.decisionLatencies.slice(-500);
    }
  }

  incrementMetric(key: keyof RuntimeMetricsSnapshot, delta = 1): void {
    const current = this.metrics[key];
    if (typeof current === 'number') {
      this.metrics = Object.freeze({ ...this.metrics, [key]: current + delta });
    }
  }

  refreshDerivedMetrics(): void {
    const pending = [...this.scheduledWork.values()].filter((row) => row.state === 'PENDING').length;
    const active = [...this.registrations.values()].filter((row) => row.active).length;
    this.metrics = Object.freeze({
      ...this.metrics,
      pendingScheduledWork: pending,
      activeRegistrations: active,
      queueLatencyMsP50: percentile(this.queueLatencies, 50),
      queueLatencyMsP99: percentile(this.queueLatencies, 99),
      decisionLatencyMsP50: percentile(this.decisionLatencies, 50),
      decisionLatencyMsP99: percentile(this.decisionLatencies, 99),
    });
  }

  metricsSnapshot(): RuntimeMetricsSnapshot {
    this.refreshDerivedMetrics();
    return this.metrics;
  }

  snapshot(): RuntimeStoreSnapshot {
    this.refreshDerivedMetrics();
    return Object.freeze({
      registrations: Object.freeze([...this.registrations.values()]),
      scheduledWork: Object.freeze([...this.scheduledWork.values()]),
      cycles: Object.freeze([...this.cycles.values()]),
      supervision: Object.freeze([...this.supervision.values()]),
      metrics: this.metrics,
      shutdownRequested: this.shutdownRequested,
    });
  }

  static fromSnapshot(snapshot: RuntimeStoreSnapshot): InMemoryHeliosRuntimeStore {
    const store = new InMemoryHeliosRuntimeStore();
    for (const row of snapshot.registrations) {
      store.putRegistration(row);
    }
    for (const row of snapshot.scheduledWork) {
      store.scheduledWork.set(row.scheduleId, row);
      store.idempotencyIndex.set(`${row.customerId}:${row.idempotencyKey}`, row.scheduleId);
    }
    for (const row of snapshot.cycles) {
      store.putCycle(row);
    }
    for (const row of snapshot.supervision) {
      store.putSupervision(row);
    }
    store.metrics = snapshot.metrics;
    store.shutdownRequested = snapshot.shutdownRequested;
    return store;
  }
}

function percentile(values: readonly number[], pct: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((pct / 100) * sorted.length));
  return sorted[index] ?? 0;
}

export function defaultCadenceIntervalMs(profile: string): number {
  switch (profile) {
    case 'CONTINUOUS_CRYPTO':
      return 60_000;
    case 'EQUITY_SESSION':
      return 300_000;
    case 'FUTURES_SESSION':
      return 300_000;
    case 'RECONCILIATION_PERIODIC':
      return 3_600_000;
    case 'RISK_PERIODIC':
      return 900_000;
    default:
      return 300_000;
  }
}

export function computeNextDueAt(now: UtcInstant, profile: string): UtcInstant {
  return addMs(now, defaultCadenceIntervalMs(profile));
}
