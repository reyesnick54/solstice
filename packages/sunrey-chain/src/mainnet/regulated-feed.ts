/**
 * Chunk 69 feed into Chunk 65 activation matrices.
 *
 * Software readiness may be recorded. Runtime and genesis enablement
 * stay false. Legal, license, and human slots remain explicit.
 */

import type { ActivationDomain, ProductionCapabilityActivation } from './types.ts';

export const REGULATED_FEED_CAPABILITIES = [
  'SUNREY_EXCHANGE',
  'INSTITUTIONAL_CUSTODY',
  'HUMAN_INFORMATION_MARKET',
  'PRODUCTIVE_CAPACITY_MARKET',
] as const;
export type RegulatedFeedCapability = (typeof REGULATED_FEED_CAPABILITIES)[number];

export type RegulatedReadinessFeed = {
  readonly capability: RegulatedFeedCapability;
  readonly software_ready: boolean;
  readonly security_ready: boolean;
  readonly operational_ready: boolean;
  readonly legal_ready: boolean;
  readonly regulatory_ready: boolean;
  readonly license_or_partner_ready: boolean;
  readonly human_authorized: boolean;
};

export function applyRegulatedReadinessFeed(
  matrix: readonly ProductionCapabilityActivation[],
  feeds: readonly RegulatedReadinessFeed[],
): readonly ProductionCapabilityActivation[] {
  const byCapability = new Map(feeds.map((feed) => [feed.capability, feed]));
  return Object.freeze(
    matrix.map((row) => {
      const feed = byCapability.get(row.capability as RegulatedFeedCapability);
      if (!feed) {
        return row;
      }
      return Object.freeze({
        ...row,
        software_ready: feed.software_ready,
        security_ready: feed.security_ready,
        operational_ready: feed.operational_ready,
        legal_ready: feed.legal_ready,
        regulatory_ready: feed.regulatory_ready,
        license_or_partner_ready: feed.license_or_partner_ready,
        human_authorized: feed.human_authorized,
        genesis_enabled: false,
        runtime_enabled: false,
      });
    }),
  );
}

export function regulatedFeedCapabilities(): readonly ActivationDomain[] {
  return REGULATED_FEED_CAPABILITIES;
}
