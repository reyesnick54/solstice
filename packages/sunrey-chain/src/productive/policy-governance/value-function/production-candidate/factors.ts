/**
 * Production-candidate factor policy. Reuses the Chunk 123/124 taxonomy.
 * Does not create a parallel factor set. Reserved factors stay reserved.
 */

import {
  CANONICAL_FACTOR_ORDER,
  DEVELOPMENT_FACTOR_DEFINITIONS,
  RESERVED_FACTOR_DEFINITIONS,
} from '../factors.ts';
import { VALUE_FACTOR_SCALE, type MissingInputBehavior, type ValueFactorType } from '../types.ts';
import {
  PRODUCTION_FORBIDDEN_FACTOR_TYPES,
  type ProductionFactorPolicyCandidate,
  type ProductionForbiddenFactorType,
} from './types.ts';

export const PRODUCTION_CANDIDATE_FACTOR_POLICY_ID = 'moonrey.productive-value.factors.production-candidate.v1' as const;

export function productionFactorPolicyCandidate(input?: {
  readonly missingInputBehavior?: MissingInputBehavior;
  readonly referencePricePermittedAsEvidence?: boolean;
}): ProductionFactorPolicyCandidate {
  return Object.freeze({
    permittedFactorTypes: CANONICAL_FACTOR_ORDER,
    reservedFactorTypes: Object.freeze(RESERVED_FACTOR_DEFINITIONS.map((row) => row.factorType)),
    forbiddenFactorTypes: PRODUCTION_FORBIDDEN_FACTOR_TYPES,
    missingInputBehavior: input?.missingInputBehavior ?? 'FAIL_CLOSED',
    aggregateFactorFloor: 0n,
    aggregateFactorCeiling: VALUE_FACTOR_SCALE,
    scarcityEvidenceBound: true,
    scarcityBounded: true,
    scarcityVersioned: true,
    scarcityNonSelfReferential: true,
    referencePricePermittedAsEvidence: input?.referencePricePermittedAsEvidence === true,
    moonreyMarketPriceFeedsPvf: false,
  });
}

export function isProductionForbiddenFactor(factorType: string): factorType is ProductionForbiddenFactorType {
  return (PRODUCTION_FORBIDDEN_FACTOR_TYPES as readonly string[]).includes(factorType);
}

export function isReusedSupportedFactor(factorType: string): factorType is ValueFactorType {
  return DEVELOPMENT_FACTOR_DEFINITIONS.some((row) => row.factorType === factorType && row.enabled);
}

export function reusedFactorDefinitions() {
  return DEVELOPMENT_FACTOR_DEFINITIONS;
}
