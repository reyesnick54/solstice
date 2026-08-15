import type { UtcInstant } from '../../domain/src/time.ts';
import type { KillSwitchReason } from './types.ts';

export type KillSwitchState = {
  readonly active: boolean;
  readonly reason: KillSwitchReason | null;
  readonly activatedAt: UtcInstant | null;
  readonly blocksNewOrders: true;
  readonly historyImmutable: true;
};

export const INACTIVE_KILL_SWITCH: KillSwitchState = Object.freeze({
  active: false,
  reason: null,
  activatedAt: null,
  blocksNewOrders: true,
  historyImmutable: true,
});

export function activateKillSwitch(reason: KillSwitchReason, at: UtcInstant): KillSwitchState {
  return Object.freeze({
    active: true,
    reason,
    activatedAt: at,
    blocksNewOrders: true,
    historyImmutable: true,
  });
}

export function evaluateKillConditions(input: {
  readonly manualStop?: boolean;
  readonly riskBlocked?: boolean;
  readonly drawdownBreached?: boolean;
  readonly staleMarketData?: boolean;
  readonly modelRetired?: boolean;
  readonly policyChanged?: boolean;
  readonly accountRestricted?: boolean;
  readonly invariantFailed?: boolean;
}): KillSwitchReason | null {
  if (input.manualStop) return 'MANUAL_STOP';
  if (input.riskBlocked) return 'RISK_BLOCK';
  if (input.drawdownBreached) return 'DRAWDOWN_GUARD';
  if (input.staleMarketData) return 'STALE_MARKET_DATA';
  if (input.modelRetired) return 'MODEL_RETIRED';
  if (input.policyChanged) return 'POLICY_CHANGE';
  if (input.accountRestricted) return 'ACCOUNT_RESTRICTION';
  if (input.invariantFailed) return 'INVARIANT_FAILURE';
  return null;
}
