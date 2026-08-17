import type { ExchangeMarketId } from './ids.ts';
import type { ExchangePrice } from './price.ts';
import type { DeliveryWindow, FamilyMarketData } from './types-universal.ts';
import type { MarketFamily, MarketMode } from './taxonomy.ts';

export function familyMarketData(input: {
  readonly marketId: ExchangeMarketId;
  readonly family: MarketFamily;
  readonly mode: MarketMode;
  readonly bestBid?: ExchangePrice | null;
  readonly bestAsk?: ExchangePrice | null;
  readonly lastTradePrice?: ExchangePrice | null;
  readonly volume?: bigint;
  readonly deliveryPeriod?: DeliveryWindow | null;
  readonly availableQuantity?: bigint;
  readonly clearingPrice?: ExchangePrice | null;
  readonly verifiedDelivery?: bigint;
  readonly unitPrice?: ExchangePrice | null;
  readonly availableCapacity?: bigint;
  readonly deliveryWindow?: DeliveryWindow | null;
  readonly contractAvailability?: bigint;
  readonly purposeCategory?: string | null;
  readonly authorizedOutputType?: string | null;
}): FamilyMarketData {
  const digital =
    input.family === 'DIGITAL_ASSET'
      ? {
          bestBid: input.bestBid ?? null,
          bestAsk: input.bestAsk ?? null,
          lastTradePrice: input.lastTradePrice ?? null,
          volume: input.volume ?? 0n,
        }
      : null;
  const capacity =
    input.family === 'PRODUCTIVE_CAPACITY'
      ? {
          deliveryPeriod: input.deliveryPeriod ?? null,
          availableQuantity: input.availableQuantity ?? 0n,
          clearingPrice: input.clearingPrice ?? null,
          verifiedDelivery: input.verifiedDelivery ?? 0n,
        }
      : null;
  const compute =
    input.family === 'INTELLIGENCE_COMPUTE'
      ? {
          unitPrice: input.unitPrice ?? input.lastTradePrice ?? null,
          availableCapacity: input.availableCapacity ?? 0n,
          deliveryWindow: input.deliveryWindow ?? null,
        }
      : null;
  const information =
    input.family === 'HUMAN_INFORMATION_RIGHT' || input.family === 'INFORMATION_ASSET'
      ? {
          contractAvailability: input.contractAvailability ?? 0n,
          purposeCategory: input.purposeCategory ?? null,
          authorizedOutputType: input.authorizedOutputType ?? null,
          subjectLevelData: false as const,
        }
      : null;
  return Object.freeze({
    marketId: input.marketId,
    family: input.family,
    mode: input.mode,
    digital,
    capacity,
    compute,
    information,
  });
}
