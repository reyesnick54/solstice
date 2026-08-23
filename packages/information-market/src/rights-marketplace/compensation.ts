import { Money } from '../../../money/src/money.ts';
import { AssetQuantity } from '../../../money/src/asset-quantity.ts';
import type { CompensationAllocation, CompensationPolicy, LicenseCompensationTerms } from './types.ts';
import { newCompensationAllocationId } from './ids.ts';
import type { LicenseSettlementId, InformationLicenseId } from './ids.ts';
import { validateCompensationPolicy } from './policy.ts';
import type { RightsMarketplaceFailure } from './types.ts';

export function allocateCompensation(input: {
  readonly policy: CompensationPolicy;
  readonly terms: LicenseCompensationTerms;
  readonly settlementId: LicenseSettlementId;
  readonly licenseId: InformationLicenseId;
  readonly rightsHolder: string;
}): { readonly ok: true; readonly allocations: readonly CompensationAllocation[] } | { readonly ok: false; readonly error: RightsMarketplaceFailure } {
  const invalid = validateCompensationPolicy(input.policy);
  if (invalid) {
    return { ok: false, error: { code: 'COMPENSATION_POLICY_INVALID', message: invalid } };
  }
  const allocations: CompensationAllocation[] = [];
  for (const share of input.policy.shares) {
    const recipientRef = share.recipientClass === 'INDIVIDUAL_RIGHTS_HOLDER' ? input.rightsHolder : share.recipientRef;
    if (input.terms.asset === 'FIAT_MONEY' && input.terms.fiat) {
      const shareAmount = Money.fromMinorUnits(
        (input.terms.fiat.minorUnits * BigInt(share.basisPoints)) / 10_000n,
        input.terms.fiat.currency,
      );
      allocations.push(
        Object.freeze({
          allocationId: newCompensationAllocationId(),
          settlementId: input.settlementId,
          licenseId: input.licenseId,
          policyVersion: input.policy.version,
          recipientClass: share.recipientClass,
          recipientRef,
          asset: 'FIAT_MONEY',
          fiat: shareAmount,
          guaranteed: false,
        }),
      );
    } else if (input.terms.asset === 'SUNREY_COIN' && input.terms.coin) {
      const shareQty = AssetQuantity.fromScaledUnits(
        (input.terms.coin.scaledUnits * BigInt(share.basisPoints)) / 10_000n,
        input.terms.coin.assetId,
      );
      allocations.push(
        Object.freeze({
          allocationId: newCompensationAllocationId(),
          settlementId: input.settlementId,
          licenseId: input.licenseId,
          policyVersion: input.policy.version,
          recipientClass: share.recipientClass,
          recipientRef,
          asset: 'SUNREY_COIN',
          coin: shareQty,
          guaranteed: false,
        }),
      );
    } else {
      return { ok: false, error: { code: 'COMPENSATION_UNSPECIFIED', message: 'compensation terms must be explicit' } };
    }
  }
  return { ok: true, allocations: Object.freeze(allocations) };
}
