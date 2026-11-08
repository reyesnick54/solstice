/**
 * ALPHA18 — classify and admit forward observations; block replay/synthetic masquerading as live forward evidence.
 */

import type { UtcInstant } from '@solstice/domain';

import {
  FORBIDDEN_OUTAGE_MISLABEL,
  FORWARD_OUTAGE_PERIOD_CLASSIFICATIONS,
  HELIOS_ALPHA18_FORWARD_DATA_ADMISSION_SCHEMA,
  NON_GENUINE_FORWARD_SOURCE_CLASSES,
} from './taxonomy.ts';
import type {
  DelayedLiveAdmissionPolicy,
  ForwardDataAdmission,
  ForwardDataAdmissionInput,
  ForwardEvidenceClassification,
  ForwardEvidenceSource,
  ForwardEvidenceSourceClass,
  ForwardObservationReceipt,
  ForwardOutagePeriod,
} from './types.ts';

function parseMs(at: UtcInstant): number {
  return Date.parse(at);
}

function assertChronology(receipt: ForwardObservationReceipt): readonly string[] {
  const blockers: string[] = [];
  if (!receipt.providerIdentity.trim()) {
    blockers.push('MISSING_PROVIDER_IDENTITY');
  }
  if (!receipt.providerQualification.trim()) {
    blockers.push('MISSING_PROVIDER_QUALIFICATION');
  }
  if (!receipt.rawEvidenceReference.trim()) {
    blockers.push('MISSING_RAW_EVIDENCE_REFERENCE');
  }
  if (parseMs(receipt.knowableAt) < parseMs(receipt.eventTimestamp)) {
    blockers.push('KNOWABLE_BEFORE_EVENT');
  }
  if (receipt.providerIdentity !== receipt.source.providerIdentity) {
    blockers.push('PROVIDER_IDENTITY_MISMATCH');
  }
  if (receipt.campaignStartedAt !== receipt.source.campaignStartedAt) {
    blockers.push('CAMPAIGN_START_MISMATCH');
  }
  return Object.freeze(blockers);
}

export function sourceClassMayContributeToGenuineForward(
  sourceClass: ForwardEvidenceSourceClass,
  delayedLivePolicy: DelayedLiveAdmissionPolicy | null,
): boolean {
  if (sourceClass === 'GENUINE_READONLY_LIVE') {
    return true;
  }
  if (sourceClass === 'DELAYED_LIVE') {
    return delayedLivePolicy?.approved === true && delayedLivePolicy.economicallySuitable === true;
  }
  return false;
}

export function classifyForwardEvidenceSource(source: ForwardEvidenceSource): {
  readonly infrastructureTestOnly: boolean;
  readonly mayContributeGenuineForward: boolean;
} {
  const mayContributeGenuineForward = sourceClassMayContributeToGenuineForward(
    source.sourceClass,
    source.delayedLivePolicy,
  );
  const infrastructureTestOnly = (NON_GENUINE_FORWARD_SOURCE_CLASSES as readonly string[]).includes(
    source.sourceClass,
  );
  return Object.freeze({ infrastructureTestOnly, mayContributeGenuineForward });
}

export function classifyForwardEvidence(receipt: ForwardObservationReceipt): ForwardEvidenceClassification {
  const blockers = [...assertChronology(receipt)];
  const arrivalOnOrAfterCampaignStart =
    parseMs(receipt.sunreyArrivalTime) >= parseMs(receipt.campaignStartedAt);

  if (!arrivalOnOrAfterCampaignStart) {
    blockers.push('ARRIVAL_BEFORE_CAMPAIGN_START');
  }

  const { mayContributeGenuineForward } = classifyForwardEvidenceSource(receipt.source);

  if (!mayContributeGenuineForward) {
    blockers.push(`SOURCE_CLASS_${receipt.source.sourceClass}_NOT_GENUINE_FORWARD`);
  }

  if (receipt.sequenceIntegrity === 'DESYNCHRONIZED') {
    blockers.push('SEQUENCE_DESYNCHRONIZED');
  }
  if (receipt.marketDataQuality === 'UNUSABLE' || receipt.marketDataQuality === 'UNTRUSTED') {
    blockers.push('MARKET_DATA_QUALITY_BLOCKED');
  }
  if (
    receipt.entitlementState === 'BLOCKED' ||
    receipt.entitlementState === 'ENTITLEMENT_BLOCKED' ||
    receipt.entitlementState === 'UNKNOWN'
  ) {
    blockers.push('ENTITLEMENT_BLOCKED');
  }

  const sourceEligible = mayContributeGenuineForward && arrivalOnOrAfterCampaignStart;
  const qualityEligible =
    receipt.sequenceIntegrity !== 'DESYNCHRONIZED' &&
    receipt.marketDataQuality !== 'UNUSABLE' &&
    receipt.marketDataQuality !== 'UNTRUSTED' &&
    receipt.entitlementState !== 'BLOCKED' &&
    receipt.entitlementState !== 'ENTITLEMENT_BLOCKED' &&
    receipt.entitlementState !== 'UNKNOWN';

  const chronologyClean = blockers.every(
    (code) =>
      ![
        'MISSING_PROVIDER_IDENTITY',
        'MISSING_PROVIDER_QUALIFICATION',
        'MISSING_RAW_EVIDENCE_REFERENCE',
        'KNOWABLE_BEFORE_EVENT',
        'PROVIDER_IDENTITY_MISMATCH',
        'CAMPAIGN_START_MISMATCH',
      ].includes(code),
  );

  const contributesToGenuineForwardEvidence =
    sourceEligible && qualityEligible && chronologyClean && blockers.length === 0;

  let contributionLane: ForwardEvidenceClassification['contributionLane'];
  if (contributesToGenuineForwardEvidence) {
    contributionLane = 'GENUINE_FORWARD_CAMPAIGN';
  } else if (
    (NON_GENUINE_FORWARD_SOURCE_CLASSES as readonly string[]).includes(receipt.source.sourceClass)
  ) {
    contributionLane = 'INFRASTRUCTURE_TEST_ONLY';
  } else {
    contributionLane = 'REJECTED';
  }

  return Object.freeze({
    schema: HELIOS_ALPHA18_FORWARD_DATA_ADMISSION_SCHEMA,
    receiptId: receipt.receiptId,
    sourceClass: receipt.source.sourceClass,
    contributionLane,
    contributesToGenuineForwardEvidence,
    arrivalOnOrAfterCampaignStart,
    blockers: Object.freeze(blockers),
  });
}

