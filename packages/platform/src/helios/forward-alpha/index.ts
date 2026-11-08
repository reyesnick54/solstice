/**
 * HELIOS Forward Alpha — forward paper / shadow qualification and live-strategy monitoring (simulation).
 */

export {
  HELIOS_FORWARD_ALPHA_SCHEMA,
  ALPHA_WORK_PACKAGES,
  FORWARD_ALPHA_RETURN_LANES,
  FORWARD_STRATEGY_TYPES,
  type AlphaWorkPackageId,
  type ForwardAlphaReturnLane,
  type ForwardStrategyType,
  type Alpha06PromotionOutcome,
} from './taxonomy.ts';

export { listAlphaWorkPackages, type AlphaWorkPackageRow } from './work-package-registry.ts';

export * from './alpha02/index.ts';
export * from './alpha04-shadow-capital/index.ts';
export * from './alpha05/index.ts';
export * from './alpha06/index.ts';
export * from './alpha08/index.ts';
export * from './alpha09/index.ts';
export * from './alpha11/index.ts';
export * from './alpha12/index.ts';
export * from './alpha13/index.ts';
