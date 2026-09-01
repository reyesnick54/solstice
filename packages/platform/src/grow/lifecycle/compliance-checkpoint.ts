import type { SuitabilityOutcome } from '../taxonomy.ts';
import type { GrowFailureCode } from '../taxonomy.ts';

export type GrowComplianceCheckpointInput = {
  readonly suitability: SuitabilityOutcome;
  readonly kernelPolicy: 'ALLOW' | 'HOLD' | 'BLOCK' | 'DEFER' | 'REQUIRE_MANUAL_REVIEW' | 'UNKNOWN';
  readonly jurisdictionPermitted: boolean;
  readonly kycComplete: boolean;
  readonly accountRestricted: boolean;
  readonly providerAvailable: boolean;
  readonly productAvailable: boolean;
  readonly cryptoRestricted?: boolean;
};

export type GrowComplianceCheckpointResult =
  | { readonly allowed: true; readonly decision: 'ALLOW' }
  | { readonly allowed: false; readonly decision: 'BLOCK'; readonly code: GrowFailureCode; readonly message: string };

export function evaluateGrowComplianceCheckpoint(
  input: GrowComplianceCheckpointInput,
): GrowComplianceCheckpointResult {
  if (!input.kycComplete) {
    return block('KYC_INCOMPLETE', 'KYC must complete before regulated execution');
  }
  if (!input.jurisdictionPermitted) {
    return block('WRONG_JURISDICTION', 'jurisdiction blocks this product');
  }
  if (input.accountRestricted) {
    return block('ACCOUNT_RESTRICTED', 'account is restricted');
  }
  if (input.suitability !== 'SUITABLE') {
    return block('SUITABILITY_MISMATCH', `suitability is ${input.suitability}`);
  }
  if (!input.productAvailable) {
    return block('PRODUCT_UNAVAILABLE', 'product unavailable');
  }
  if (!input.providerAvailable) {
    return block('PROVIDER_UNAVAILABLE', 'provider unavailable');
  }
  if (input.cryptoRestricted) {
    return block('USER_INELIGIBLE', 'crypto restriction applies');
  }
  if (input.kernelPolicy !== 'ALLOW') {
    return block('REFRESH_PROPOSAL_REQUIRED', `kernel policy is ${input.kernelPolicy}`);
  }
  return Object.freeze({ allowed: true, decision: 'ALLOW' });
}

function block(code: GrowFailureCode, message: string): GrowComplianceCheckpointResult {
  return Object.freeze({ allowed: false, decision: 'BLOCK', code, message });
}
