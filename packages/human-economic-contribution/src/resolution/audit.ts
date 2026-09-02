import type { UniquenessControlAudit } from './types.ts';

/**
 * Wave 6 Task 1 — audit of existing uniqueness controls and Wave 6 extensions.
 */
export const HUMAN_ECONOMY_UNIQUENESS_CONTROLS: readonly UniquenessControlAudit[] = Object.freeze([
  {
    control: 'contributionId',
    appliesToHumanEconomy: true,
    scope: 'HumanContributionRegistry per subjectRef:eventReference:createdAt',
    wave6Extension: 'Superseded by canonicalEventId for cross-source resolution; contributionId remains per-registry record',
  },
  {
    control: 'eventReference (eventRef)',
    appliesToHumanEconomy: true,
    scope: 'Per-submission provider record identity',
    wave6Extension: 'Provider record ids feed observation replay keys only; canonical event uses authoritativeIdCommitments',
  },
  {
    control: 'fingerprintEconomicEvent (claim fingerprint)',
    appliesToHumanEconomy: true,
    scope: 'Registry DUPLICATE_FINGERPRINT on active records',
    wave6Extension: 'Extended by contributionResolutionFingerprint with keyed HMAC and wallet-agnostic identity',
  },
  {
    control: 'receiptId / usageReceiptId',
    appliesToHumanEconomy: true,
    scope: 'HIN path DUPLICATE_USAGE_RECEIPT',
    wave6Extension: 'Receipt commitments included in authoritativeIdCommitments for cross-path dedup',
  },
  {
    control: 'hinReplayKey',
    appliesToHumanEconomy: true,
    scope: 'HIN value engine in-memory replay',
    wave6Extension: 'Aligned to resolutionFingerprint via monetizationKeyOf at claim boundary',
  },
  {
    control: 'replayKeyOf (settlement bridge)',
    appliesToHumanEconomy: true,
    scope: 'HumanContributionMonetaryBridge in-memory settlement',
    wave6Extension: 'Wave 3 monetization lock consumes resolutionFingerprint-bound monetizationKey',
  },
  {
    control: 'canonicalEventId (Wave 3 economic-proof)',
    appliesToHumanEconomy: true,
    scope: 'buildHumanEconomicClaim adapter — not wired from HEC registry',
    wave6Extension: 'CanonicalHumanContributionEvent derives compatible canonicalEventId material',
  },
  {
    control: 'monetizationLock (Wave 3)',
    appliesToHumanEconomy: true,
    scope: 'economic-proof registry simulation',
    wave6Extension: 'HumanContributionResolutionEngine enforces per-claim consumption commitment',
  },
  {
    control: 'subjectRef / subjectId',
    appliesToHumanEconomy: true,
    scope: 'Pseudonymous per-path subject references',
    wave6Extension: 'humanEconomicIdentityId resolves wallet/subject aliases to one economic identity',
  },
  {
    control: 'jobId',
    appliesToHumanEconomy: false,
    scope: 'Clean-room computation path only',
    wave6Extension: 'Computation receipts committed as authoritativeIdCommitments for MODEL_TRAINING classes',
  },
  {
    control: 'transaction replay (proof-bound consumption)',
    appliesToHumanEconomy: true,
    scope: 'DUPLICATE_MONETIZATION_KEY in proof-bound pipeline',
    wave6Extension: 'Resolution engine blocks duplicate monetization across wallet/API/restart paths',
  },
]);
