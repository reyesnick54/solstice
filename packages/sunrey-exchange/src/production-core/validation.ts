import type { Customer } from '../../../domain/src/customer.ts';
import { AssetQuantity } from '../../../money/src/asset-quantity.ts';
import { Money } from '../../../money/src/money.ts';
import { quoteForQuantity, type ExchangePrice } from '../price.ts';
import type { DigitalOrderType, ExchangeAccountStatus, TimeInForce } from '../taxonomy.ts';
import type { ExchangeAccount, ExchangeFailure } from '../types.ts';
import type { ProductizedInstrument } from './instrument.ts';
import { rejectClientFeeOverride } from './fees.ts';
import type { ProductizedFeeSchedule } from './fees.ts';

export type PreTradeInput = {
  readonly actorAuthenticated: boolean;
  readonly actorOwnsAccount: boolean;
  readonly account: ExchangeAccount | undefined;
  readonly customer: Customer | undefined;
  readonly instrument: ProductizedInstrument | undefined;
  readonly side: 'BUY' | 'SELL';
  readonly orderType: DigitalOrderType;
  readonly quantity: AssetQuantity;
  readonly limitPrice: ExchangePrice | null;
  readonly timeInForce?: TimeInForce;
  readonly availableQuote?: Money;
  readonly availableBase?: AssetQuantity;
  readonly feeSchedule: ProductizedFeeSchedule;
  readonly feeOverride?: unknown;
  readonly kycRequired?: boolean;
  readonly agentGenerated?: boolean;
  readonly agentMandateValid?: boolean;
  readonly executionAuthorityPresent?: boolean;
  readonly priceBandOk?: boolean;
  readonly rateLimitOk?: boolean;
};

export type PreTradeRejection = {
  readonly ok: false;
  readonly code: string;
  readonly message: string;
};

export type PreTradeAcceptance = {
  readonly ok: true;
};

const EXECUTABLE_TYPES: readonly DigitalOrderType[] = ['MARKET', 'LIMIT', 'MARKET_WITH_PROTECTION', 'IOC', 'FOK'];

