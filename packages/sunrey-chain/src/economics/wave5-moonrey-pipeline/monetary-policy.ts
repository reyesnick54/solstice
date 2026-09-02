/**
 * Wave 5 — Productive valuation → monetary policy boundary.
 *
 * GPUV quantity does NOT automatically equal MoonRey quantity.
 * Production issuance economics remain disabled until approved.
 */

import {
  convertGpuvToMoonRey,
  simulationConversionPolicy,
  validateConversionPolicy,
} from '../../productive/policy-governance/value-settlement/conversion.ts';
import type { MoonReyProductiveSettlementConversionPolicy } from '../../productive/policy-governance/value-settlement/types.ts';
import { PRODUCTION_CONVERSION_POLICY } from '../../productive/policy-governance/value-settlement/types.ts';
import type { MoonReyPipelineRejection } from './types.ts';

export const GPUV_IS_NOT_MOONREY_QUANTITY = true as const;
export const PRODUCTION_MOONREY_ISSUANCE_DISABLED = true as const;
export const EXCHANGE_PRICE_CANNOT_AUTHORIZE_ISSUANCE = true as const;

export const SIMULATION_MONETARY_POLICY_REF = 'moonrey.monetary-policy.simulation.v1' as const;
export const SIMULATION_MONETARY_POLICY_VERSION = '1' as const;

export type MonetaryPolicyEvaluation = {
  readonly policyRef: typeof SIMULATION_MONETARY_POLICY_REF;
  readonly policyVersion: typeof SIMULATION_MONETARY_POLICY_VERSION;
  readonly gpuvQuantity: bigint;
  readonly derivedMoonReyQuantity: bigint;
  readonly conversionPolicyId: string;
  readonly productionActive: false;
  readonly exchangePriceUsed: false;
};

export function developmentMonetaryPolicy(): MoonReyProductiveSettlementConversionPolicy {
  return simulationConversionPolicy({
    environment: 'DEVELOPMENT',
    conversionNumerator: 2n,
    conversionDenominator: 5n,
  });
}

export function evaluateMonetaryPolicy(input: {
  readonly gpuvQuantity: bigint;
  readonly requestedMoonReyQuantity?: bigint;
  readonly exchangePriceMinorUnits?: bigint;
  readonly network: 'DEVELOPMENT' | 'TESTNET' | 'MAINNET';
  readonly conversionPolicy?: MoonReyProductiveSettlementConversionPolicy;
}): { readonly ok: true; readonly evaluation: MonetaryPolicyEvaluation } | { readonly ok: false; readonly code: MoonReyPipelineRejection } {
  if (input.network === 'MAINNET') {
    return { ok: false, code: 'MONETARY_POLICY_PRODUCTION_DISABLED' };
  }
  if (input.exchangePriceMinorUnits !== undefined) {
    return { ok: false, code: 'EXCHANGE_PRICE_AS_ISSUANCE_AUTHORITY' };
  }
  const policy = input.conversionPolicy ?? developmentMonetaryPolicy();
  const policyError = validateConversionPolicy(policy);
  if (policyError) {
    if (policyError === 'CONVERSION_POLICY_PRODUCTION_UNCONFIGURED') {
      return { ok: false, code: 'MONETARY_POLICY_UNAPPROVED' };
    }
    return { ok: false, code: 'MONETARY_POLICY_UNAPPROVED' };
  }
  if (policy.productionActivated || policy.environment === 'PRODUCTION_CANDIDATE') {
    return { ok: false, code: 'MONETARY_POLICY_PRODUCTION_DISABLED' };
  }
  const derived = convertGpuvToMoonRey(input.gpuvQuantity, policy);
  if (input.requestedMoonReyQuantity !== undefined && input.requestedMoonReyQuantity === input.gpuvQuantity) {
    return { ok: false, code: 'GPUV_USED_AS_MOONREY_QUANTITY' };
  }
  if (input.requestedMoonReyQuantity !== undefined && input.requestedMoonReyQuantity !== derived) {
    return { ok: false, code: 'MONETARY_POLICY_UNAPPROVED' };
  }
  return {
    ok: true,
    evaluation: Object.freeze({
      policyRef: SIMULATION_MONETARY_POLICY_REF,
      policyVersion: SIMULATION_MONETARY_POLICY_VERSION,
      gpuvQuantity: input.gpuvQuantity,
      derivedMoonReyQuantity: derived,
      conversionPolicyId: policy.policyId,
      productionActive: false,
      exchangePriceUsed: false,
    }),
  };
}

export function productionMonetaryPolicyBlocked(): true {
  return PRODUCTION_MOONREY_ISSUANCE_DISABLED;
}

export function productionConversionRemainsUnconfigured(): typeof PRODUCTION_CONVERSION_POLICY {
  return PRODUCTION_CONVERSION_POLICY;
}
