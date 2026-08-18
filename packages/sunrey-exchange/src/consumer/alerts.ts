import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { ExchangeMarketId } from '../ids.ts';
import type { ConsumerFavoriteMarket, ConsumerPriceAlert } from './types.ts';
import type { ValueSourceKind } from './taxonomy.ts';

export function createFavoriteMarket(input: {
  readonly participantId: string;
  readonly marketId: ExchangeMarketId;
}): ConsumerFavoriteMarket {
  return Object.freeze({
    favoriteId: `cfav_${randomUUID().replace(/-/g, '')}`,
    participantId: input.participantId,
    marketId: input.marketId,
    applicationMetadata: true,
  });
}

export function createPriceAlert(input: {
  readonly participantId: string;
  readonly marketId: ExchangeMarketId;
  readonly direction: 'ABOVE' | 'BELOW';
  readonly thresholdPriceUnits: bigint;
  readonly source: ValueSourceKind;
  readonly marketDataSequence: bigint;
  readonly now: UtcInstant;
  readonly autoTrade?: boolean;
}): { readonly ok: true; readonly alert: ConsumerPriceAlert } | { readonly ok: false; readonly reason: string } {
  if (input.autoTrade) {
    return Object.freeze({ ok: false, reason: 'PRICE_ALERT_CANNOT_TRADE' });
  }
  return Object.freeze({
    ok: true,
    alert: Object.freeze({
      alertId: `calert_${randomUUID().replace(/-/g, '')}`,
      participantId: input.participantId,
      marketId: input.marketId,
      direction: input.direction,
      thresholdPriceUnits: input.thresholdPriceUnits,
      source: input.source,
      marketDataSequence: input.marketDataSequence,
      observedAt: input.now,
      informational: true,
      canTradeAutomatically: false,
    }),
  });
}

export function alertTriggered(alert: ConsumerPriceAlert, priceUnits: bigint): boolean {
  return alert.direction === 'ABOVE' ? priceUnits >= alert.thresholdPriceUnits : priceUnits <= alert.thresholdPriceUnits;
}
