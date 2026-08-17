import type { ExchangeAccountId } from './ids.ts';
import type { RiskLimitSet, RiskUsage } from './types-universal.ts';

export const DEFAULT_RISK_LIMITS: RiskLimitSet = Object.freeze({
  maxOpenOrders: 32n,
  maxOutstandingNotional: 10_000_000n,
  maxOutstandingEscrow: 10_000_000n,
  maxCapacityCommitments: 1_000_000n,
  maxProviderConcentrationBps: 8_000n,
  maxOracleConcentrationBps: 8_000n,
  maxInstrumentConcentrationBps: 8_000n,
});

export function emptyRiskUsage(accountId: ExchangeAccountId): RiskUsage {
  return Object.freeze({
    accountId,
    openOrders: 0n,
    outstandingNotional: 0n,
    outstandingEscrow: 0n,
    capacityCommitments: 0n,
    byProvider: {},
    byOracle: {},
    byInstrument: {},
  });
}

function shareBps(part: bigint, total: bigint): bigint {
  if (total <= 0n) {
    return 0n;
  }
  return (part * 10_000n) / total;
}

export function evaluateRiskLimits(
  usage: RiskUsage,
  proposed: {
    readonly openOrdersDelta?: bigint;
    readonly notionalDelta?: bigint;
    readonly escrowDelta?: bigint;
    readonly capacityDelta?: bigint;
    readonly providerId?: string;
    readonly oracleId?: string;
    readonly instrumentId?: string;
  },
  limits: RiskLimitSet = DEFAULT_RISK_LIMITS,
): { readonly allowed: boolean; readonly code: string } {
  const openOrders = usage.openOrders + (proposed.openOrdersDelta ?? 0n);
  if (openOrders > limits.maxOpenOrders) {
    return { allowed: false, code: 'RISK_LIMIT_BREACH' };
  }
  const notional = usage.outstandingNotional + (proposed.notionalDelta ?? 0n);
  if (notional > limits.maxOutstandingNotional) {
    return { allowed: false, code: 'RISK_LIMIT_BREACH' };
  }
  const escrow = usage.outstandingEscrow + (proposed.escrowDelta ?? 0n);
  if (escrow > limits.maxOutstandingEscrow) {
    return { allowed: false, code: 'RISK_LIMIT_BREACH' };
  }
  const capacity = usage.capacityCommitments + (proposed.capacityDelta ?? 0n);
  if (capacity > limits.maxCapacityCommitments) {
    return { allowed: false, code: 'RISK_LIMIT_BREACH' };
  }
  if (proposed.providerId) {
    const next = (usage.byProvider[proposed.providerId] ?? 0n) + (proposed.notionalDelta ?? proposed.capacityDelta ?? 0n);
    const total = Object.values(usage.byProvider).reduce((sum, value) => sum + value, 0n) + (proposed.notionalDelta ?? proposed.capacityDelta ?? 0n);
    if (shareBps(next, total) > limits.maxProviderConcentrationBps && total > 0n && next !== total) {
      return { allowed: false, code: 'RISK_LIMIT_BREACH' };
    }
    if (total > 0n && next === total && shareBps(next, total) > limits.maxProviderConcentrationBps && Object.keys(usage.byProvider).length > 0) {
      return { allowed: false, code: 'RISK_LIMIT_BREACH' };
    }
  }
  if (proposed.oracleId) {
    const next = (usage.byOracle[proposed.oracleId] ?? 0n) + (proposed.notionalDelta ?? 1n);
    const total = Object.values(usage.byOracle).reduce((sum, value) => sum + value, 0n) + (proposed.notionalDelta ?? 1n);
    if (total > 1n && shareBps(next, total) > limits.maxOracleConcentrationBps) {
      return { allowed: false, code: 'RISK_LIMIT_BREACH' };
    }
  }
  if (proposed.instrumentId) {
    const next = (usage.byInstrument[proposed.instrumentId] ?? 0n) + (proposed.notionalDelta ?? proposed.capacityDelta ?? 0n);
    const total = Object.values(usage.byInstrument).reduce((sum, value) => sum + value, 0n) + (proposed.notionalDelta ?? proposed.capacityDelta ?? 0n);
    if (total > 0n && Object.keys(usage.byInstrument).length > 0 && shareBps(next, total) > limits.maxInstrumentConcentrationBps && next !== total) {
      return { allowed: false, code: 'RISK_LIMIT_BREACH' };
    }
  }
  return { allowed: true, code: 'ELIGIBLE' };
}

export function applyRiskUsage(
  usage: RiskUsage,
  proposed: {
    readonly openOrdersDelta?: bigint;
    readonly notionalDelta?: bigint;
    readonly escrowDelta?: bigint;
    readonly capacityDelta?: bigint;
    readonly providerId?: string;
    readonly oracleId?: string;
    readonly instrumentId?: string;
  },
): RiskUsage {
  const bump = (record: Readonly<Record<string, bigint>>, key: string | undefined, delta: bigint): Readonly<Record<string, bigint>> => {
    if (!key || delta === 0n) {
      return record;
    }
    return Object.freeze({ ...record, [key]: (record[key] ?? 0n) + delta });
  };
  return Object.freeze({
    accountId: usage.accountId,
    openOrders: usage.openOrders + (proposed.openOrdersDelta ?? 0n),
    outstandingNotional: usage.outstandingNotional + (proposed.notionalDelta ?? 0n),
    outstandingEscrow: usage.outstandingEscrow + (proposed.escrowDelta ?? 0n),
    capacityCommitments: usage.capacityCommitments + (proposed.capacityDelta ?? 0n),
    byProvider: bump(usage.byProvider, proposed.providerId, proposed.notionalDelta ?? proposed.capacityDelta ?? 0n),
    byOracle: bump(usage.byOracle, proposed.oracleId, proposed.notionalDelta ?? 0n),
    byInstrument: bump(usage.byInstrument, proposed.instrumentId, proposed.notionalDelta ?? proposed.capacityDelta ?? 0n),
  });
}
