import type { UtcInstant } from '@solstice/domain';
import type { MarketState } from '../../multi-asset/market-state-types.ts';
import type {
  HELIOS_M13_REGIME_ENGINE_VERSION,
  MarketRegime,
  RegimeConfidenceBand,
  StrategyFamilyId,
} from './taxonomy.ts';

export type RegimeEvidenceRef = {
  readonly refType: 'market_state' | 'volatility' | 'liquidity' | 'session';
  readonly refId: string;
};

export type RegimeAssessment = {
  readonly instrumentId: string;
  readonly assetClass: string;
  readonly regime: MarketRegime;
  readonly confidence: RegimeConfidenceBand;
  readonly volatilityState: MarketState['volatilityState'];
  readonly liquidityState: MarketState['liquidityState'];
  readonly sessionState: MarketState['sessionState'];
  readonly evidenceRefs: readonly RegimeEvidenceRef[];
  readonly evaluatedAt: UtcInstant;
  readonly engineVersion: typeof HELIOS_M13_REGIME_ENGINE_VERSION;
};

export type RegimeCompatibilityResult = {
  readonly strategyFamily: StrategyFamilyId;
  readonly regime: MarketRegime;
  readonly compatible: boolean;
  readonly score: number;
  readonly reason: string;
};

export type RegimeEngineInput = {
  readonly marketState: MarketState;
  readonly now: UtcInstant;
};
