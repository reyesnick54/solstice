/**
 * ACCESS-08 boundaries.
 *
 * An access right is permission to use productive capacity for a bounded time
 * under a stated policy. Ownership is a different right, held by a different
 * party, recorded by a different owner. No sequence of access commitments can
 * turn one into the other.
 */
export const ACCESS_RIGHT_CONVEYS_OWNERSHIP = false as const;
export const ACCESS_COMMITMENT_MINTS_ASSET = false as const;
export const ACCESS_COMMITMENT_ALTERS_LEDGER = false as const;
export const ACCESS_COMMITMENT_ISSUES_EXECUTION_AUTHORITY = false as const;
export const RAW_PERSONAL_DATA_ON_CHAIN = false as const;
export const ACCESS_FABRIC_HAS_NATIVE_UNIT = false as const;
export const CHAIN_FINALITY_IS_NOT_RIGHTS_AUTHORITY = true as const;
export const ACCESS_STATE_IS_DETERMINISTIC_REPLAY = true as const;
export const PRODUCTION_ACTIVE = false as const;

export function accessRightTransfersOwnership(): false {
  return ACCESS_RIGHT_CONVEYS_OWNERSHIP;
}

export const ACCESS_CHAIN_OWNER = Object.freeze({
  CHAIN_OWNER: 'packages/sunrey-chain',
  canonicalPath: 'packages/sunrey-chain/src/access',
  capability: 'sunrey-access-rights-commitments',
  chunk: 'ACCESS-08',
  extendsCapability: 'sunrey-chain',
});

export const ACCESS_CHAIN_INVARIANTS = Object.freeze({
  ACCESS_RIGHT_CONVEYS_OWNERSHIP,
  ACCESS_COMMITMENT_MINTS_ASSET,
  ACCESS_COMMITMENT_ALTERS_LEDGER,
  ACCESS_COMMITMENT_ISSUES_EXECUTION_AUTHORITY,
  RAW_PERSONAL_DATA_ON_CHAIN,
  ACCESS_FABRIC_HAS_NATIVE_UNIT,
  CHAIN_FINALITY_IS_NOT_RIGHTS_AUTHORITY,
  ACCESS_STATE_IS_DETERMINISTIC_REPLAY,
  PRODUCTION_ACTIVE,
  authoritativeBalanceSource: 'canonical-internal-ledger',
  authoritativeProductiveObjectOwner: 'packages/sunrey-chain/src/productive',
  createsSecondChain: false,
  createsSecondLedger: false,
  createsMonetaryAuthority: false,
  invitesSettlementReference: false,
  autoFixed: false,
});
