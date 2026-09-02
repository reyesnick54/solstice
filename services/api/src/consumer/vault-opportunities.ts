/**
 * Vault opportunities — research participation, authorized computation,
 * credential verification, contribution verification, and data-use opportunities.
 * Does not promise SunRey issuance merely because the user opts in.
 */

import type { PersonalDataVaultProduct } from '../../../../packages/personal-data-vault/src/product/index.ts';
import type { BffPrincipal } from './ports.ts';

export const VAULT_OPPORTUNITY_KINDS = [
  'RESEARCH_PARTICIPATION',
  'AUTHORIZED_COMPUTATION',
  'CREDENTIAL_VERIFICATION',
  'CONTRIBUTION_VERIFICATION',
  'DATA_USE',
  'HIN_PARTICIPATION',
] as const;
export type VaultOpportunityKind = (typeof VAULT_OPPORTUNITY_KINDS)[number];

export type VaultOpportunityItem = {
  readonly opportunityId: string;
  readonly kind: VaultOpportunityKind;
  readonly title: string;
  readonly purpose: string;
  readonly requestedDataCategories: readonly string[];
  readonly recipient: string;
  readonly recipientSystem: string;
  readonly benefitMethodology: string | null;
  readonly duration: string | null;
  readonly revocable: true;
  readonly rights: readonly string[];
  readonly status: 'AVAILABLE' | 'ACTIVE' | 'COMPLETED' | 'DECLINED';
  readonly mintsSunRey: false;
  readonly issuancePromised: false;
  readonly sandboxOnly: true;
};

export type VaultOpportunitiesResource = {
  readonly schema: 'sunrey.consumer.vault.opportunities.v1';
  readonly generatedAt: string;
  readonly productionActive: false;
  readonly items: readonly VaultOpportunityItem[];
};

const SANDBOX_OPPORTUNITIES: readonly VaultOpportunityItem[] = Object.freeze([
  Object.freeze({
    opportunityId: 'vault_opp_research_01',
    kind: 'RESEARCH_PARTICIPATION',
    title: 'Economic behavior research (sandbox)',
    purpose: 'Aggregate anonymized spending patterns for simulation research',
    requestedDataCategories: Object.freeze(['TRANSACTION_PATTERNS', 'CATEGORY_AGGREGATES']),
    recipient: 'SunRey Research Lab',
    recipientSystem: 'sunrey-research-sandbox',
    benefitMethodology: 'Research participation may inform product improvements. No guaranteed reward.',
    duration: '90 days',
    revocable: true,
    rights: Object.freeze(['VIEW_USAGE_RECEIPTS', 'REVOKE_ANYTIME', 'DATA_MINIMIZATION']),
    status: 'AVAILABLE',
    mintsSunRey: false,
    issuancePromised: false,
    sandboxOnly: true,
  }),
  Object.freeze({
    opportunityId: 'vault_opp_compute_01',
    kind: 'AUTHORIZED_COMPUTATION',
    title: 'Privacy-preserving analytics (sandbox)',
    purpose: 'Run authorized computation on encrypted vault categories',
    requestedDataCategories: Object.freeze(['FINANCIAL_SUMMARY']),
    recipient: 'SunRey Analytics Engine',
    recipientSystem: 'sunrey-analytics-sandbox',
    benefitMethodology: 'Computation outputs are returned to you. No issuance is promised.',
    duration: '30 days',
    revocable: true,
    rights: Object.freeze(['PURPOSE_LIMITED', 'REVOKE_ANYTIME']),
    status: 'AVAILABLE',
    mintsSunRey: false,
    issuancePromised: false,
    sandboxOnly: true,
  }),
  Object.freeze({
    opportunityId: 'vault_opp_hin_01',
    kind: 'HIN_PARTICIPATION',
    title: 'Human Information contribution verification',
    purpose: 'Verify contribution metadata for HIN registry (simulation)',
    requestedDataCategories: Object.freeze(['CONTRIBUTION_METADATA']),
    recipient: 'Human Information Network',
    recipientSystem: 'hin-sandbox-registry',
    benefitMethodology: 'Verification does not guarantee SunRey issuance or monetary reward.',
    duration: null,
    revocable: true,
    rights: Object.freeze(['CONSENT_REQUIRED', 'REVOKE_ANYTIME', 'NO_RAW_DATA_EXPORT']),
    status: 'AVAILABLE',
    mintsSunRey: false,
    issuancePromised: false,
    sandboxOnly: true,
  }),
]);

export function listVaultOpportunities(
  _vault: PersonalDataVaultProduct | undefined,
  principal: BffPrincipal,
  now: string,
): VaultOpportunitiesResource {
  void principal;
  return Object.freeze({
    schema: 'sunrey.consumer.vault.opportunities.v1',
    generatedAt: now,
    productionActive: false,
    items: SANDBOX_OPPORTUNITIES,
  });
}

export function dispatchVaultOpportunities(
  vault: PersonalDataVaultProduct | undefined,
  request: { readonly method: string; readonly path: string },
  principal: BffPrincipal,
  now: string,
  headers: Record<string, string>,
  requestId: string,
): { readonly status: number; readonly body: unknown; readonly headers: Record<string, string> } | null {
  if (request.path !== '/api/v1/data/vault/opportunities' || request.method !== 'GET') {
    return null;
  }
  void requestId;
  return {
    status: 200,
    body: listVaultOpportunities(vault, principal, now),
    headers: { ...headers, 'content-type': 'application/json' },
  };
}
