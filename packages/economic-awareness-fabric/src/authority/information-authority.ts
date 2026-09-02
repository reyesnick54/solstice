/**
 * Information authority boundary — structural enforcement.
 *
 * The Economic Awareness Fabric processes information. It does not hold
 * monetary authority. Monetary mutation remains Chunk 71 + Execution Authority.
 */

import { WAVE4_ECONOMIC_AWARENESS_FABRIC_CAPABILITY } from '../capability.ts';

export type InformationAuthorityAction =
  | 'observe'
  | 'ingest'
  | 'normalize'
  | 'enrich'
  | 'correlate'
  | 'resolve_entities'
  | 'calculate_confidence'
  | 'detect_duplicates'
  | 'build_evidence'
  | 'propose_verified_fact'
  | 'propose_claim';

export type ForbiddenMonetaryAction =
  | 'issue_sunrey'
  | 'issue_moonrey'
  | 'burn_supply'
  | 'modify_blockchain_balance'
  | 'approve_monetary_governance'
  | 'set_market_price'
  | 'change_monetary_policy';

const PERMITTED: ReadonlySet<InformationAuthorityAction> = new Set([
  'observe',
  'ingest',
  'normalize',
  'enrich',
  'correlate',
  'resolve_entities',
  'calculate_confidence',
  'detect_duplicates',
  'build_evidence',
  'propose_verified_fact',
  'propose_claim',
]);

const FORBIDDEN: ReadonlySet<ForbiddenMonetaryAction> = new Set([
  'issue_sunrey',
  'issue_moonrey',
  'burn_supply',
  'modify_blockchain_balance',
  'approve_monetary_governance',
  'set_market_price',
  'change_monetary_policy',
]);

export type AuthorityCheckResult =
  | { readonly permitted: true; readonly action: InformationAuthorityAction }
  | { readonly permitted: false; readonly action: ForbiddenMonetaryAction; readonly reason: string };

export function assertInformationAuthority(action: InformationAuthorityAction): AuthorityCheckResult {
  if (!PERMITTED.has(action)) {
    return { permitted: false, action: 'issue_sunrey', reason: `unknown action: ${action}` };
  }
  return { permitted: true, action };
}

export function rejectMonetaryAuthority(action: ForbiddenMonetaryAction): AuthorityCheckResult {
  return {
    permitted: false,
    action,
    reason: `Economic Awareness Fabric cannot perform monetary action: ${action}`,
  };
}

export function capabilityBlocksMonetaryMutation(): boolean {
  return (
    !WAVE4_ECONOMIC_AWARENESS_FABRIC_CAPABILITY.mayIssueSunRey &&
    !WAVE4_ECONOMIC_AWARENESS_FABRIC_CAPABILITY.mayIssueMoonRey &&
    !WAVE4_ECONOMIC_AWARENESS_FABRIC_CAPABILITY.mayBurnSupply &&
    !WAVE4_ECONOMIC_AWARENESS_FABRIC_CAPABILITY.mayModifyBlockchainBalances
  );
}

export function listPermittedActions(): readonly InformationAuthorityAction[] {
  return Object.freeze([...PERMITTED]);
}

export function listForbiddenMonetaryActions(): readonly ForbiddenMonetaryAction[] {
  return Object.freeze([...FORBIDDEN]);
}
