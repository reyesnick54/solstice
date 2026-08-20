/**
 * Exact version/hash bindings for a production-candidate valuation policy.
 * "latest" is never a legal reference.
 */

import { createHash } from 'node:crypto';

import type { PolicyVersionBinding } from './types.ts';

export const VALUATION_BINDING_KEYS = [
  'humanContributionOntology',
  'verificationPolicy',
  'valuationPolicy',
  'hinPolicy',
  'hinChainAnchorCapability',
  'economicAssetVerificationPolicy',
  'jurisdictionPolicy',
] as const;
export type ValuationBindingKey = (typeof VALUATION_BINDING_KEYS)[number];

export function bindingRejectedAsLatest(versionId: string): boolean {
  return versionId.trim().toLowerCase() === 'latest';
}

export function hashBinding(key: string, versionId: string): string {
  return createHash('sha256').update(`SUNREY_VALUATION_CANDIDATE_BINDING_V1:${key}:${versionId}`).digest('hex');
}

export function bindExact(key: string, versionId: string, contentHash?: string): PolicyVersionBinding {
  if (bindingRejectedAsLatest(versionId)) {
    throw new TypeError('valuation policy bindings cannot use latest');
  }
  return Object.freeze({
    key,
    versionId,
    contentHash: contentHash ?? hashBinding(key, versionId),
  });
}

export const CURRENT_VALUATION_BINDINGS = Object.freeze({
  ontology: bindExact('humanContributionOntology', 'sunrey-human-economic-contribution-taxonomy:1'),
  verification: bindExact('verificationPolicy', 'sunrey-human-contribution-verification-engineering-v1'),
  valuation: bindExact('valuationPolicy', 'UNCONFIGURED'),
  hin: bindExact('hinPolicy', 'hin-policy-v1'),
  chainAnchor: bindExact('hinChainAnchorCapability', 'hin.on-chain-anchor.engineering.v1'),
  economicAsset: bindExact('economicAssetVerificationPolicy', 'sunrey-economic-asset-verification-engineering-v1'),
  jurisdiction: bindExact('jurisdictionPolicy', 'policy.sim.jurisdiction.unconfigured'),
});