export function validatePreTrade(input: PreTradeInput): PreTradeAcceptance | PreTradeRejection {
  if (!input.actorAuthenticated) {
    return reject('UNAUTHENTICATED', 'authentication is required');
  }
  if (!input.account) {
    return reject('UNKNOWN_ACCOUNT', 'exchange account not found');
  }
  if (!input.actorOwnsAccount) {
    return reject('OWNERSHIP_MISMATCH', 'actor does not own the exchange account');
  }
  if (input.account.status !== 'ACTIVE_SIMULATION') {
    return reject('RESTRICTED_PARTICIPANT', `account status ${input.account.status}`);
  }
  const customer = input.customer;
  if (!customer) {
    return reject('UNKNOWN_CUSTOMER', 'customer not found');
  }
  if (customer.status !== 'ACTIVE') {
    return reject('CUSTOMER_INACTIVE', `customer status ${customer.status}`);
  }
  if ((input.kycRequired ?? true) && customer.verification.kycState !== 'VERIFIED') {
    return reject('KYC_REQUIRED', 'KYC is not VERIFIED');
  }
  const instrument = input.instrument;
  if (!instrument) {
    return reject('UNKNOWN_INSTRUMENT', 'instrument is not registered');
  }
  if (instrument.listingStatus !== 'SIMULATION_LISTED') {
    return reject('ASSET_SUSPENDED', 'listing is not SIMULATION_LISTED');
  }
  if (instrument.liveTradingEnabled !== false) {
    return reject('LIVE_TRADING_DISABLED', 'live trading remains disabled');
  }
  if (
    instrument.jurisdictionRestrictions.length > 0 &&
    !instrument.jurisdictionRestrictions.includes(input.account.jurisdiction)
  ) {
    return reject('JURISDICTION_DENIED', 'account jurisdiction is not eligible');
  }
  const marketGate = validateMarketAdmitsOrders(instrument.status, input.orderType);
  if (!marketGate.ok) {
    return marketGate;
  }
  const feeGate = rejectClientFeeOverride({ feeOverride: input.feeOverride });
  if (!feeGate.ok) {
    return reject(feeGate.code ?? 'CLIENT_FEE_OVERRIDE_FORBIDDEN', 'frontend cannot specify a fee');
  }
  if (!input.quantity.isPositive()) {
    return reject('INVALID_QUANTITY', 'quantity must be positive');
  }
  if (input.quantity.assetId !== instrument.baseAsset) {
    return reject('INVALID_PRECISION', 'quantity asset does not match instrument');
  }
  if (input.quantity.scaledUnits % instrument.quantityIncrement !== 0n) {
    return reject('INVALID_QUANTITY', 'quantity is not a multiple of quantityIncrement');
  }
  if (input.quantity.scaledUnits < instrument.minimumOrderSize) {
    return reject('INVALID_QUANTITY', 'below minimum order size');
  }
  if (input.quantity.scaledUnits > instrument.maximumOrderSize) {
    return reject('INVALID_QUANTITY', 'above maximum order size');
  }
  const needsPrice =
    input.orderType === 'LIMIT' ||
    input.orderType === 'IOC' ||
    input.orderType === 'FOK' ||
    input.orderType === 'POST_ONLY' ||
    input.orderType === 'MARKET_WITH_PROTECTION';
  if (needsPrice && !input.limitPrice) {
    return reject('INVALID_PRICE', 'governed order requires a price');
  }
  if (input.limitPrice) {
    if (input.limitPrice.priceUnits <= 0n) {
      return reject('INVALID_PRICE', 'price must be positive');
    }
    if (input.limitPrice.priceUnits % instrument.priceIncrement !== 0n) {
      return reject('INVALID_TICK_SIZE', 'price is not a multiple of priceIncrement');
    }
    if (input.limitPrice.baseAssetId !== instrument.baseAsset || input.limitPrice.quoteAssetId !== instrument.quoteAsset) {
      return reject('INVALID_PRICE', 'price assets do not match instrument');
    }
    const notional = quoteForQuantity(input.limitPrice, input.quantity);
    if (notional < instrument.minimumNotional) {
      return reject('INVALID_NOTIONAL', 'below minimum notional');
    }
    if (instrument.maximumNotional !== null && notional > instrument.maximumNotional) {
      return reject('INVALID_NOTIONAL', 'above maximum notional');
    }
  }
  if (input.priceBandOk === false) {
    return reject('PRICE_BAND', 'limit price is outside the configured band');
  }
  if (input.rateLimitOk === false) {
    return reject('ORDER_RATE_EXCEEDED', 'order rate control refused the submission');
  }
  if (input.agentGenerated && input.agentMandateValid !== true) {
    return reject('AGENT_MANDATE_REQUIRED', 'agent-generated orders require a valid mandate');
  }
  if (input.executionAuthorityPresent === false) {
    return reject('MISSING_EXECUTION_AUTHORITY', 'Execution Authority is required');
  }
  if (EXECUTABLE_TYPES.includes(input.orderType) && input.side === 'BUY' && input.availableQuote) {
    if (input.availableQuote.minorUnits < 0n) {
      return reject('INSUFFICIENT_FUNDS', 'available quote is negative');
    }
  }
  if (EXECUTABLE_TYPES.includes(input.orderType) && input.side === 'SELL' && input.availableBase) {
    if (input.availableBase.scaledUnits < input.quantity.scaledUnits) {
      return reject('INSUFFICIENT_ASSET', 'sell exceeds owned available asset');
    }
  }
  void input.timeInForce;
  return { ok: true };
}

export function validateMarketAdmitsOrders(
  status: ProductizedInstrument['status'],
  orderType: DigitalOrderType,
): PreTradeAcceptance | PreTradeRejection {
  if (status === 'OPEN' || status === 'AUCTION') {
    return { ok: true };
  }
  if (status === 'PREOPEN') {
    return orderType === 'CANCEL'
      ? { ok: true }
      : reject('MARKET_NOT_OPEN', 'market is PREOPEN');
  }
  if (status === 'CLOSE_ONLY') {
    return reject('MARKET_CLOSE_ONLY', 'market is close-only; new orders are refused');
  }
  if (status === 'HALTED') {
    return reject('MARKET_HALTED', 'market is halted');
  }
  if (status === 'SUSPENDED') {
    return reject('MARKET_SUSPENDED', 'instrument is suspended');
  }
  return reject('MARKET_CLOSED', 'market is closed');
}

export function accountIsActive(status: ExchangeAccountStatus): boolean {
  return status === 'ACTIVE_SIMULATION';
}

function reject(code: string, message: string): PreTradeRejection {
  return { ok: false, code, message };
}

export type { ExchangeFailure };
