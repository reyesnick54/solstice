import { PEVE_IS_TOKEN_VALUATION } from '../../../release-candidate/economic/production-constitution/types.ts';
import { REFERENCE_PRICE_CAN_MINT_MOONREY as MOONREY_REFERENCE_PRICE_CAN_MINT } from '../../../productive/policy-governance/value-function/production-candidate/types.ts';
import { hashIssuancePackage, unconfiguredMoonReyProductionIssuancePackage } from '../moonrey-parameter-package.ts';
import { rehearsalSunReyIssuancePackage, unconfiguredSunReyIssuancePackage } from '../sunrey-package/index.ts';

import type {
  AuthorizationBlockerCode,
  MoonReyIssuanceProposalBinding,
  SunReyIssuanceProposalBinding,
} from './types.ts';

export function bindSunReyIssuanceProposal(input?: {
  readonly policyHash?: string;
  readonly peveUsedAsTokenValuation?: boolean;
  readonly verifiedContribution?: boolean;
  readonly valuationPolicy?: boolean;
  readonly conversionPolicy?: boolean;
  readonly rightsConsent?: boolean;
}): {
  readonly binding: SunReyIssuanceProposalBinding;
  readonly blockers: readonly AuthorizationBlockerCode[];
} {
  const unconfigured = unconfiguredSunReyIssuancePackage();
  const blockers: AuthorizationBlockerCode[] = [];
  if (input?.peveUsedAsTokenValuation === true) {
    blockers.push('PEVE_CANNOT_VALUE_SUNREY');
  }
  void PEVE_IS_TOKEN_VALUATION;
  return {
    binding: Object.freeze({
      policyHash: input?.policyHash ?? unconfigured.packageHash,
      verifiedHumanEconomicContributionBound: input?.verifiedContribution === true,
      humanValuationPolicyBound: input?.valuationPolicy === true,
      conversionPolicyBound: input?.conversionPolicy === true,
      rightsConsentEvidenceBound: input?.rightsConsent === true,
      chunk71Bound: true,
      peveUsedAsTokenValuation: false,
    }),
    blockers: Object.freeze(blockers),
  };
}

export function bindMoonReyIssuanceProposal(input?: {
  readonly policyHash?: string;
  readonly referencePriceMintsDirectly?: boolean;
  readonly sourceTaxonomy?: boolean;
  readonly canonicalUnits?: boolean;
  readonly oracleEligibility?: boolean;
  readonly economicEventIdentity?: boolean;
  readonly attribution?: boolean;
  readonly productiveValue?: boolean;
  readonly gpuvConversion?: boolean;
}): {
  readonly binding: MoonReyIssuanceProposalBinding;
  readonly blockers: readonly AuthorizationBlockerCode[];
} {
  const unconfigured = unconfiguredMoonReyProductionIssuancePackage();
  const blockers: AuthorizationBlockerCode[] = [];
  if (input?.referencePriceMintsDirectly === true) {
    blockers.push('REFERENCE_PRICE_CANNOT_MINT_MOONREY');
  }
  void MOONREY_REFERENCE_PRICE_CAN_MINT;
  return {
    binding: Object.freeze({
      policyHash: input?.policyHash ?? unconfigured.packageHash,
      sourceTaxonomyBound: input?.sourceTaxonomy === true,
      canonicalUnitsBound: input?.canonicalUnits === true,
      oracleProviderEligibilityBound: input?.oracleEligibility === true,
      economicEventIdentityBound: input?.economicEventIdentity === true,
      attributionBound: input?.attribution === true,
      productiveValueBound: input?.productiveValue === true,
      gpuvConversionPolicyBound: input?.gpuvConversion === true,
      chunk71Bound: true,
      referencePriceMintsDirectly: false,
    }),
    blockers: Object.freeze(blockers),
  };
}

export function rehearsalSunReyPolicyHash(): string {
  return rehearsalSunReyIssuancePackage().packageHash;
}

export function rehearsalMoonReyPolicyHash(): string {
  const unconfigured = unconfiguredMoonReyProductionIssuancePackage();
  return hashIssuancePackage({
    ...unconfigured,
    sourceClass: 'REHEARSAL_ONLY',
    fixture: true,
  });
}
