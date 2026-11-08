/**
 * HELIOS Forward Alpha ALPHA18 — real forward data admission and evidence classification.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  FORBIDDEN_OUTAGE_MISLABEL,
  HELIOS_ALPHA18_FORWARD_DATA_ADMISSION_QUALIFIED,
  NON_GENUINE_FORWARD_SOURCE_CLASSES,
  admitForwardDataCampaign,
  classifyForwardEvidence,
  classifyOutagePeriod,
  evaluateAlpha18ForwardDataAdmissionQualification,
  fixtureForwardObservationReceipt,
  sourceClassMayContributeToGenuineForward,
} from '../packages/platform/src/helios/forward-alpha/alpha18/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const ROOT = process.cwd();
const CAMPAIGN_START = asUtcInstant('2026-06-01T14:00:00.000Z');

describe('HELIOS Forward Alpha ALPHA18 forward data admission', () => {
  it('passes architectural HELIOS boundary lint for alpha18 module', () => {
    const findings = lintHeliosBoundary(ROOT).filter((row) => row.file.includes('forward-alpha/alpha18'));
    assert.equal(findings.length, 0, JSON.stringify(findings));
  });

  it('module qualification marker is HELIOS_ALPHA18_FORWARD_DATA_ADMISSION_QUALIFIED', () => {
    const result = evaluateAlpha18ForwardDataAdmissionQualification();
    assert.equal(result.qualified, true);
    assert.equal(result.marker, HELIOS_ALPHA18_FORWARD_DATA_ADMISSION_QUALIFIED);
    assert.equal(result.grantsFinancialAuthority, false);
  });

  it('only GENUINE_READONLY_LIVE and policy-approved DELAYED_LIVE may contribute genuine forward evidence', () => {
    assert.equal(sourceClassMayContributeToGenuineForward('GENUINE_READONLY_LIVE', null), true);
    assert.equal(
      sourceClassMayContributeToGenuineForward('DELAYED_LIVE', { approved: true, economicallySuitable: true }),
      true,
    );
    assert.equal(
      sourceClassMayContributeToGenuineForward('DELAYED_LIVE', { approved: true, economicallySuitable: false }),
      false,
    );
    for (const sourceClass of NON_GENUINE_FORWARD_SOURCE_CLASSES) {
      assert.equal(sourceClassMayContributeToGenuineForward(sourceClass, null), false, sourceClass);
    }
  });

  it('classifies historical replay and synthetic as infrastructure-only, never genuine forward', () => {
    for (const sourceClass of ['HISTORICAL_REPLAY', 'SYNTHETIC', 'FIXTURE'] as const) {
      const row = classifyForwardEvidence(fixtureForwardObservationReceipt({ sourceClass }));
      assert.equal(row.contributesToGenuineForwardEvidence, false);
      assert.equal(row.contributionLane, 'INFRASTRUCTURE_TEST_ONLY');
    }
  });

  it('requires sunreyArrivalTime on or after campaignStartedAt for genuine forward contribution', () => {
    const admitted = classifyForwardEvidence(
      fixtureForwardObservationReceipt({
        sourceClass: 'GENUINE_READONLY_LIVE',
        sunreyArrivalTime: asUtcInstant('2026-06-01T14:00:00.000Z'),
      }),
    );
    assert.equal(admitted.contributesToGenuineForwardEvidence, true);

    const tooEarly = classifyForwardEvidence(
      fixtureForwardObservationReceipt({
        sourceClass: 'GENUINE_READONLY_LIVE',
        sunreyArrivalTime: asUtcInstant('2026-05-31T12:00:00.000Z'),
      }),
    );
    assert.equal(tooEarly.contributesToGenuineForwardEvidence, false);
    assert.ok(tooEarly.blockers.includes('ARRIVAL_BEFORE_CAMPAIGN_START'));
  });

  it('classifies outage intervals as EVIDENCE_GAP and rejects NO_SIGNAL mislabel', () => {
    const gap = classifyOutagePeriod({
      outageId: 'gap_alpha18',
      campaignId: 'fwd_camp_alpha18',
      gapStartedAt: asUtcInstant('2026-06-01T15:00:00.000Z'),
      gapEndedAt: asUtcInstant('2026-06-01T15:30:00.000Z'),
    });
    assert.equal(gap.classification, 'EVIDENCE_GAP');
    assert.throws(
      () =>
        classifyOutagePeriod({
          outageId: 'gap_bad',
          campaignId: 'fwd_camp_alpha18',
          gapStartedAt: asUtcInstant('2026-06-01T16:00:00.000Z'),
          gapEndedAt: asUtcInstant('2026-06-01T16:05:00.000Z'),
          proposedLabel: FORBIDDEN_OUTAGE_MISLABEL,
        }),
      /EVIDENCE_GAP/,
    );
  });

  it('forbids backfilling an outage with historical replay as uninterrupted forward evidence', () => {
    const outage = classifyOutagePeriod({
      outageId: 'gap_backfill',
      campaignId: 'fwd_camp_alpha18',
      gapStartedAt: asUtcInstant('2026-06-01T15:00:00.000Z'),
      gapEndedAt: asUtcInstant('2026-06-01T15:30:00.000Z'),
    });
    const admission = admitForwardDataCampaign({
      campaignId: 'fwd_camp_alpha18',
      campaignStartedAt: CAMPAIGN_START,
      receipts: [
        fixtureForwardObservationReceipt({
          sourceClass: 'GENUINE_READONLY_LIVE',
          receiptId: 'live_before_gap',
        }),
      ],
      outagePeriods: [outage],
      backfillAttempts: [
        {
          outageId: outage.outageId,
          fillerReceipt: fixtureForwardObservationReceipt({
            sourceClass: 'HISTORICAL_REPLAY',
            receiptId: 'replay_fill',
            eventTimestamp: asUtcInstant('2026-06-01T15:10:00.000Z'),
          }),
        },
      ],
    });
    assert.equal(admission.outageBackfillDetected, true);
    assert.equal(admission.uninterruptedForwardEvidence, false);
    assert.ok(admission.blockers.some((code) => code.startsWith('OUTAGE_BACKFILL_FORBIDDEN')));
  });
});
