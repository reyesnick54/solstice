/**
 * EARN01 feature plane — earnings features extend canonical Feature Fabric (not a second fabric).
 */

export const HELIOS_EARNINGS_FEATURE_PLANE_SCHEMA = 'sunrey.helios.earn01.earnings-feature-plane.v1' as const;

export const EARNINGS_FEATURE_IDS = [
  'earn01.consensus_eps',
  'earn01.actual_eps',
  'earn01.eps_surprise_bps',
  'earn01.guidance_revision',
  'earn01.implied_move_bps',
  'earn01.post_release_reaction_bps',
  'earn01.announcement_state',
  'earn01.session_classification',
] as const;

export type EarningsFeatureId = (typeof EARNINGS_FEATURE_IDS)[number];

export const EARNINGS_FEATURE_FORMULA_VERSION = 'earn01.v1' as const;