export function classifyOutagePeriod(input: {
  readonly outageId: string;
  readonly campaignId: string;
  readonly gapStartedAt: UtcInstant;
  readonly gapEndedAt: UtcInstant;
  readonly proposedLabel?: string;
}): ForwardOutagePeriod {
  if (input.proposedLabel === FORBIDDEN_OUTAGE_MISLABEL) {
    throw new Error(
      'forward outage must be classified as EVIDENCE_GAP, not NO_SIGNAL — gaps are not uninterrupted forward evidence',
    );
  }
  if (parseMs(input.gapEndedAt) < parseMs(input.gapStartedAt)) {
    throw new Error('outage gapEndedAt must not precede gapStartedAt');
  }
  const classification = FORWARD_OUTAGE_PERIOD_CLASSIFICATIONS[0]!;
  return Object.freeze({
    outageId: input.outageId,
    campaignId: input.campaignId,
    gapStartedAt: input.gapStartedAt,
    gapEndedAt: input.gapEndedAt,
    classification,
  });
}

function receiptFillsOutageGap(
  outage: ForwardOutagePeriod,
  receipt: ForwardObservationReceipt,
): boolean {
  const eventMs = parseMs(receipt.eventTimestamp);
  const startMs = parseMs(outage.gapStartedAt);
  const endMs = parseMs(outage.gapEndedAt);
  return eventMs >= startMs && eventMs <= endMs;
}

function isNonLiveBackfillSource(sourceClass: ForwardEvidenceSourceClass): boolean {
  return (
    sourceClass === 'HISTORICAL_REPLAY' ||
    sourceClass === 'SYNTHETIC' ||
    sourceClass === 'FIXTURE' ||
    sourceClass === 'RECORDED_AFTER_CAMPAIGN_START'
  );
}

export function admitForwardDataCampaign(input: ForwardDataAdmissionInput): ForwardDataAdmission {
  const classifications = input.receipts.map((receipt) => classifyForwardEvidence(receipt));
  const outagePeriods = Object.freeze([...(input.outagePeriods ?? [])]);

  const genuineForwardReceiptIds: string[] = [];
  const infrastructureOnlyReceiptIds: string[] = [];
  const rejectedReceiptIds: string[] = [];

  for (const row of classifications) {
    if (row.contributesToGenuineForwardEvidence) {
      genuineForwardReceiptIds.push(row.receiptId);
    } else if (row.contributionLane === 'INFRASTRUCTURE_TEST_ONLY') {
      infrastructureOnlyReceiptIds.push(row.receiptId);
    } else {
      rejectedReceiptIds.push(row.receiptId);
    }
  }

  const blockers: string[] = [];
  let outageBackfillDetected = false;

  for (const attempt of input.backfillAttempts ?? []) {
    const outage = outagePeriods.find((row) => row.outageId === attempt.outageId);
    if (!outage) {
      blockers.push(`UNKNOWN_OUTAGE:${attempt.outageId}`);
      continue;
    }
    if (
      isNonLiveBackfillSource(attempt.fillerReceipt.source.sourceClass) &&
      receiptFillsOutageGap(outage, attempt.fillerReceipt)
    ) {
      outageBackfillDetected = true;
      blockers.push(`OUTAGE_BACKFILL_FORBIDDEN:${attempt.outageId}`);
    }
  }

  if (outagePeriods.length > 0 && outageBackfillDetected) {
    blockers.push('UNINTERRUPTED_FORWARD_EVIDENCE_CLAIM_FORBIDDEN');
  }

  const hasEvidenceGaps = outagePeriods.length > 0;
  const uninterruptedForwardEvidence = !hasEvidenceGaps && !outageBackfillDetected && blockers.length === 0;

  return Object.freeze({
    schema: HELIOS_ALPHA18_FORWARD_DATA_ADMISSION_SCHEMA,
    campaignId: input.campaignId,
    campaignStartedAt: input.campaignStartedAt,
    classifications: Object.freeze(classifications),
    outagePeriods,
    genuineForwardReceiptIds: Object.freeze(genuineForwardReceiptIds),
    infrastructureOnlyReceiptIds: Object.freeze(infrastructureOnlyReceiptIds),
    rejectedReceiptIds: Object.freeze(rejectedReceiptIds),
    uninterruptedForwardEvidence,
    outageBackfillDetected,
    blockers: Object.freeze(blockers),
  });
}

/** @alias admitForwardDataCampaign — campaign-level forward data admission record. */
export const buildForwardDataAdmission = admitForwardDataCampaign;
