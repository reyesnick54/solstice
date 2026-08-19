/**
 * Structural invariants for the productive-value settlement bridge.
 *
 * ProductiveValueResult cannot mint. Production stays off.
 */

import {
  AI_AUTHORIZED,
  GPUV_EQUALS_MOONREY_BY_DEFINITION,
  PRODUCTIVE_VALUE_ENGINE_CAN_MINT,
  PRODUCTIVE_VALUE_RESULT_CAN_MINT,
  PRODUCTION_ACTIVE,
  type ProductiveValueResult,
} from './types.ts';

export function gpuvEqualsMoonReyByDefinition(): false {
  return GPUV_EQUALS_MOONREY_BY_DEFINITION;
}

export function productiveValueResultCanMint(): false {
  return PRODUCTIVE_VALUE_RESULT_CAN_MINT;
}

export function productiveValueEngineCanMint(): false {
  return PRODUCTIVE_VALUE_ENGINE_CAN_MINT;
}

export function aiAuthorized(): false {
  return AI_AUTHORIZED;
}

export function productionActive(): false {
  return PRODUCTION_ACTIVE;
}

export function valueResultHasMintMethod(value: ProductiveValueResult): boolean {
  const record = value as ProductiveValueResult & { readonly mint?: unknown; readonly issue?: unknown };
  return typeof record.mint === 'function' || typeof record.issue === 'function' || value.canMint;
}
