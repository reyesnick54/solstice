/**
 * Wave 6 — PEVE → Monetary Policy → Proposed SunRey Quantity boundary.
 *
 * PEVE reference value is never copied directly into SunRey quantity.
 * Production issuance formula remains disabled until formally approved.
 */

import { convertReferenceToSunRey, simulationConversionPolicy } from '../human-contribution-bridge/conversion.ts';
import {
  PRODUCTION_SUNREY_ISSUANCE_FORMULA_APPROVED,
  type MonetaryPolicyRef,
  type PeveValuationRef,
} from './types.ts';

export const SIMULATION_MONETARY_POLICY_ID = 'sunrey.human-economy.monetary-policy.simulation.v1' as const;

export function simulationMonetaryPolicyRef(): MonetaryPolicyRef {
  const policy = simulationConversionPolicy();
  return Object.freeze({
    policyId: SIMULATION_MONETARY_POLICY_ID,
    policyVersion: policy.version,
    conversionPolicyVersion: policy.version,
    productionApproved: false,
    simulationOnly: true,
  });
}

export type MonetaryPolicyDerivation =
  | {
      readonly ok: true;
      readonly proposedSunReyQuantity: bigint;
      readonly peveReferenceValue: bigint;
      readonly quantityDerivedFromPeve: false;
      readonly monetaryPolicy: MonetaryPolicyRef;
    }
  | {
      readonly ok: false;
      readonly code:
        | 'PEVE_EQUALS_SUNREY_QUANTITY_FORBIDDEN'
        | 'PRODUCTION_SUNREY_ISSUANCE_FORMULA_NOT_APPROVED'
        | 'MONETARY_POLICY_BOUNDARY_VIOLATION';
    };

export function deriveProposedSunReyQuantity(input: {
  readonly peve: PeveValuationRef;
  readonly network: 'DEVELOPMENT' | 'TESTNET' | 'MAINNET';
  readonly usePeveAsQuantity?: boolean;
}): MonetaryPolicyDerivation {
  if (input.usePeveAsQuantity) {
    return { ok: false, code: 'PEVE_EQUALS_SUNREY_QUANTITY_FORBIDDEN' };
  }
  if (input.network === 'MAINNET' && !PRODUCTION_SUNREY_ISSUANCE_FORMULA_APPROVED) {
    return { ok: false, code: 'PRODUCTION_SUNREY_ISSUANCE_FORMULA_NOT_APPROVED' };
  }
  const peveReferenceValue = BigInt(input.peve.referenceValue);
  if (peveReferenceValue <= 0n) {
    return { ok: false, code: 'MONETARY_POLICY_BOUNDARY_VIOLATION' };
  }
  const conversionPolicy = simulationConversionPolicy();
  const proposedSunReyQuantity = convertReferenceToSunRey(peveReferenceValue, conversionPolicy);
  if (proposedSunReyQuantity <= 0n) {
    return { ok: false, code: 'MONETARY_POLICY_BOUNDARY_VIOLATION' };
  }
  if (proposedSunReyQuantity === peveReferenceValue) {
    return { ok: false, code: 'PEVE_EQUALS_SUNREY_QUANTITY_FORBIDDEN' };
  }
  return {
    ok: true,
    proposedSunReyQuantity,
    peveReferenceValue,
    quantityDerivedFromPeve: false,
    monetaryPolicy: simulationMonetaryPolicyRef(),
  };
}

export function productionIssuanceDisabled(): true {
  return true;
}
