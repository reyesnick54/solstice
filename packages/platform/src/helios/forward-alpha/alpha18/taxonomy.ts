/**
 * HELIOS FORWARD ALPHA — ALPHA18 real forward data admission and evidence classification.
 * Research / simulation only — no execution authority.
 */

export const HELIOS_ALPHA18_WORK_PACKAGE = 'ALPHA18' as const;

export const HELIOS_ALPHA18_FORWARD_DATA_ADMISSION_SCHEMA =
  'sunrey.helios.forward-alpha.alpha18-forward-data-admission.v1' as const;

export const HELIOS_ALPHA18_FORWARD_DATA_ADMISSION_QUALIFIED =
  'HELIOS_ALPHA18_FORWARD_DATA_ADMISSION_QUALIFIED' as const;

export const HELIOS_ALPHA18_FORWARD_DATA_ADMISSION_BLOCKED =
  'HELIOS_ALPHA18_FORWARD_DATA_ADMISSION_BLOCKED' as const;

/** Canonical forward-evidence source classes (admission cannot conflate them). */
export const FORWARD_EVIDENCE_SOURCE_CLASSES = Object.freeze([
  'GENUINE_READONLY_LIVE',
  'DELAYED_LIVE',
  'RECORDED_AFTER_CAMPAIGN_START',
  'HISTORICAL_REPLAY',
  'SYNTHETIC',
  'FIXTURE',
] as const);

export type ForwardEvidenceSourceClass = (typeof FORWARD_EVIDENCE_SOURCE_CLASSES)[number];

/** Source classes that may never contribute to genuine forward-campaign evidence. */
export const NON_GENUINE_FORWARD_SOURCE_CLASSES = Object.freeze([
  'RECORDED_AFTER_CAMPAIGN_START',
  'HISTORICAL_REPLAY',
  'SYNTHETIC',
  'FIXTURE',
] as const);

export type NonGenuineForwardSourceClass = (typeof NON_GENUINE_FORWARD_SOURCE_CLASSES)[number];

export const FORWARD_EVIDENCE_CONTRIBUTION_LANES = Object.freeze([
  'GENUINE_FORWARD_CAMPAIGN',
  'INFRASTRUCTURE_TEST_ONLY',
  'REJECTED',
] as const);

export type ForwardEvidenceContributionLane = (typeof FORWARD_EVIDENCE_CONTRIBUTION_LANES)[number];

/** Outage intervals in forward campaigns — never masquerade gaps as continuous signal. */
export const FORWARD_OUTAGE_PERIOD_CLASSIFICATIONS = Object.freeze(['EVIDENCE_GAP'] as const);

export type ForwardOutagePeriodClassification = (typeof FORWARD_OUTAGE_PERIOD_CLASSIFICATIONS)[number];

/**
 * Forbidden outage label — gaps must be classified as {@link ForwardOutagePeriodClassification}
 * `EVIDENCE_GAP`, not as uninterrupted signal.
 */
export const FORBIDDEN_OUTAGE_MISLABEL = 'NO_SIGNAL' as const;

export const FORWARD_SEQUENCE_INTEGRITY_STATES = Object.freeze([
  'INTACT',
  'GAP_RECOVERED',
  'DESYNCHRONIZED',
] as const);

export type ForwardSequenceIntegrityState = (typeof FORWARD_SEQUENCE_INTEGRITY_STATES)[number];

export const FORWARD_MARKET_DATA_QUALITY_STATES = Object.freeze([
  'VALID',
  'DEGRADED',
  'UNTRUSTED',
  'UNUSABLE',
] as const);

export type ForwardMarketDataQualityState = (typeof FORWARD_MARKET_DATA_QUALITY_STATES)[number];

export const FORWARD_ENTITLEMENT_STATES = Object.freeze([
  'USABLE',
  'RESTRICTED',
  'ENTITLEMENT_BLOCKED',
  'BLOCKED',
  'UNKNOWN',
] as const);

export type ForwardEntitlementState = (typeof FORWARD_ENTITLEMENT_STATES)[number];
