/**
 * Chunk 124 — engine status is distinct from constitution-era flags.
 *
 * `engineImplemented=false` on ProductiveValueFunctionPolicy remains the
 * Chunk 123 constitution-era marker. It does not mean the simulation
 * engine is absent, and `engineeringImplemented=true` does not mean
 * production is activated.
 */

import {
  PRODUCTIVE_VALUE_ENGINE_CAN_CREATE_MONETARY_AUTHORITY,
  PRODUCTIVE_VALUE_ENGINE_CAN_MINT,
  PRODUCTIVE_VALUE_ENGINE_ENGINEERING_IMPLEMENTED,
  PRODUCTIVE_VALUE_ENGINE_PRODUCTION_ACTIVATED,
  PRODUCTIVE_VALUE_ENGINE_PRODUCTION_POLICY_CONFIGURED,
  PRODUCTIVE_VALUE_ENGINE_SIMULATION_AVAILABLE,
  PRODUCTIVE_VALUE_FUNCTION_ENGINE_IMPLEMENTED,
} from './constitution.ts';
import {
  PRODUCTIVE_VALUE_FUNCTION_ENGINE_STATUS,
  type ProductiveValueFunctionEngineStatus,
} from './types.ts';

export function productiveValueFunctionEngineStatus(): ProductiveValueFunctionEngineStatus {
  return PRODUCTIVE_VALUE_FUNCTION_ENGINE_STATUS;
}

export function valueFunctionEngineeringImplemented(): true {
  return PRODUCTIVE_VALUE_ENGINE_ENGINEERING_IMPLEMENTED;
}

export function valueFunctionSimulationAvailable(): true {
  return PRODUCTIVE_VALUE_ENGINE_SIMULATION_AVAILABLE;
}

export function valueFunctionEngineProductionActivated(): false {
  return PRODUCTIVE_VALUE_ENGINE_PRODUCTION_ACTIVATED;
}

export function valueFunctionEngineProductionPolicyConfigured(): false {
  return PRODUCTIVE_VALUE_ENGINE_PRODUCTION_POLICY_CONFIGURED;
}

export function valueFunctionEngineCanMint(): false {
  return PRODUCTIVE_VALUE_ENGINE_CAN_MINT;
}

export function valueFunctionEngineCanCreateMonetaryAuthority(): false {
  return PRODUCTIVE_VALUE_ENGINE_CAN_CREATE_MONETARY_AUTHORITY;
}

export function constitutionEraEngineImplementedMarker(): false {
  return PRODUCTIVE_VALUE_FUNCTION_ENGINE_IMPLEMENTED;
}

export function engineeringImplementedMeansProductionActivated(): false {
  return false;
}
