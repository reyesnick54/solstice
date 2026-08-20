/**
 * Post-genesis SunRey issuance policy candidate.
 *
 * Authorized classes only. No unrestricted issuance.
 * Chunk 71 MonetaryIssuanceAuthority remains the only mint.
 */

import { SUNREY_ISSUANCE_CLASSES, type SunReyIssuanceClass } from '../../types.ts';

import type { SunReyPostGenesisIssuancePolicyCandidate } from './types.ts';

export const AUTHORIZED_HUMAN_ECONOMIC_CONTRIBUTION = 'AUTHORIZED_HUMAN_ECONOMIC_CONTRIBUTION' as const;

export function createPostGenesisIssuancePolicyCandidate(
  authorizedIssuanceClasses: readonly SunReyIssuanceClass[] = ['AUTHORIZED_HUMAN_ECONOMIC_CONTRIBUTION', 'GOVERNED_ISSUANCE', 'GENESIS_ONLY'],
): SunReyPostGenesisIssuancePolicyCandidate {
  for (const issuanceClass of authorizedIssuanceClasses) {
    if (!(SUNREY_ISSUANCE_CLASSES as readonly string[]).includes(issuanceClass)) {
      throw new TypeError(`unknown SunRey issuance class '${issuanceClass}'`);
    }
  }
  return Object.freeze({
    policyId: 'sunrey.post-genesis-issuance.production-candidate.v1',
    version: '1',
    authorizedIssuanceClasses: Object.freeze([...authorizedIssuanceClasses]),
    unrestrictedIssuance: false,
    rightsRequirement: true,
    verificationRequirement: true,
    valuationRequirement: true,
    settlementAuthorizationRequirement: true,
    hinConsentAloneInsufficient: true,
    usageReceiptAloneInsufficient: true,
    cleanRoomAloneInsufficient: true,
    informationAssetAloneInsufficient: true,
    chainAnchorIsNotEconomicVerification: true,
    replayPolicy: 'REJECT_DUPLICATE_CONTRIBUTION_VALUATION_AUTHORIZATION',
    capPolicy: 'MOST_RESTRICTIVE',
    supplyGuard: 'MAXIMUM_SUPPLY_CANNOT_BE_BYPASSED',
    correctionsRequireExplicitAdjustment: true,
    clawbackForbidden: true,
    historicalSettlementAuditable: true,
    retroactivePolicyChangeForbidden: true,
    productionActivated: false,
  });
}
