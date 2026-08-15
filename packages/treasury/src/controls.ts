import type { Money } from '../../money/src/money.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import type {
  ConcentrationSnapshotId,
  KillSwitchId,
  SettlementExposureId,
  TreasuryAccountId,
} from './ids.ts';
import {
  CONCENTRATION_THRESHOLD_NOTE,
  type KillSwitchScope,
  type SettlementRiskState,
} from './types.ts';

export type KillSwitch = {
  readonly killSwitchId: KillSwitchId;
  readonly scope: KillSwitchScope;
  readonly target: string;
  readonly enabled: boolean;
  readonly reason: string;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

export type ConcentrationSnapshot = {
  readonly snapshotId: ConcentrationSnapshotId;
  readonly dimension: 'provider' | 'bank' | 'rail' | 'corridor' | 'currency' | 'legal_entity';
  readonly key: string;
  readonly exposureMinorUnits: bigint;
  readonly currency: string;
  readonly thresholdMinorUnits: bigint;
  readonly ratioBps: bigint;
  readonly thresholdNote: typeof CONCENTRATION_THRESHOLD_NOTE;
  readonly capturedAt: UtcInstant;
};

export type SettlementExposure = {
  readonly exposureId: SettlementExposureId;
  readonly kind:
    | 'SUBMITTED_UNSETTLED'
    | 'SUBMISSION_UNKNOWN'
    | 'PROVIDER'
    | 'PENDING_RETURN'
    | 'PENDING_FX'
    | 'CORRIDOR';
  readonly key: string;
  readonly amount: Money;
  readonly state: SettlementRiskState;
  readonly paymentId: string | null;
  readonly updatedAt: UtcInstant;
};

export function nextSettlementState(
  current: SettlementRiskState,
  event: 'ELEVATE' | 'RESTRICT' | 'HALT' | 'NORMALIZE',
): SettlementRiskState {
  if (event === 'HALT') {
    return 'HALTED';
  }
  if (event === 'NORMALIZE') {
    return 'NORMAL';
  }
  if (event === 'RESTRICT') {
    return current === 'HALTED' ? 'HALTED' : 'RESTRICTED';
  }
  if (current === 'HALTED' || current === 'RESTRICTED') {
    return current;
  }
  return 'ELEVATED';
}

export function killSwitchBlocks(
  switches: readonly KillSwitch[],
  target: {
    readonly provider: string;
    readonly rail: string;
    readonly corridorId: string;
    readonly treasuryAccountId: string | null;
    readonly sourceCurrency: string;
    readonly destinationCurrency: string;
  },
): string | null {
  for (const row of switches) {
    if (!row.enabled) {
      continue;
    }
    if (row.scope === 'HALT_RESERVATIONS') {
      return 'halt_reservations';
    }
    if (row.scope === 'RECONCILIATION_ONLY') {
      return 'reconciliation_only';
    }
    if (row.scope === 'PROVIDER' && row.target === target.provider) {
      return 'provider_disabled';
    }
    if (row.scope === 'RAIL' && row.target === target.rail) {
      return 'rail_disabled';
    }
    if (row.scope === 'CORRIDOR' && row.target === target.corridorId) {
      return 'corridor_disabled';
    }
    if (row.scope === 'SETTLEMENT_ACCOUNT' && row.target === target.treasuryAccountId) {
      return 'settlement_account_disabled';
    }
    if (
      row.scope === 'CURRENCY_ROUTE' &&
      row.target === `${target.sourceCurrency}:${target.destinationCurrency}`
    ) {
      return 'currency_route_disabled';
    }
  }
  return null;
}

export function concentrationOf(
  snapshotId: ConcentrationSnapshotId,
  dimension: ConcentrationSnapshot['dimension'],
  key: string,
  exposure: Money,
  thresholdMinorUnits: bigint,
  capturedAt: UtcInstant,
): ConcentrationSnapshot {
  const ratioBps =
    thresholdMinorUnits === 0n ? 0n : (exposure.minorUnits * 10_000n) / thresholdMinorUnits;
  return Object.freeze({
    snapshotId,
    dimension,
    key,
    exposureMinorUnits: exposure.minorUnits,
    currency: exposure.currency,
    thresholdMinorUnits,
    ratioBps,
    thresholdNote: CONCENTRATION_THRESHOLD_NOTE,
    capturedAt,
  });
}

export function freezeKillSwitch(row: KillSwitch): KillSwitch {
  return Object.freeze({ ...row });
}

export type KillSwitchTarget = {
  readonly treasuryAccountId?: TreasuryAccountId;
};
