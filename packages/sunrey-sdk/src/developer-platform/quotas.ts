import { randomUUID } from 'node:crypto';

import type {
  ApplicationEnvironment,
  DeveloperPermission,
  DeveloperQuota,
  DeveloperUsageRecord,
} from './types.ts';

export const SCOPE_RESOURCE_COST: Readonly<Record<DeveloperPermission, number>> = Object.freeze({
  CHAIN_READ: 1,
  TRANSACTION_SUBMIT: 5,
  WALLET_READ_PUBLIC: 1,
  WEBHOOK_MANAGE: 2,
  MARKET_DATA_READ: 2,
  ORACLE_PUBLIC_READ: 2,
  MACHINE_PUBLIC_READ: 2,
  GOVERNANCE_PUBLIC_READ: 1,
  VALIDATOR_PUBLIC_READ: 1,
  MONETARY_PUBLIC_READ: 1,
  FAUCET_REQUEST: 8,
  SANDBOX_MANAGE: 3,
});

export const DEFAULT_QUOTA: Omit<DeveloperQuota, 'quotaId' | 'appId' | 'environment'> = Object.freeze({
  scope: 'ALL',
  requestLimit: 1_000,
  resourceCostLimit: 5_000,
  faucetQuantityLimit: 1_000_000_000n,
  windowMs: 3_600_000,
});

export type QuotaDecision = 'ALLOW' | 'THROTTLED' | 'EXCEEDED';

export type DeveloperBillingPort = {
  readonly kind: 'FUTURE_METERING';
  recordUsage(record: DeveloperUsageRecord): void;
  /**
   * Commercial charges are out of scope. The port exists so a later
   * authorized billing owner can attach. This method must not exist as
   * a charge path.
   */
  unauthorizedChargeForbidden: true;
};

export function createSimulationBillingPort(): DeveloperBillingPort {
  const records: DeveloperUsageRecord[] = [];
  return {
    kind: 'FUTURE_METERING',
    unauthorizedChargeForbidden: true,
    recordUsage(record) {
      records.push(record);
    },
  };
}

export class QuotaLedger {
  private readonly quotas = new Map<string, DeveloperQuota>();
  private readonly windows = new Map<string, { requests: number; cost: number; faucet: bigint; startedAt: number }>();
  private readonly usage: DeveloperUsageRecord[] = [];
  private readonly billing: DeveloperBillingPort;

  constructor(billing: DeveloperBillingPort = createSimulationBillingPort()) {
    this.billing = billing;
  }

  putQuota(quota: DeveloperQuota): DeveloperQuota {
    this.quotas.set(this.key(quota.appId, quota.environment, quota.scope), quota);
    return quota;
  }

  defaultFor(appId: string, environment: ApplicationEnvironment): DeveloperQuota {
    const existing = this.quotas.get(this.key(appId, environment, 'ALL'));
    if (existing) {
      return existing;
    }
    const created: DeveloperQuota = {
      quotaId: `qta_${randomUUID()}`,
      appId,
      environment,
      ...DEFAULT_QUOTA,
    };
    return this.putQuota(created);
  }

  consume(input: {
    readonly appId: string;
    readonly environment: ApplicationEnvironment;
    readonly scope: DeveloperPermission;
    readonly faucetQuantity?: bigint;
    readonly webhookDeliveries?: number;
    readonly error?: boolean;
    readonly nowMs?: number;
  }): { readonly decision: QuotaDecision; readonly record: DeveloperUsageRecord } {
    const quota = this.quotas.get(this.key(input.appId, input.environment, input.scope))
      ?? this.defaultFor(input.appId, input.environment);
    const nowMs = input.nowMs ?? Date.now();
    const windowKey = `${quota.quotaId}`;
    const current = this.windows.get(windowKey);
    const window = !current || nowMs - current.startedAt >= quota.windowMs
      ? { requests: 0, cost: 0, faucet: 0n, startedAt: nowMs }
      : current;
    const cost = SCOPE_RESOURCE_COST[input.scope];
    const nextRequests = window.requests + 1;
    const nextCost = window.cost + cost;
    const nextFaucet = window.faucet + (input.faucetQuantity ?? 0n);
    let decision: QuotaDecision = 'ALLOW';
    if (nextRequests > quota.requestLimit || nextCost > quota.resourceCostLimit || nextFaucet > quota.faucetQuantityLimit) {
      decision = 'EXCEEDED';
    } else if (nextRequests > quota.requestLimit * 0.9 || nextCost > quota.resourceCostLimit * 0.9) {
      decision = 'THROTTLED';
    }
    if (decision !== 'EXCEEDED') {
      this.windows.set(windowKey, {
        requests: nextRequests,
        cost: nextCost,
        faucet: nextFaucet,
        startedAt: window.startedAt,
      });
    }
    const record: DeveloperUsageRecord = {
      usageId: `use_${randomUUID()}`,
      appId: input.appId,
      environment: input.environment,
      scope: input.scope,
      requestCount: decision === 'EXCEEDED' ? window.requests : nextRequests,
      resourceCost: decision === 'EXCEEDED' ? window.cost : nextCost,
      errorCount: input.error ? 1 : 0,
      webhookDeliveries: input.webhookDeliveries ?? 0,
      rateLimitState: decision === 'ALLOW' ? 'OK' : decision,
      recordedAt: new Date(nowMs).toISOString(),
    };
    this.usage.push(record);
    this.billing.recordUsage(record);
    return { decision, record };
  }

  recordsFor(appId: string): readonly DeveloperUsageRecord[] {
    return this.usage.filter((row) => row.appId === appId);
  }

  private key(appId: string, environment: ApplicationEnvironment, scope: DeveloperPermission | 'ALL'): string {
    return `${appId}:${environment}:${scope}`;
  }
}
