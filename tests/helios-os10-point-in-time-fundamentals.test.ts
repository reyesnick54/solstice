/**
 * HELIOS OS10 — point-in-time corporate fundamentals and SEC intelligence.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { bindSecFilingsToAafRevisionLedger } from '../packages/economic-awareness-fabric/src/integrations/sec-filing-revisions.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  SIMCORP_ENTITY_ID,
  SIMCORP_Q2_2024_10Q,
  SIMCORP_Q2_2024_10Q_A,
  SIMCORP_SUBMISSION_TIMELINE,
  ingestSecFundamentalSubmissions,
  mapSecObservationsToAafFilingSources,
  mapSecObservationsToHeliosFacts,
} from '../packages/external-data/src/sec-fundamentals/index.ts';
import {
  assertNoFutureFundamentalLeak,
  createHeliosFundamentalFeatureFabric,
  evaluateHeliosOs10PointInTimeFundamentalsQualification,
  effectiveFactsAt,
  HELIOS_OS10_POINT_IN_TIME_FUNDAMENTALS_QUALIFIED,
  type FundamentalFactRecord,
  type HeliosOs10QualificationChecks,
} from '../packages/platform/src/helios/feature-fabric/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

function asFactRecords(rows: ReturnType<typeof mapSecObservationsToHeliosFacts>): FundamentalFactRecord[] {
  return rows.map((row) =>
    Object.freeze({
      ...row,
      knowableAt: asUtcInstant(row.knowableAt),
    }),
  );
}

function runOs10AdversarialChecks(): HeliosOs10QualificationChecks {
  const ingested = ingestSecFundamentalSubmissions(SIMCORP_SUBMISSION_TIMELINE);
  const fabric = createHeliosFundamentalFeatureFabric();
  fabric.ingestFacts(asFactRecords(mapSecObservationsToHeliosFacts(ingested.observations)));

  const beforeQ2Filed = fabric.snapshotAt({
    canonicalEntityId: SIMCORP_ENTITY_ID,
    evaluationTimeUtc: asUtcInstant('2024-07-31T23:59:59.000Z'),
    reportPeriod: '2024-06-30',
  });

  const evalTime = asUtcInstant('2024-08-15T12:00:00.000Z');
  const q2Backtest = fabric.snapshotAt({
    canonicalEntityId: SIMCORP_ENTITY_ID,
    evaluationTimeUtc: evalTime,
    reportPeriod: '2024-06-30',
    priorReportPeriod: '2024-03-31',
  });

  const afterRestatement = fabric.snapshotAt({
    canonicalEntityId: SIMCORP_ENTITY_ID,
    evaluationTimeUtc: asUtcInstant('2024-10-01T12:00:00.000Z'),
    reportPeriod: '2024-06-30',
  });

  const store = fabric.store();
  const allQ2RevenueFacts = store
    .factsForEntity(SIMCORP_ENTITY_ID)
    .filter((f) => f.periodEnd === '2024-06-30' && f.concept === 'us-gaap:Revenues');

  const binding = bindSecFilingsToAafRevisionLedger({
    cik: '0000999999',
    ticker: 'SIMC',
    filings: mapSecObservationsToAafFilingSources(ingested.observations),
  });
  const effective = binding.ledger.effectiveFilingIdsAt(
    SIMCORP_Q2_2024_10Q.filingId,
    '2024-10-01T12:00:00.000Z',
  );

  const pitFacts = effectiveFactsAt(store.factsForEntity(SIMCORP_ENTITY_ID), evalTime);
  const pitRevenue = pitFacts.find((f) => f.concept === 'us-gaap:Revenues' && f.periodEnd === '2024-06-30');

  const q2Facts = store.factsForEntity(SIMCORP_ENTITY_ID).filter((f) => f.periodEnd === '2024-06-30');

  return Object.freeze({
    noQ2BeforeFiling: !beforeQ2Filed.features.revenue.supported,
    q2OriginalRevenueAtBacktest:
      q2Backtest.features.revenue.supported && q2Backtest.features.revenue.valueMinor === 1_000_000_000_00n,
    noFutureLeakQ2Window: assertNoFutureFundamentalLeak({ evaluationTimeUtc: evalTime, snapshot: q2Backtest }).ok,
    restatementUpdatesEffectiveRevenue:
      afterRestatement.features.revenue.supported && afterRestatement.features.revenue.valueMinor === 980_000_000_00n,
    restatementPreservesOriginalFacts: allQ2RevenueFacts.length >= 2,
    aafRevisionLedgerTracksAmendment:
      effective.includes(SIMCORP_Q2_2024_10Q.filingId) && effective.includes(SIMCORP_Q2_2024_10Q_A.filingId),
    pitEffectiveFactBeforeRestatement: pitRevenue?.filingId === SIMCORP_Q2_2024_10Q.filingId,
    derivedMarginsWhenFactsSupport:
      q2Backtest.features.gross_margin.supported && q2Backtest.features.operating_margin.supported && q2Facts.length > 0,
  });
}

describe('HELIOS OS10 point-in-time corporate fundamentals', () => {
  it('passes HELIOS boundary lint', () => {
    const findings = lintHeliosBoundary(process.cwd());
    const featureFabricFindings = findings.filter((f) => f.file.includes('helios/feature-fabric'));
    assert.deepEqual(featureFabricFindings, []);
  });

  it('adversarial: Q2 revenue unavailable before filing knowableAt', () => {
    const checks = runOs10AdversarialChecks();
    assert.equal(checks.noQ2BeforeFiling, true);
  });

  it('adversarial: Q2 backtest sees original revenue, not Q3 or pre-restatement amendment', () => {
    const checks = runOs10AdversarialChecks();
    assert.equal(checks.q2OriginalRevenueAtBacktest, true);
    assert.equal(checks.noFutureLeakQ2Window, true);
  });

  it('adversarial: restatement amends effective view without deleting original facts', () => {
    const checks = runOs10AdversarialChecks();
    assert.equal(checks.restatementUpdatesEffectiveRevenue, true);
    assert.equal(checks.restatementPreservesOriginalFacts, true);
    assert.equal(checks.pitEffectiveFactBeforeRestatement, true);
  });

  it('emits HELIOS_OS10_POINT_IN_TIME_FUNDAMENTALS_QUALIFIED when adversarial checks pass', () => {
    const result = evaluateHeliosOs10PointInTimeFundamentalsQualification(runOs10AdversarialChecks());
    assert.equal(result.qualified, true, result.blockers.join('; '));
    assert.equal(result.marker, HELIOS_OS10_POINT_IN_TIME_FUNDAMENTALS_QUALIFIED);
  });
});
