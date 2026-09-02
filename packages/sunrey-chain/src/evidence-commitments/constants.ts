/** Schema version for Wave 3 evidence commitment objects. */
export const EVIDENCE_COMMITMENT_SCHEMA_VERSION = 1 as const;

export const EVIDENCE_COMMITMENT_DOMAIN = 'sunrey.evidence.commitment.v1' as const;
export const EVIDENCE_BUNDLE_DOMAIN = 'sunrey.evidence.bundle.v1' as const;
export const EVIDENCE_STATUS_DOMAIN = 'sunrey.evidence.status.v1' as const;
export const EVIDENCE_ROOT_LEAF_DOMAIN = 'sunrey.evidence.root.leaf.v1' as const;
export const EVIDENCE_ROOT_MERKLE_DOMAIN = 'sunrey.evidence.root.merkle.v1' as const;
export const EVIDENCE_BLOCK_SCOPE_DOMAIN = 'sunrey.evidence.block.scope.v1' as const;

/** Reserved Wave 2 roots — must remain all-zero until their owning wave activates. */
export const RESERVED_ROOT_BYTES = 32;
export const ZERO_ROOT_HEX = '0'.repeat(64);

export const EVIDENCE_BUNDLE_ROLES = [
  'SUPPORTING',
  'CONTRADICTING',
  'SUPERSEDED',
  'REVOKED',
  'CHALLENGED',
] as const;

export const ECONOMIC_CLAIM_ECONOMIES = ['SUNREY', 'MOONREY'] as const;
