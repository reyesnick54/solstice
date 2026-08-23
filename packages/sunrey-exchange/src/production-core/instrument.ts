import type { Jurisdiction } from '../../../domain/src/jurisdiction.ts';
import { asInstrumentId, type ExchangeMarketId, type FeeScheduleId, type InstrumentId } from '../ids.ts';
import type { ListingStatus, MarketState, SettlementModel } from '../taxonomy.ts';
import type { ExchangeListing, ExchangeMarket, FeeSchedule } from '../types.ts';

/**
 * Server-authoritative productized market statuses. Existing operational
 * aliases (CANCEL_ONLY, PAUSED, RESTRICTED) map onto this set.
 */
export const PRODUCTIZED_MARKET_STATUSES = [
  'PREOPEN',
  'OPEN',
  'HALTED',
  'AUCTION',
  'CLOSE_ONLY',
  'CLOSED',
  'SUSPENDED',
] as const;
export type ProductizedMarketStatus = (typeof PRODUCTIZED_MARKET_STATUSES)[number];

export const PRODUCTIZED_MARKET_TYPES = ['SPOT'] as const;
export type ProductizedMarketType = (typeof PRODUCTIZED_MARKET_TYPES)[number];

export const CUSTODY_REQUIREMENTS = ['SIMULATION_CUSTODY'] as const;
export type CustodyRequirement = (typeof CUSTODY_REQUIREMENTS)[number];

export type ProductizedInstrument = {
  readonly instrumentId: InstrumentId;
  readonly marketId: ExchangeMarketId;
  readonly baseAsset: string;
  readonly quoteAsset: string;
  readonly marketType: ProductizedMarketType;
  readonly status: ProductizedMarketStatus;
  readonly priceIncrement: bigint;
  readonly quantityIncrement: bigint;
  readonly minimumOrderSize: bigint;
  readonly maximumOrderSize: bigint;
  readonly minimumNotional: bigint;
  readonly maximumNotional: bigint | null;
  readonly feeScheduleId: FeeScheduleId;
  readonly jurisdictionRestrictions: readonly Jurisdiction[];
  readonly listingStatus: ListingStatus;
  readonly custodyRequirements: CustodyRequirement;
  readonly settlementModel: SettlementModel;
  readonly liveTradingEnabled: false;
};

export class ProductizedInstrumentRegistry {
  private readonly byInstrument = new Map<string, ProductizedInstrument>();
  private readonly byMarket = new Map<string, ProductizedInstrument>();

  put(instrument: ProductizedInstrument): void {
    this.byInstrument.set(instrument.instrumentId, instrument);
    this.byMarket.set(instrument.marketId, instrument);
  }

  get(instrumentId: InstrumentId | string): ProductizedInstrument | undefined {
    return this.byInstrument.get(instrumentId);
  }

  forMarket(marketId: ExchangeMarketId | string): ProductizedInstrument | undefined {
    return this.byMarket.get(marketId);
  }

  list(): readonly ProductizedInstrument[] {
    return [...this.byInstrument.values()];
  }

  setStatus(marketId: ExchangeMarketId | string, status: ProductizedMarketStatus): ProductizedInstrument | undefined {
    const current = this.byMarket.get(marketId);
    if (!current) {
      return undefined;
    }
    const next = Object.freeze({ ...current, status });
    this.put(next);
    return next;
  }
}

export function mapMarketStateToProductized(state: MarketState): ProductizedMarketStatus {
  switch (state) {
    case 'PREOPEN':
      return 'PREOPEN';
    case 'OPEN':
      return 'OPEN';
    case 'AUCTION':
      return 'AUCTION';
    case 'HALTED':
    case 'PAUSED':
      return 'HALTED';
    case 'CLOSE_ONLY':
    case 'CANCEL_ONLY':
      return 'CLOSE_ONLY';
    case 'SUSPENDED':
    case 'RESTRICTED':
      return 'SUSPENDED';
    case 'CLOSED':
      return 'CLOSED';
    default:
      return 'HALTED';
  }
}

export function productizedInstrumentFromMarket(input: {
  readonly market: ExchangeMarket;
  readonly listing: ExchangeListing | undefined;
  readonly feeSchedule: FeeSchedule;
}): ProductizedInstrument {
  const listing = input.listing;
  const minQty = listing?.minQuantity?.scaledUnits ?? 1n;
  const maxQty = listing?.maxQuantity?.scaledUnits ?? 1_000_000_000_000n;
  const increment = listing && listing.precision > 0 ? 10n ** BigInt(listing.precision) : 1n;
  return Object.freeze({
    instrumentId: asInstrumentId(`instrument:${input.market.marketId}`),
    marketId: input.market.marketId,
    baseAsset: input.market.baseAssetId,
    quoteAsset: input.market.quoteAssetId,
    marketType: 'SPOT',
    status: mapMarketStateToProductized(input.market.state),
    priceIncrement: 1n,
    quantityIncrement: increment,
    minimumOrderSize: minQty,
    maximumOrderSize: maxQty,
    minimumNotional: 1n,
    maximumNotional: input.market.maxNotionalMinor,
    feeScheduleId: input.market.feeScheduleId,
    jurisdictionRestrictions: listing?.jurisdictionEligibility ?? [],
    listingStatus: listing?.status ?? 'DRAFT',
    custodyRequirements: 'SIMULATION_CUSTODY',
    settlementModel: listing?.settlementModel ?? 'DIGITAL_ASSET_DVP',
    liveTradingEnabled: false,
  });
}
