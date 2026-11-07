/**
 * EXEC13 scoped kill switches — deterministic, auditable; agents cannot disable.
 */

import { createHash } from 'node:crypto';

import type { HeliosSupervisionScope } from '../../continuous-runtime/taxonomy.ts';
import {
  EXEC13_KILL_SWITCH_STATE_BY_MODE,
  type Exec13KillSwitchMode,
  type Exec13KillSwitchScope,
  type Exec13ResilienceState,
} from './taxonomy.ts';
import type { Exec13KillSwitchRecord, Exec13KillSwitchTarget } from './types.ts';

export const EXEC13_STATE_RANK: Record<Exec13ResilienceState, number> = {
  NORMAL: 0,
  PAUSE_NEW: 1,
  BROKER_DEGRADED: 2,
  CANCEL_ONLY: 3,
  EXIT_ONLY: 4,
  RECONCILIATION_REQUIRED: 5,
  FAILED_SAFE: 6,
};

export function maxExec13ResilienceState(
  left: Exec13ResilienceState,
  right: Exec13ResilienceState,
): Exec13ResilienceState {
  return EXEC13_STATE_RANK[left] >= EXEC13_STATE_RANK[right] ? left : right;
}

function auditDigest(input: {
  readonly scope: Exec13KillSwitchScope;
  readonly target: string;
  readonly mode: Exec13KillSwitchMode;
  readonly reason: string;
  readonly activationSequence: number;
  readonly activatedAt: string;
}): string {
  const payload = JSON.stringify(input);
  return createHash('sha256').update(payload).digest('hex');
}

export class Exec13KillSwitchRegistry {
  private readonly switches = new Map<string, Exec13KillSwitchRecord>();
  private sequence = 0;

  activate(input: {
    readonly scope: Exec13KillSwitchScope;
    readonly target: string;
    readonly mode: Exec13KillSwitchMode;
    readonly reason: string;
    readonly actorKind: 'HUMAN_OPERATOR' | 'SYSTEM';
    readonly activatedAt: string;
    readonly killSwitchId?: string;
  }): Exec13KillSwitchRecord {
    this.sequence += 1;
    const killSwitchId = input.killSwitchId ?? `exec13_ks_${input.scope}_${input.target}_${this.sequence}`;
    const row: Exec13KillSwitchRecord = Object.freeze({
      killSwitchId,
      scope: input.scope,
      target: input.target,
      mode: input.mode,
      enabled: true,
      reason: input.reason,
      actorKind: input.actorKind,
      activatedAt: input.activatedAt,
      activationSequence: this.sequence,
      auditDigest: auditDigest({
        scope: input.scope,
        target: input.target,
        mode: input.mode,
        reason: input.reason,
        activationSequence: this.sequence,
        activatedAt: input.activatedAt,
      }),
    });
    this.switches.set(killSwitchId, row);
    return row;
  }

  deactivate(input: {
    readonly killSwitchId: string;
    readonly actorKind: 'HUMAN_OPERATOR' | 'SYSTEM' | 'AGENT';
  }): { readonly ok: true } | { readonly ok: false; readonly code: 'AGENT_CANNOT_DISABLE_KILL_SWITCH' } {
    if (input.actorKind === 'AGENT') {
      return Object.freeze({ ok: false, code: 'AGENT_CANNOT_DISABLE_KILL_SWITCH' });
    }
    const existing = this.switches.get(input.killSwitchId);
    if (!existing) {
      return Object.freeze({ ok: true });
    }
    this.switches.set(
      input.killSwitchId,
      Object.freeze({ ...existing, enabled: false }),
    );
    return Object.freeze({ ok: true });
  }

  listActive(): readonly Exec13KillSwitchRecord[] {
    return Object.freeze([...this.switches.values()].filter((row) => row.enabled));
  }

  evaluateConnectivityState(target: Exec13KillSwitchTarget): {
    readonly state: Exec13ResilienceState;
    readonly reasons: readonly string[];
  } {
    let state: Exec13ResilienceState = 'NORMAL';
    const reasons: string[] = [];

    for (const row of this.listActive()) {
      if (!matchesKillSwitchTarget(row, target)) {
        continue;
      }
      const mapped = EXEC13_KILL_SWITCH_STATE_BY_MODE[row.mode];
      state = maxExec13ResilienceState(state, mapped);
      reasons.push(`${row.scope}:${row.target}:${row.mode}`);
    }

    return Object.freeze({ state, reasons: Object.freeze(reasons) });
  }
}

function matchesKillSwitchTarget(
  row: Exec13KillSwitchRecord,
  target: Exec13KillSwitchTarget,
): boolean {
  switch (row.scope) {
    case 'global':
      return row.target === 'GLOBAL' || target.global === true;
    case 'provider':
      return target.providerId !== undefined && row.target === target.providerId;
    case 'account':
      return target.accountId !== undefined && row.target === target.accountId;
    case 'strategy':
      return target.strategyId !== undefined && row.target === target.strategyId;
    case 'instrument':
      return target.instrumentId !== undefined && row.target === target.instrumentId;
    case 'market':
      return target.marketId !== undefined && row.target === target.marketId;
    case 'customer':
      return target.customerId !== undefined && row.target === target.customerId;
    default:
      return false;
  }
}

/** Map EXEC13 kill-switch scopes onto existing continuous-runtime supervision scopes. */
export function exec13ScopeToSupervisionScope(
  scope: Exec13KillSwitchScope,
): HeliosSupervisionScope | null {
  switch (scope) {
    case 'global':
      return 'GLOBAL';
    case 'customer':
      return 'CUSTOMER';
    case 'strategy':
      return 'STRATEGY';
    case 'instrument':
      return 'INSTRUMENT';
    case 'provider':
      return 'PROVIDER';
    case 'account':
    case 'market':
      return null;
    default:
      return null;
  }
}

export function supervisionTargetForKillSwitch(
  scope: Exec13KillSwitchScope,
  target: string,
): string {
  if (scope === 'global') {
    return '*';
  }
  return target;
}
