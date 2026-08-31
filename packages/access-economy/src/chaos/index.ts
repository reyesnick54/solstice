/**
 * ACCESS Wave 5 / Prompt 41 — chaos testing exports.
 */

export {
  ACCESS_CHAOS_INVARIANT_IDS,
  allChaosInvariantsHeld,
  checkAccessChaosInvariants,
  summarizeWave1,
  type AccessChaosInvariantId,
  type AccessChaosInvariantResult,
  type AccessInvariantSnapshot,
} from './invariants.ts';

export {
  buildLatencyPercentiles,
  percentile,
  utilizationBps,
  type AccessChaosMetrics,
} from './metrics.ts';

export { scanAccessPathsForSecrets, type SecretScanFinding } from './secret-scan.ts';

export {
  assertProviderPayloadMinimal,
  scanPayloadForForbiddenPii,
  type PrivacyViolation,
} from './privacy.ts';

export {
  CHAOS_NOW,
  CHAOS_USER,
  createWave3TestStack,
  mobilityQuote,
  quoteCheckout,
  reserveAndBook,
  seedMobilityEntitlement,
  seedMobilityFundingPool,
  startMobilityTx,
  suspendFundingPool,
  type ChaosStack,
} from './harness.ts';
