import type { SourceProductiveMapping } from './types.ts';
import { ISSUANCE_BOUNDARY, PRODUCTION_ACTIVE } from './types.ts';

export const MAPPING_AUTHORIZES_MOONREY = false as const;
export const VERIFIED_FACT_ALONE_CAN_MINT = false as const;
export const CAPACITY_CLAIM_AUTOMATICALLY_ISSUES = false as const;
export const RESERVE_CLAIM_AUTOMATICALLY_ISSUES = false as const;
export const REFERENCE_PRICE_CAN_CREATE_CLAIM = false as const;
export const MAPPING_DECLARES_PRODUCTIVE_CONTRIBUTION = false as const;

export function mappingAuthorizesIssuance(_mapping?: SourceProductiveMapping): false {
  return ISSUANCE_BOUNDARY.mappingAuthorizesIssuance;
}

export function mappingAuthorizesMoonRey(_mapping?: SourceProductiveMapping): false {
  return MAPPING_AUTHORIZES_MOONREY;
}

export function verifiedFactAloneCanMint(_mapping?: SourceProductiveMapping): false {
  return VERIFIED_FACT_ALONE_CAN_MINT;
}

export function capacityClaimAutomaticallyIssues(_mapping?: SourceProductiveMapping): false {
  return CAPACITY_CLAIM_AUTOMATICALLY_ISSUES;
}

export function reserveClaimAutomaticallyIssues(_mapping?: SourceProductiveMapping): false {
  return RESERVE_CLAIM_AUTOMATICALLY_ISSUES;
}

export function mappingCreatesProductiveContribution(_mapping?: SourceProductiveMapping): false {
  return ISSUANCE_BOUNDARY.mappingCreatesProductiveContribution;
}

export function mappingDeclaresProductiveContribution(_mapping?: SourceProductiveMapping): false {
  return MAPPING_DECLARES_PRODUCTIVE_CONTRIBUTION;
}

export function referencePriceCanCreateClaim(): false {
  return REFERENCE_PRICE_CAN_CREATE_CLAIM;
}

export function productionIsActive(): false {
  return PRODUCTION_ACTIVE;
}

export function mappingPreservesChunk71Authority(): true {
  return true;
}
