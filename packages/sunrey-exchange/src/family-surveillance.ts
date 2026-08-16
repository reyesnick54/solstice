import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../domain/src/time.ts';

export type FamilySurveillanceAlert = {
  readonly alertId: string;
  readonly kind: string;
  readonly marketId: string;
  readonly subjectRefs: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly outputClass: 'CANDIDATE_ALERT';
  readonly legalConclusion: false;
  readonly createdAt: UtcInstant;
};

export type FamilySurveillanceSnapshot = {
  readonly marketId: string;
  readonly family?: string;
  readonly deniedAccessCount?: number;
  readonly unauthorizedPurposeAttempts?: readonly string[];
  readonly consentMismatches?: readonly string[];
  readonly nonDeliveryCount?: number;
  readonly listedCapacity?: bigint;
  readonly deliveredCapacity?: bigint;
  readonly oracleProviderShares?: Readonly<Record<string, bigint>>;
  readonly circularPairs?: readonly { readonly a: string; readonly b: string }[];
  readonly selfTrades?: readonly string[];
};

function alert(
  kind: string,
  marketId: string,
  subjectRefs: readonly string[],
  evidenceRefs: readonly string[],
  createdAt: UtcInstant,
): FamilySurveillanceAlert {
  return Object.freeze({
    alertId: `xsal_${randomUUID().replace(/-/g, '')}`,
    kind,
    marketId,
    subjectRefs,
    evidenceRefs,
    outputClass: 'CANDIDATE_ALERT',
    legalConclusion: false,
    createdAt,
  });
}

/**
 * Family-specific candidate alerts. Complements packages/market-surveillance
 * without importing it (exchange may not depend on that package).
 */
export function observeFamilyMarket(
  snapshot: FamilySurveillanceSnapshot,
  now: UtcInstant,
): readonly FamilySurveillanceAlert[] {
  const alerts: FamilySurveillanceAlert[] = [];
  for (const pair of snapshot.circularPairs ?? []) {
    alerts.push(alert('CIRCULAR_TRADING_CANDIDATE', snapshot.marketId, [pair.a, pair.b], [snapshot.marketId], now));
  }
  if (
    snapshot.listedCapacity !== undefined &&
    snapshot.deliveredCapacity !== undefined &&
    snapshot.listedCapacity > 0n &&
    snapshot.deliveredCapacity > snapshot.listedCapacity
  ) {
    alerts.push(alert('ARTIFICIAL_CAPACITY_CANDIDATE', snapshot.marketId, [snapshot.marketId], ['listed-vs-delivered'], now));
  }
  if ((snapshot.nonDeliveryCount ?? 0) >= 3) {
    alerts.push(alert('REPEATED_NON_DELIVERY_CANDIDATE', snapshot.marketId, [snapshot.marketId], ['non-delivery'], now));
    alerts.push(alert('DELIVERY_MANIPULATION_CANDIDATE', snapshot.marketId, [snapshot.marketId], ['non-delivery'], now));
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
  for (const tradeId of snapshot.selfTrades ?? []) {
    alerts.push(alert('SELF_TRADING', snapshot.marketId, [tradeId], [tradeId], now));
  }
  return Object.freeze(alerts);
}
