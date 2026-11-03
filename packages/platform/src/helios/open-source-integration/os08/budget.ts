import { err, ok, type Result, type UtcInstant } from '@solstice/domain';
import type {
  ModelProviderCostEntry,
  ResearchTriggerBudgetLimits,
  ResearchTriggerCostAccounting,
} from './types.ts';
import type { TriggerRouterReasonCode } from './taxonomy.ts';

type CustomerLedger = {
  activeRuns: number;
  runsToday: number;
  spentMicros: bigint;
  dayKey: string;
};

type SystemLedger = {
  activeRuns: number;
  runsToday: number;
  spentMicros: bigint;
  dayKey: string;
};

export class ResearchTriggerBudget {
  private readonly limits: ResearchTriggerBudgetLimits;
  private readonly customers = new Map<string, CustomerLedger>();
  private system: SystemLedger = { activeRuns: 0, runsToday: 0, spentMicros: 0n, dayKey: '' };
  private readonly modelCosts: ModelProviderCostEntry[] = [];
  private readonly providerTotals = new Map<string, bigint>();

  constructor(limits: ResearchTriggerBudgetLimits) {
    this.limits = limits;
  }

  snapshot(now: UtcInstant): {
    readonly systemActiveRuns: number;
    readonly systemSpentMicros: string;
    readonly providerTotalsMicros: Readonly<Record<string, string>>;
  } {
    this.rollDayIfNeeded(now);
    const providerTotalsMicros: Record<string, string> = {};
    for (const [provider, total] of this.providerTotals) {
      providerTotalsMicros[provider] = total.toString();
    }
    return Object.freeze({
      systemActiveRuns: this.system.activeRuns,
      systemSpentMicros: this.system.spentMicros.toString(),
      providerTotalsMicros: Object.freeze(providerTotalsMicros),
    });
  }

  beginRun(
    customerId: string,
    now: UtcInstant,
  ): Result<true, { readonly code: TriggerRouterReasonCode; readonly message: string }> {
    this.rollDayIfNeeded(now);
    const customer = this.customerLedger(customerId);
    if (this.system.activeRuns >= this.limits.maxConcurrentRunsSystem) {
      return err({ code: 'SYSTEM_CONCURRENCY_CAP', message: 'system research concurrency cap reached' });
    }
    if (customer.activeRuns >= this.limits.maxConcurrentRunsPerCustomer) {
      return err({ code: 'CUSTOMER_CONCURRENCY_CAP', message: 'customer research concurrency cap reached' });
    }
    if (this.system.runsToday >= this.limits.maxRunsSystemPerDay) {
      return err({ code: 'SYSTEM_DAILY_CAP', message: 'system daily research run cap reached' });
    }
    if (customer.runsToday >= this.limits.maxRunsPerCustomerPerDay) {
      return err({ code: 'CUSTOMER_DAILY_CAP', message: 'customer daily research run cap reached' });
    }
    if (this.system.spentMicros >= this.limits.systemSpendCapMicros) {
      return err({ code: 'SYSTEM_SPEND_CAP', message: 'system research spend cap reached' });
    }
    if (customer.spentMicros >= this.limits.customerSpendCapMicros) {
      return err({ code: 'CUSTOMER_SPEND_CAP', message: 'customer research spend cap reached' });
    }
    this.system.activeRuns += 1;
    this.system.runsToday += 1;
    customer.activeRuns += 1;
    customer.runsToday += 1;
    return ok(true);
  }

  endRun(customerId: string): void {
    const customer = this.customerLedger(customerId);
    if (this.system.activeRuns > 0) {
      this.system.activeRuns -= 1;
    }
    if (customer.activeRuns > 0) {
      customer.activeRuns -= 1;
    }
  }

  recordSpend(customerId: string, cost: ResearchTriggerCostAccounting): Result<true, { readonly code: TriggerRouterReasonCode; readonly message: string }> {
    const customer = this.customerLedger(customerId);
    const nextCustomer = customer.spentMicros + cost.totalCostMicros;
    const nextSystem = this.system.spentMicros + cost.totalCostMicros;
    if (nextCustomer > this.limits.customerSpendCapMicros) {
      return err({ code: 'CUSTOMER_SPEND_CAP', message: 'customer spend cap would be exceeded' });
    }
    if (nextSystem > this.limits.systemSpendCapMicros) {
      return err({ code: 'SYSTEM_SPEND_CAP', message: 'system spend cap would be exceeded' });
    }
    customer.spentMicros = nextCustomer;
    this.system.spentMicros = nextSystem;
    for (const row of cost.modelCosts) {
      this.modelCosts.push(row);
      const prior = this.providerTotals.get(row.provider) ?? 0n;
      this.providerTotals.set(row.provider, prior + row.costMicros);
    }
    return ok(true);
  }

  private customerLedger(customerId: string): CustomerLedger {
    let row = this.customers.get(customerId);
    if (!row) {
      row = { activeRuns: 0, runsToday: 0, spentMicros: 0n, dayKey: '' };
      this.customers.set(customerId, row);
    }
    return row;
  }

  private rollDayIfNeeded(now: UtcInstant): void {
    const dayKey = now.slice(0, 10);
    if (this.system.dayKey !== dayKey) {
      this.system = { activeRuns: this.system.activeRuns, runsToday: 0, spentMicros: this.system.spentMicros, dayKey };
    }
    for (const [customerId, ledger] of this.customers) {
      if (ledger.dayKey !== dayKey) {
        this.customers.set(customerId, {
          ...ledger,
          runsToday: 0,
          dayKey,
        });
      }
    }
  }
}

export function aggregateMeshCost(
  agents: readonly { readonly role: string; readonly modelProvider: string; readonly modelId: string; readonly costMicros: bigint; readonly inputTokens?: number; readonly outputTokens?: number }[],
): ResearchTriggerCostAccounting {
  const modelCosts: ModelProviderCostEntry[] = [];
  const providerTotals = new Map<string, bigint>();
  let total = 0n;
  for (const agent of agents) {
    total += agent.costMicros;
    modelCosts.push(
      Object.freeze({
        provider: agent.modelProvider,
        modelId: agent.modelId,
        costMicros: agent.costMicros,
        inputTokens: agent.inputTokens ?? 0,
        outputTokens: agent.outputTokens ?? 0,
        inferenceCalls: 1,
      }),
    );
    providerTotals.set(agent.modelProvider, (providerTotals.get(agent.modelProvider) ?? 0n) + agent.costMicros);
  }
  const providerTotalsMicros: Record<string, string> = {};
  for (const [provider, micros] of providerTotals) {
    providerTotalsMicros[provider] = micros.toString();
  }
  return Object.freeze({
    totalCostMicros: total,
    modelCosts: Object.freeze(modelCosts),
    providerTotalsMicros: Object.freeze(providerTotalsMicros),
  });
}
