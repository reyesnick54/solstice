/**
 * EXEC01 — regulated market access overlay for external broker order entry (simulation).
 */

import type { ExchangeKillSwitchScope } from './kill-switches.ts';

export const EXEC01_BROKER_ORDER_ENTRY_KILL_SCOPE: ExchangeKillSwitchScope = 'ORDER_ENTRY';

export const EXEC01_BROKER_SETTLEMENT_KILL_SCOPE: ExchangeKillSwitchScope = 'SETTLEMENT';

export type Exec01BrokerMarketAccessOverlay = {
  readonly overlayKind: 'EXEC01_BROKER_MARKET_ACCESS';
  readonly brokerProviderId: string;
  readonly marketAccessEvaluated: boolean;
  readonly orderEntryPermitted: false;
  readonly productionActivated: false;
  readonly legalAuthorizationImplied: false;
};

export function exec01BrokerMarketAccessOverlay(brokerProviderId: string): Exec01BrokerMarketAccessOverlay {
  return Object.freeze({
    overlayKind: 'EXEC01_BROKER_MARKET_ACCESS',
    brokerProviderId,
    marketAccessEvaluated: true,
    orderEntryPermitted: false,
    productionActivated: false,
    legalAuthorizationImplied: false,
  });
}
