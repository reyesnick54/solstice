import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../../domain/src/time.ts';
import { detectSurveillanceAlerts } from '../../../market-surveillance/src/detectors.ts';
import type { MarketSnapshot, ObservedOrder, ObservedTrade, SurveillanceAlert } from '../../../market-surveillance/src/types.ts';
import type { SelfTradePolicy } from '../taxonomy.ts';
import type { MarketAbuseCase, SurveillanceSeverity } from './types.ts';

export function productizeSelfTradePolicy(policy: SelfTradePolicy): {
  readonly policy: SelfTradePolicy;
  readonly behavior: 'cancel_newest' | 'cancel_oldest' | 'reject';
  readonly documentation: string;
} {
  if (policy === 'CANCEL_OLDEST') {
    return {
      policy,
      behavior: 'cancel_oldest',
      documentation:
        'CANCEL_OLDEST skips the resting self-trade and cancels that older order. Matching continues against other counterparties.',
    };
  }
  if (policy === 'PREVENT' || policy === 'REJECT') {
    return {
      policy,
      behavior: 'reject',
      documentation:
        'REJECT / PREVENT refuse the incoming order when it would self-trade. No fill is produced.',
    };
  }
  return {
    policy,
    behavior: 'cancel_newest',
    documentation:
      'CANCEL_NEWEST / CANCEL_INCOMING cancel the incoming (newest) order when it would self-trade.',
  };
}

export function observeExchangeSnapshot(input: {
  readonly marketId: string;
  readonly orders: readonly ObservedOrder[];
  readonly trades: readonly ObservedTrade[];
  readonly linkedAccounts?: Readonly<Record<string, string>>;
  readonly now: UtcInstant;
}): readonly SurveillanceAlert[] {
  const snapshot: MarketSnapshot = {
    marketId: input.marketId,
    orders: input.orders,
    trades: input.trades,
    linkedAccounts: input.linkedAccounts,
    family: 'DIGITAL_ASSET',
  };
  return detectSurveillanceAlerts(snapshot, input.now);
}

export function openMarketAbuseCase(input: {
  readonly alert: SurveillanceAlert;
  readonly severity?: SurveillanceSeverity;
  readonly orderIds?: readonly string[];
  readonly fillIds?: readonly string[];
}): MarketAbuseCase {
  return Object.freeze({
    caseId: `xcase_${randomUUID().replace(/-/g, '')}`,
    alertId: input.alert.alertId,
    detector: input.alert.kind,
    severity: input.severity ?? severityFor(input.alert.kind),
    marketId: input.alert.marketId,
    accountIds: input.alert.subjectRefs,
    orderIds: Object.freeze([...(input.orderIds ?? input.alert.evidenceRefs)]),
    fillIds: Object.freeze([...(input.fillIds ?? [])]),
    evidenceRefs: input.alert.evidenceRefs,
    legalConclusion: false,
    createdAt: input.alert.createdAt,
  });
}

function severityFor(kind: SurveillanceAlert['kind']): SurveillanceSeverity {
  if (kind === 'WASH_TRADING_PATTERN' || kind === 'SELF_TRADING' || kind === 'PRICE_DISLOCATION') {
    return 'HIGH';
  }
  if (kind === 'SPOOFING_CANDIDATE' || kind === 'LAYERING_CANDIDATE') {
    return 'MEDIUM';
  }
  return 'LOW';
}
