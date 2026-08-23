import type { LicensePurpose } from './taxonomy.ts';
import type { RightsMarketplaceFailure } from './types.ts';

/**
 * A license approved for RESEARCH does not automatically permit
 * MARKETING or CREDIT_DECISIONING. Purpose is preserved, not scored.
 */
export function enforcePurpose(input: {
  readonly licensedPurpose: LicensePurpose;
  readonly requestedPurpose: LicensePurpose;
}): RightsMarketplaceFailure | null {
  if (input.licensedPurpose !== input.requestedPurpose) {
    return {
      code: 'PURPOSE_MISMATCH',
      message: `license purpose ${input.licensedPurpose} does not authorize ${input.requestedPurpose}`,
    };
  }
  return null;
}

export function refusePurposeExpansion(from: LicensePurpose, to: LicensePurpose): RightsMarketplaceFailure {
  return {
    code: 'PURPOSE_NOT_INHERITED',
    message: `a ${from} license does not automatically permit ${to}`,
  };
}
