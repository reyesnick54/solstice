/**
 * HELIOS Multi-Asset Expansion M03 — session and contract records consumed by M04.
 */

import type { UtcInstant } from '@solstice/domain';
import type {
  FuturesRollState,
  MarketExecutionCapabilityState,
  MarketLiquidityState,
  MarketSessionState,
  MarketVolatilityState,
} from '../taxonomy.ts';

export type MultiAssetSessionContractRecord = {
  readonly sessionState: MarketSessionState;
  readonly contractValidUntil: UtcInstant | null;
  readonly liquidityState: MarketLiquidityState;
  readonly volatilityState: MarketVolatilityState;
  readonly futuresRollState: FuturesRollState;
  readonly executionCapability: MarketExecutionCapabilityState;
  readonly routeAvailable: boolean;
  readonly routeId: string | null;
};
