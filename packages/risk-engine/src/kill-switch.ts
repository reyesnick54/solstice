import type { KillSwitchScope } from '../../contracts/src/risk-types.ts';

export type KillSwitchRecord = {
  readonly scope: KillSwitchScope;
  readonly reason: string;
  readonly operatorId: string;
  readonly engagedAt: string;
};

/**
 * Kill switches are operable with no AI component running.
 * They are a plain in-memory board — no model, agent, or LLM is imported.
 */
export class KillSwitchBoard {
  private readonly engaged: KillSwitchRecord[] = [];

  engage(scope: KillSwitchScope, reason: string, operatorId: string, engagedAt: string): void {
    this.engaged.push(Object.freeze({ scope, reason, operatorId, engagedAt }));
  }

  isEngaged(scope: KillSwitchScope): boolean {
    return this.engaged.some((record) => matches(record.scope, scope));
  }

  tradingHalted(): boolean {
    return this.engaged.some(
      (record) =>
        record.scope.kind === 'ALL_TRADING' || record.scope.kind === 'BROKER_CONNECTIVITY',
    );
  }

  strategyHalted(strategyId: string): boolean {
    if (this.tradingHalted()) return true;
    return this.engaged.some(
      (record) => record.scope.kind === 'STRATEGY' && record.scope.strategyId === strategyId,
    );
  }

  agentRuntimeHalted(): boolean {
    return this.engaged.some((record) => record.scope.kind === 'AGENT_RUNTIME');
  }

  list(): readonly KillSwitchRecord[] {
    return this.engaged.slice();
  }
}

function matches(a: KillSwitchScope, b: KillSwitchScope): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'STRATEGY' && b.kind === 'STRATEGY') {
    return a.strategyId === b.strategyId;
  }
  return true;
}
