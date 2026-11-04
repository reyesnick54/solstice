/**
 * EARN01 — canonical earnings intelligence domain qualification.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/index.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { mapSecGuidanceToExternalEarningsEnvelope } from '../packages/external-data/src/earnings/index.ts';
import type { GuidanceObservation } from '../packages/external-data/src/sec-fundamentals/types.ts';
import {
  EARNINGS_ANNOUNCEMENT_STATES,
  EARNINGS_SESSION_CLASSIFICATIONS,
  HELIOS_EARN01_DOMAIN_QUALIFIED,
  compileEarningsIntelligenceManifest,
  createEarningsIntelligenceStore,
  demoActualAfterRelease,
  demoConsensusBeforeRelease,
  demoEarningsEventReleased,
  demoFutureLeakingActual,
  evaluateEarn01DomainQualification,
  filterKnowableEarningsArtifacts,
} from '../packages/platform/src/helios/earnings-intelligence/index.ts';
import {
  compileEarningsFeaturePlaneFromManifest,
  earningsObservationsToContributions,
} from '../packages/platform/src/helios/feature-fabric/earnings/index.ts';

const AFTER_RELEASE = asUtcInstant('2024-08-15T22:00:00.000Z');
const BEFORE_LEAK = asUtcInstant('2024-08-16T08:00:00.000Z');

describe('HELIOS EARN01 earnings intelligence domain', () => {
  it('simulation posture', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
  });

  it('taxonomy covers announcement states and session classification', () => {
    assert.deepEqual(EARNINGS_ANNOUNCEMENT_STATES, [
      'EXPECTED',
      'CONFIRMED',
      'RELEASED',
      'CALL_SCHEDULED',
      'CALL_COMPLETED',
      'AMENDED',
      'CANCELLED',
      'UNKNOWN',
    ]);
    assert.deepEqual(EARNINGS_SESSION_CLASSIFICATIONS, [
      'BEFORE_MARKET',
      'DURING_MARKET',
      'AFTER_MARKET',
      'NON_TRADING_DAY',
      'UNKNOWN',
    ]);
  });

  it('no leakage — future knowableAt hidden until evaluation time', () => {
    const store = createEarningsIntelligenceStore();
    store.upsertEvent(demoEarningsEventReleased());
    store.appendObservation(demoConsensusBeforeRelease());
    store.appendObservation(demoFutureLeakingActual());

    const before = store.snapshotKnowableAt(BEFORE_LEAK);
    assert.equal(before.observations.length, 1);
    assert.equal(before.observations[0]?.observationKind, 'consensus');

    const after = store.snapshotKnowableAt(asUtcInstant('2024-08-16T13:00:00.000Z'));
    assert.equal(after.observations.length, 2);
  });

  it('manifest compile rejects leakage', () => {
    const store = createEarningsIntelligenceStore();
    store.upsertEvent(demoEarningsEventReleased());
    store.appendObservation(demoFutureLeakingActual());
    assert.throws(() =>
      compileEarningsIntelligenceManifest({
        evaluationTime: BEFORE_LEAK,
        compiledAt: BEFORE_LEAK,
        snapshot: store.snapshot(),
      }),
    );
  });

  it('feature fabric bridge respects knowableAt for surprise', () => {
    const store = createEarningsIntelligenceStore();
    store.upsertEvent(demoEarningsEventReleased());
    store.appendObservation(demoConsensusBeforeRelease());
    store.appendObservation(demoActualAfterRelease());

    const midWindow = asUtcInstant('2024-08-15T21:05:00.000Z');
    const manifestMid = compileEarningsIntelligenceManifest({
      evaluationTime: midWindow,
      compiledAt: midWindow,
      snapshot: store.snapshotKnowableAt(midWindow),
    });
    assert.equal(manifestMid.observations.length, 1);
    assert.equal(manifestMid.events.length, 0);
    const contributionsMid = earningsObservationsToContributions({
      evaluationTime: midWindow,
      consensus: demoConsensusBeforeRelease(),
      actual: demoActualAfterRelease(),
    });
    assert.equal(contributionsMid.length, 1);

    const manifestAfter = compileEarningsIntelligenceManifest({
      evaluationTime: AFTER_RELEASE,
      compiledAt: AFTER_RELEASE,
      snapshot: store.snapshotKnowableAt(AFTER_RELEASE),
    });
    const planeAfter = compileEarningsFeaturePlaneFromManifest({ manifest: manifestAfter });
    assert.ok(planeAfter);
    const surprise = planeAfter!.features.find((row) => row.featureId === 'earn01.eps_surprise_bps');
    assert.equal(surprise?.valueMinor, 560n);

    const contributions = earningsObservationsToContributions({
      evaluationTime: AFTER_RELEASE,
      consensus: demoConsensusBeforeRelease(),
      actual: demoActualAfterRelease(),
    });
    assert.equal(contributions.length, 2);
  });

  it('SEC guidance maps into external earnings envelope without bypassing knowableAt', () => {
    const guidance: GuidanceObservation = Object.freeze({
      observationKind: 'guidance',
      filingId: 'filing.demo',
      accessionNumber: 'acc.demo',
      form: '8-K',
      filingDate: '2024-08-01',
      acceptedAtUtc: asUtcInstant('2024-08-01T16:00:00.000Z'),
      publishedAtUtc: asUtcInstant('2024-08-01T16:05:00.000Z'),
      fiscalPeriod: 'FY2024-Q3',
      reportPeriod: '2024-09-30',
      source: 'sec.edgar',
      knowableAt: asUtcInstant('2024-08-01T16:10:00.000Z'),
      amendmentLineage: Object.freeze({
        kind: 'original',
        supersedesFilingId: null,
        amendsFilingId: null,
        rootFilingId: 'filing.demo',
      }),
      canonicalEntityId: 'entity.demo',
      evidenceRef: 'evidence.sec.demo',
      metric: 'revenue',
      guidanceLowMinor: 1_000_000n,
      guidanceHighMinor: 1_100_000n,
      guidanceText: null,
    });
    const envelope = mapSecGuidanceToExternalEarningsEnvelope(guidance);
    assert.equal(envelope.grantsExecutionAuthority, false);
    assert.equal(envelope.knowableAt, guidance.knowableAt);
    const visible = filterKnowableEarningsArtifacts(asUtcInstant('2024-08-01T16:09:00.000Z'), [envelope]);
    assert.equal(visible.length, 0);
  });

  it('domain qualification marker', () => {
    const result = evaluateEarn01DomainQualification({
      coreTypesDefined: true,
      announcementStatesComplete: true,
      sessionClassificationComplete: true,
      knowableAtEnforced: true,
      noExecutionAuthorityOnArtifacts: true,
      extendsSecFundamentalsNotDuplicate: true,
      extendsFeatureFabricNotDuplicate: true,
    });
    assert.equal(result.marker, HELIOS_EARN01_DOMAIN_QUALIFIED);
    assert.equal(result.qualified, true);
  });
});
