import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../domain/src/time.ts';
import type { MarketSnapshot, SurveillanceAlert } from './types.ts';

function alert(
  kind: SurveillanceAlert['kind'],
  marketId: string,
  subjectRefs: readonly string[],
  evidenceRefs: readonly string[],
  createdAt: UtcInstant,
): SurveillanceAlert {
  return Object.freeze({
    alertId: `sal_${randomUUID().replace(/-/g, '')}`,
    kind,
    marketId,
    subjectRefs,
    evidenceRefs,
    outputClass: 'CANDIDATE_ALERT',
    legalConclusion: false,
    createdAt,
  });
}

export function detectSurveillanceAlerts(snapshot: MarketSnapshot, now: UtcInstant): readonly SurveillanceAlert[] {
  const alerts: SurveillanceAlert[] = [];
  const linked = snapshot.linkedAccounts ?? {};

  for (const trade of snapshot.trades) {
    if (trade.makerParticipantId === trade.takerParticipantId) {
      alerts.push(
        alert('SELF_TRADING', snapshot.marketId, [trade.makerParticipantId], [trade.tradeId], now),
      );
    }
    const makerLink = linked[trade.makerAccountId];
    const takerLink = linked[trade.takerAccountId];
    if (makerLink && takerLink && makerLink === takerLink && trade.makerParticipantId !== trade.takerParticipantId) {
      alerts.push(
        alert(
          'COORDINATED_ACCOUNTS_CANDIDATE',
          snapshot.marketId,
          [trade.makerAccountId, trade.takerAccountId],
          [trade.tradeId],
          now,
        ),
      );
      alerts.push(
        alert(
          'WASH_TRADING_PATTERN',
          snapshot.marketId,
          [trade.makerAccountId, trade.takerAccountId],
          [trade.tradeId],
          now,
        ),
      );
    }
  }

  const cancelled = snapshot.orders.filter((order) => order.status === 'CANCELLED');
  if (cancelled.length >= 3) {
    alerts.push(
      alert(
        'ORDER_CANCEL_BURST',
        snapshot.marketId,
        [...new Set(cancelled.map((order) => order.accountId))],
        cancelled.map((order) => order.orderId),
        now,
      ),
    );
  }

  const largeCancelled = cancelled.filter((order) => order.quantity >= 5n);
  const oppositeTrades = snapshot.trades.filter((trade) =>
    largeCancelled.some(
      (order) =>
        order.accountId !== trade.takerAccountId &&
        order.side !==
          (snapshot.orders.find((candidate) => candidate.orderId === trade.takerOrderId)?.side ?? order.side),
    ),
  );
  if (largeCancelled.length >= 2 && oppositeTrades.length >= 1) {
    alerts.push(
      alert(
        'LAYERING_CANDIDATE',
        snapshot.marketId,
        [...new Set(largeCancelled.map((order) => order.accountId))],
        largeCancelled.map((order) => order.orderId),
        now,
      ),
    );
    alerts.push(
      alert(
        'SPOOFING_CANDIDATE',
        snapshot.marketId,
        [...new Set(largeCancelled.map((order) => order.accountId))],
        largeCancelled.map((order) => order.orderId),
        now,
      ),
    );
  }

  const volume = snapshot.trades.reduce((sum, trade) => sum + trade.quantity, 0n);
  if (volume >= 20n) {
    alerts.push(
      alert(
        'ABNORMAL_VOLUME',
        snapshot.marketId,
        snapshot.trades.map((trade) => trade.takerAccountId),
        snapshot.trades.map((trade) => trade.tradeId),
        now,
      ),
    );
  }

  if (snapshot.trades.length >= 2) {
    const first = snapshot.trades[0]!.priceUnits;
    const last = snapshot.trades[snapshot.trades.length - 1]!.priceUnits;
    if (last > first * 2n || first > last * 2n) {
      alerts.push(
        alert(
          'PRICE_DISLOCATION',
          snapshot.marketId,
          snapshot.trades.map((trade) => trade.tradeId),
          snapshot.trades.map((trade) => trade.tradeId),
          now,
        ),
      );
    }
  }

  if ((snapshot.circularPairs ?? []).length > 0) {
    for (const pair of snapshot.circularPairs ?? []) {
      alerts.push(alert('CIRCULAR_TRADING_CANDIDATE', snapshot.marketId, [pair.a, pair.b], [snapshot.marketId], now));
    }
  }
  if (
    snapshot.listedCapacity !== undefined &&
    snapshot.deliveredCapacity !== undefined &&
    snapshot.listedCapacity > 0n &&
    snapshot.deliveredCapacity > snapshot.listedCapacity
  ) {
    alerts.push(
      alert('ARTIFICIAL_CAPACITY_CANDIDATE', snapshot.marketId, [snapshot.marketId], ['listed-vs-delivered'], now),
    );
  }
  if ((snapshot.nonDeliveryCount ?? 0) >= 3) {
    alerts.push(
      alert('REPEATED_NON_DELIVERY_CANDIDATE', snapshot.marketId, [snapshot.marketId], ['non-delivery'], now),
    );
    alerts.push(
      alert('DELIVERY_MANIPULATION_CANDIDATE', snapshot.marketId, [snapshot.marketId], ['non-delivery'], now),
    );
  }
  const shares = snapshot.oracleProviderShares ?? {};
  const totalShare = Object.values(shares).reduce((sum, value) => sum + value, 0n);
  for (const [provider, share] of Object.entries(shares)) {
    if (totalShare > 0n && share * 100n > totalShare * 80n) {
      alerts.push(alert('ORACLE_CONCENTRATION_CANDIDATE', snapshot.marketId, [provider], [provider], now));
    }
  }
  if ((snapshot.unauthorizedPurposeAttempts ?? []).length > 0) {
    alerts.push(
      alert(
        'UNAUTHORIZED_PURPOSE_ATTEMPT',
        snapshot.marketId,
        snapshot.unauthorizedPurposeAttempts ?? [],
        snapshot.unauthorizedPurposeAttempts ?? [],
        now,
      ),
    );
  }
  if ((snapshot.consentMismatches ?? []).length > 0) {
    alerts.push(
      alert(
        'CONSENT_MISMATCH_CANDIDATE',
        snapshot.marketId,
        snapshot.consentMismatches ?? [],
        snapshot.consentMismatches ?? [],
        now,
      ),
    );
  }
  if ((snapshot.deniedAccessCount ?? 0) >= 3) {
    alerts.push(alert('REPEATED_DENIED_ACCESS', snapshot.marketId, [snapshot.marketId], ['denied-access'], now));
  }

  return Object.freeze(alerts);
}
