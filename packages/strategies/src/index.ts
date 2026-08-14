export type { SimulatedStrategy } from './interface.ts';
export { noCredentials } from './interface.ts';
export { MeanReversionStrategy } from './mean-reversion.ts';
export { MomentumStrategy } from './momentum.ts';
export { MarketNeutralPairStrategy } from './market-neutral.ts';
export { recordTournamentMetrics } from './tournament.ts';
export type { StrategyPnLPoint } from './tournament.ts';
export {
  recommendWeights,
  applyRecommendationUnderRisk,
  promoteWithApproval,
  autoPromoteOnMetric,
} from './allocator.ts';
