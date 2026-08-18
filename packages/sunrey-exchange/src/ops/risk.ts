import type { ExchangeAccountId, ExchangeMarketId } from '../ids.ts';
import { engageExchangeKillSwitch, type ExchangeKillSwitch } from '../regulated/kill-switches.ts';
import { evaluateMarketAccess, type MarketAccessInput } from '../regulated/market-access.ts';
import { familyFullyOperational, type CanonicalMarketFamily } from './taxonomy.ts';
import { priceWithinCollar } from './reference-price.ts';
import type { MarketRiskControl, OrderRatePolicy, TradingCredential } from './types.ts';

export type RateWindow = {
  readonly orders: number[];
  readonly cancels: number[];
  readonly openOrders: bigint;
  readonly exposure: bigint;
};

export function emptyRateWindow(): RateWindow {
  return { orders: [], cancels: [], openOrders: 0n, exposure: 0n };
}

export function defaultOrderRatePolicy(
  participantId: string,
  accountId: ExchangeAccountId,
  marketId: ExchangeMarketId,
): OrderRatePolicy {
  return Object.freeze({
    participantId,
    accountId,
    marketId,
    ordersPerSecond: 20n,
    cancelsPerSecond: 40n,
    maxOpenOrders: 64n,
    maxQuantity: 1_000_000_000n,
    maxNotional: 10_000_000_000n,
  });
}

export function recordRateEvent(window: RateWindow, kind: 'ORDER' | 'CANCEL', nowMs: number): RateWindow {
  const cutoff = nowMs - 1000;
  const nextOrders = window.orders.filter((ts) => ts >= cutoff);
  const nextCancels = window.cancels.filter((ts) => ts >= cutoff);
  if (kind === 'ORDER') {
    nextOrders.push(nowMs);
  } else {
    nextCancels.push(nowMs);
  }
  return { orders: nextOrders, cancels: nextCancels, openOrders: window.openOrders, exposure: window.exposure };
}

export function evaluateOrderRate(
  policy: OrderRatePolicy,
  window: RateWindow,
  kind: 'ORDER' | 'CANCEL',
): { readonly allowed: boolean; readonly code: string } {
  if (kind === 'ORDER' && BigInt(window.orders.length) > policy.ordersPerSecond) {
    return { allowed: false, code: 'ORDER_RATE_EXCEEDED' };
  }
  if (kind === 'CANCEL' && BigInt(window.cancels.length) > policy.cancelsPerSecond) {
    return { allowed: false, code: 'CANCEL_RATE_EXCEEDED' };
  }
  if (kind === 'ORDER' && window.openOrders >= policy.maxOpenOrders) {
    return { allowed: false, code: 'OPEN_ORDER_LIMIT' };
  }
  return { allowed: true, code: 'OK' };
}

export function evaluatePreTradeRisk(input: {
  readonly family: CanonicalMarketFamily;
  readonly credential: TradingCredential;
  readonly access: MarketAccessInput;
  readonly accountRestricted: boolean;
  readonly reservationAvailable: boolean;
  readonly quantity: bigint;
  readonly notional: bigint;
  readonly rate: OrderRatePolicy;
  readonly window: RateWindow;
  readonly priceUnits: bigint | null;
  readonly referenceUnits: bigint | null;
  readonly collarBps: bigint;
  readonly killSwitches: readonly ExchangeKillSwitch[];
  readonly marketId: string;
  readonly settlementHealthy: boolean;
  readonly custodyHealthy: boolean;
  readonly referenceAvailable: boolean;
}): MarketRiskControl {
  const reasons: string[] = [];
  const access = evaluateMarketAccess(input.access);
  const participantEligible = access.allowed;
  if (!participantEligible) {
    reasons.push(...access.reasonCodes.filter((code) => code !== 'ELIGIBLE'));
    reasons.push('WRONG_PARTICIPANT');
  }
  const marketEligible = familyFullyOperational(input.family) || input.family === input.access.marketFamily;
  if (!familyFullyOperational(input.family)) {
    reasons.push('FAMILY_RESTRICTED_UNTIL_READY');
  }
  if (!input.credential.marketPermissions.includes(input.family)) {
    reasons.push('MARKET_PERMISSION_DENIED');
  }
  if (input.accountRestricted) {
    reasons.push('ACCOUNT_RESTRICTED');
  }
  if (!input.reservationAvailable) {
    reasons.push('RESERVATION_UNAVAILABLE');
  }
  const quantityWithinLimit = input.quantity > 0n && input.quantity <= input.rate.maxQuantity;
  if (!quantityWithinLimit) {
    reasons.push('QUANTITY_LIMIT');
  }
  if (input.notional > input.rate.maxNotional) {
    reasons.push('NOTIONAL_LIMIT');
  }
  const priceWithin =
    input.priceUnits === null ||
    input.referenceUnits === null ||
    priceWithinCollar(input.priceUnits, input.referenceUnits, input.collarBps);
  if (!priceWithin) {
    reasons.push('PRICE_COLLAR');
  }
  if (!input.referenceAvailable && input.priceUnits !== null) {
    reasons.push('REFERENCE_PRICE_UNAVAILABLE');
  }
  const killSwitchClear = !input.killSwitches.some(
    (row) =>
      row.engaged &&
      (row.scope === 'ORDER_ENTRY' ||
        row.scope === 'MARKET' ||
        row.scope === 'MARKET_FAMILY' ||
        row.scope === 'ASSET' ||
        (row.scope === 'SETTLEMENT' && row.targetId === input.marketId)),
  );
  if (!killSwitchClear) {
    reasons.push('KILL_SWITCH');
  }
  const complianceClear = input.access.complianceState === 'CLEAR';
  if (!complianceClear) {
    reasons.push('COMPLIANCE_STATE');
  }
  if (!input.settlementHealthy) {
    reasons.push('SETTLEMENT_DEGRADED');
  }
  if (!input.custodyHealthy) {
    reasons.push('CUSTODY_UNAVAILABLE');
  }
  const allowed = reasons.length === 0;
  return Object.freeze({
    marketId: input.marketId as MarketRiskControl['marketId'],
    participantEligible,
    marketEligible,
    accountRestricted: input.accountRestricted,
    reservationAvailable: input.reservationAvailable,
    quantityWithinLimit,
    priceWithinCollar: priceWithin,
    killSwitchClear,
    complianceClear,
    settlementHealthy: input.settlementHealthy,
    custodyHealthy: input.custodyHealthy,
    allowed,
    reasonCodes: Object.freeze(allowed ? ['ELIGIBLE'] : reasons),
  });
}

export function authorizeMarketRestriction(input: {
  readonly actorKind: 'HUMAN' | 'SECURITY_AUTHORITY' | 'POLICY' | 'AI';
  readonly reason: string;
}): { readonly accepted: boolean; readonly reasonCodes: readonly string[] } {
  if (input.actorKind === 'AI') {
    return { accepted: false, reasonCodes: Object.freeze(['AI_MARKET_AUTHORIZATION_REJECTED']) };
  }
  if (input.actorKind === 'POLICY') {
    return { accepted: true, reasonCodes: Object.freeze([input.reason]) };
  }
  const kill = engageExchangeKillSwitch({
    scope: 'MARKET',
    targetId: 'ops',
    actorKind: input.actorKind,
    reason: input.reason,
  });
  return { accepted: kill.accepted, reasonCodes: kill.reasonCodes };
}

export function credentialContainsCustodyKey(credential: TradingCredential): false {
  return credential.custodyPrivateKeyPresent;
}
