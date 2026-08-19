export {
  ATTRIBUTION_ACCOUNTING_DOMAIN,
  ATTRIBUTION_ACCOUNTING_SCHEMA_VERSION,
  ATTRIBUTION_BOOK_IS_MONETARY_LEDGER,
  ATTRIBUTION_BOOK_STORES_MOONREY_BALANCE,
  ATTRIBUTION_ENTRY_STATUSES,
  ATTRIBUTION_ISSUANCE_STATUSES,
  ATTRIBUTION_PRODUCTION_ACTIVE,
  ATTRIBUTION_REJECTION_CODES,
  ATTRIBUTION_SENSITIVE_CATEGORIES,
  ATTRIBUTION_SHARE_SCALE,
  BATCH_LINEAGE_KINDS,
  DEFAULT_MAXIMUM_AGGREGATE_SHARE,
  INDEPENDENT_SERVICE_CATEGORIES,
  TIME_WINDOW_QUANTUM_SECONDS,
  attributionFailure,
  isAttributionSensitiveCategory,
  isIndependentServiceCategory,
} from './types.ts';
export type {
  AttributionBatchLineage,
  AttributionCorrectionRecord,
  AttributionEntryStatus,
  AttributionEventObservation,
  AttributionFailure,
  AttributionInvariantViolation,
  AttributionIssuanceStatus,
  AttributionOk,
  AttributionRejectionCode,
  AttributionReplayKeys,
  AttributionReservationRequest,
  AttributionResult,
  ProductiveAttributionDecision,
  ProductiveAttributionEntry,
  ProductiveAttributionReconciliationReport,
} from './types.ts';
export type { AttributionEligibilityInput } from './eligibility-gate.ts';
export {
  addShares,
  assertShare,
  fullyAttributed,
  overAllocated,
  policyMaximum,
  remainingShare,
  shareExhausted,
  shareWouldExceed,
} from './shares.ts';
export {
  buildReplayKeys,
  canonicalUnitId,
  categoryStrippedFingerprint,
  claimReplayKey,
  contributionReplayKey,
  controllerStrippedFingerprint,
  deriveEconomicEventId,
  evidenceFingerprint,
  idempotencyKey,
  objectStrippedFingerprint,
  observationFingerprint,
  quantizedWindowKey,
  quantizeUnixSeconds,
} from './identity.ts';
export { isAdjacentCycle, observationsOverlap, windowContains, windowsOverlap } from './windows.ts';
export { ProductiveAttributionBook, simulationAttributionDecision } from './book.ts';
export {
  availableAttributionShare,
  evaluateAttributionEligibility,
  routeRequiresAttribution,
} from './eligibility-gate.ts';
export type { AttributionEligibilityOk } from './eligibility-gate.ts';
export {
  attributionStateIsNotRegistryDataset,
  reflectAttributionLineage,
  refuseRawAttributionDatasetStore,
} from './ear.ts';
export {
  DEMO_HOUR_END,
  DEMO_HOUR_MID,
  DEMO_HOUR_START,
  goodsObservation,
  logisticsObservation,
  machineObservation,
  manufacturingObservation,
  storageObservation,
} from './fixtures.ts';
