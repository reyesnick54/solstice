/**
 * Canonical corroboration semantics — re-exported from sunrey-chain EAF.
 *
 * Source independence is enforced by lineage analysis; observation count alone
 * does not satisfy corroboration quorum.
 */
export {
  analyzeSourceIndependence,
  effectiveIndependentCount,
  providersShareUpstream,
  evaluateCorroboration,
  minimumCorroborationRule,
} from '@solstice/sunrey-chain/economic-awareness-fabric';

export type { IndependenceAnalysis } from '@solstice/sunrey-chain/economic-awareness-fabric';
