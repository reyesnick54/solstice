import { asUtcInstant } from '@solstice/domain';

import {
  HELIOS_ALPHA18_FORWARD_DATA_ADMISSION_BLOCKED,
  HELIOS_ALPHA18_FORWARD_DATA_ADMISSION_QUALIFIED,
  NON_GENUINE_FORWARD_SOURCE_CLASSES,
} from './taxonomy.ts';
import { admitForwardDataCampaign, classifyForwardEvidence, classifyOutagePeriod } from './admission.ts';
import {
  ALPHA18_FIXTURE_CAMPAIGN_START,
  fixtureForwardObservationReceipt,
} from './fixtures.ts';
import type { Alpha18QualificationResult } from './types.ts';

/**
 * Module qualification — replay/synthetic/fixture cannot masquerade as genuine forward evidence;
 * outages classify as EVIDENCE_GAP; historical backfill cannot claim uninterrupted forward evidence.
 */
export function evaluateAlpha18ForwardDataAdmissionQualification(): Alpha18QualificationResult {
  const campaignStartedAt = ALPHA18_FIXTURE_CAMPAIGN_START;
  let gateFailures = 0;

  const genuine = classifyForwardEvidence(
    fixtureForwardObservationReceipt({ sourceClass: 'GENUINE_READONLY_LIVE' }),
  );
  if (!genuine.contributesToGenuineForwardEvidence) {
    gateFailures += 1;
  }

  for (const sourceClass of NON_GENUINE_FORWARD_SOURCE_CLASSES) {
    const row = classifyForwardEvidence(fixtureForwardObservationReceipt({ sourceClass, receiptId: sourceClass }));
    if (row.contributesToGenuineForwardEvidence || row.contributionLane !== 'INFRASTRUCTURE_TEST_ONLY') {
      gateFailures += 1;
    }
  }

  const historicalReplay = classifyForwardEvidence(
    fixtureForwardObservationReceipt({ sourceClass: 'HISTORICAL_REPLAY' }),
  );
  if (historicalReplay.contributesToGenuineForwardEvidence) {
    gateFailures += 1;
  }

  const preCampaign = classifyForwardEvidence(
    fixtureForwardObservationReceipt({
      sourceClass: 'GENUINE_READONLY_LIVE',
      sunreyArrivalTime: asUtcInstant('2026-05-31T23:59:59.000Z'),
    }),
  );
  if (preCampaign.contributesToGenuineForwardEvidence) {
    gateFailures += 1;
  }

  const delayedBlocked = classifyForwardEvidence(
    fixtureForwardObservationReceipt({
      sourceClass: 'DELAYED_LIVE',
      delayedLivePolicy: { approved: false, economicallySuitable: true },
    }),
  );
  if (delayedBlocked.contributesToGenuineForwardEvidence) {
    gateFailures += 1;
  }

  const delayedApproved = classifyForwardEvidence(
    fixtureForwardObservationReceipt({
      sourceClass: 'DELAYED_LIVE',
      receiptId: 'delayed_ok',
      delayedLivePolicy: { approved: true, economicallySuitable: true },
    }),
  );
  if (!delayedApproved.contributesToGenuineForwardEvidence) {
    gateFailures += 1;
  }

  const outage = classifyOutagePeriod({
    outageId: 'gap_1',
    campaignId: 'fwd_camp_alpha18',
    gapStartedAt: '2026-06-01T15:00:00.000Z',
    gapEndedAt: '2026-06-01T15:30:00.000Z',
  });
  if (outage.classification !== 'EVIDENCE_GAP') {
    gateFailures += 1;
  }

  let threwOnNoSignal = false;
  try {
    classifyOutagePeriod({
      outageId: 'gap_bad_label',
      campaignId: 'fwd_camp_alpha18',
      gapStartedAt: '2026-06-01T16:00:00.000Z',
      gapEndedAt: '2026-06-01T16:05:00.000Z',
      proposedLabel: 'NO_SIGNAL',
    });
  } catch {
    threwOnNoSignal = true;
  }
  if (!threwOnNoSignal) {
    gateFailures += 1;
  }

  const filler = fixtureForwardObservationReceipt({
    sourceClass: 'HISTORICAL_REPLAY',
    receiptId: 'backfill_filler',
    eventTimestamp: '2026-06-01T15:15:00.000Z',
  });
  const admission = admitForwardDataCampaign({
    campaignId: 'fwd_camp_alpha18',
    campaignStartedAt,
    receipts: [
      fixtureForwardObservationReceipt({ sourceClass: 'GENUINE_READONLY_LIVE', receiptId: 'live_1' }),
    ],
    outagePeriods: [outage],
    backfillAttempts: [{ outageId: outage.outageId, fillerReceipt: filler }],
  });
  if (!admission.outageBackfillDetected || admission.uninterruptedForwardEvidence) {
    gateFailures += 1;
  }

  const qualified = gateFailures === 0;
  return Object.freeze({
    qualified,
    marker: qualified
      ? HELIOS_ALPHA18_FORWARD_DATA_ADMISSION_QUALIFIED
      : HELIOS_ALPHA18_FORWARD_DATA_ADMISSION_BLOCKED,
    grantsFinancialAuthority: false,
  });
}
