/**
 * HELIOS OS10 — point-in-time corporate fundamentals and SEC intelligence.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  SIMCORP_ENTITY_ID,
  SIMCORP_Q2_2024_10Q,
  SIMCORP_Q2_2024_10Q_A,
  SIMCORP_SUBMISSION_TIMELINE,
  ingestSecFundamentalSubmissions,
} from '../packages/external-data/src/sec-fundamentals/index.ts';
import {
  assertNoFutureFundamentalLeak,
  createHeliosFundamentalFeatureFabric,
  evaluateHeliosOs10PointInTimeFundamentalsQualification,
  HELIOS_OS10_POINT_IN_TIME_FUNDAMENTALS_QUALIFIED,
  effectiveFactsAt,
} from '../packages/platform/src/helios/feature-fabric/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

describe('HELIOS OS10 point-in-time corporate fundamentals', () => {
  it('passes HELIOS boundary lint', () => {
    const findings = lintHeliosBoundary(process.cwd());
    const featureFabricFindings = findings.filter((f) => f.file.includes('helios/feature-fabric'));
    assert.deepEqual(featureFabricFindings, []);
  });

  it('adversarial: Q2 revenue unavailable before filing knowableAt', () => {
    const ingested = ingestSecFundamentalSubmissions(SIMCORP_SUBMISSION_TIMELINE);
    const fabric = createHeliosFundamentalFeatureFabric();
    fabric.ingest(ingested.observations);
    const snap = fabric.snapshotAt({
      canonicalEntityId: SIMCORP_ENTITY_ID,
      evaluationTimeUtc: asUtcInstant('2024-07-31T23:59:59.000Z'),
      reportPeriod: '2024-06-30',
    });
    assert.equal(snap.features.revenue.supported, false);
  });

  it('adversarial: Q2 backtest sees original revenue, not Q3 or pre-restatement amendment', () => {
    const ingested = ingestSecFundamentalSubmissions(SIMCORP_SUBMISSION_TIMELINE);
    const fabric = createHeliosFundamentalFeatureFabric();
    fabric.ingest(ingested.observations);
    const evalTime = asUtcInstant('2024-08-15T12:00:00.000Z');
    const snap = fabric.snapshotAt({
      canonicalEntityId: SIMCORP_ENTITY_ID,
      evaluationTimeUtc: evalTime,
      reportPeriod: '2024-06-30',
      priorReportPeriod: '2024-03-31',
    });
    assert.equal(snap.features.revenue.valueMinor, 1_000_000_000_00n);
    assert.equal(snap.features.revenue.sourceFilingId, SIMCORP_Q2_2024_10Q.filingId);
    assert.equal(assertNoFutureFundamentalLeak({ evaluationTimeUtc: evalTime, snapshot: snap }).ok, true);
    assert.ok(snap.features.revenue_growth.supported);
    assert.ok(snap.features.gross_margin.supported);
    assert.ok(snap.features.fcf.supported);
  });

  it('adversarial: restatement amends effective view without deleting original facts', () => {
    const ingested = ingestSecFundamentalSubmissions(SIMCORP_SUBMISSION_TIMELINE);
    const fabric = createHeliosFundamentalFeatureFabric();
    fabric.ingest(ingested.observations);
    const store = fabric.store();
    const allRevenue = store
      .factsForEntity(SIMCORP_ENTITY_ID)
      .filter((f) => f.concept === 'us-gaap:Revenues' && f.periodEnd === '2024-06-30');
    assert.ok(allRevenue.some((f) => f.filingId === SIMCORP_Q2_2024_10Q.filingId));
    assert.ok(allRevenue.some((f) => f.filingId === SIMCORP_Q2_2024_10Q_A.filingId));

    const afterRestatement = fabric.snapshotAt({
      canonicalEntityId: SIMCORP_ENTITY_ID,
      evaluationTimeUtc: asUtcInstant('2024-10-01T12:00:00.000Z'),
      reportPeriod: '2024-06-30',
    });
    assert.equal(afterRestatement.features.revenue.valueMinor, 980_000_000_00n);
    assert.equal(afterRestatement.features.revenue.sourceFilingId, SIMCORP_Q2_2024_10Q_A.filingId);

    const pitBefore = effectiveFactsAt(store.factsForEntity(SIMCORP_ENTITY_ID), asUtcInstant('2024-08-15T12:00:00.000Z'));
    const pitRev = pitBefore.find((f) => f.concept === 'us-gaap:Revenues' && f.periodEnd === '2024-06-30');
    assert.equal(pitRev?.filingId, SIMCORP_Q2_2024_10Q.filingId);
  });

  it('emits HELIOS_OS10_POINT_IN_TIME_FUNDAMENTALS_QUALIFIED when adversarial checks pass', () => {
    const result = evaluateHeliosOs10PointInTimeFundamentalsQualification();
    assert.equal(result.qualified, true, result.blockers.join('; '));
    assert.equal(result.marker, HELIOS_OS10_POINT_IN_TIME_FUNDAMENTALS_QUALIFIED);
  });
});
