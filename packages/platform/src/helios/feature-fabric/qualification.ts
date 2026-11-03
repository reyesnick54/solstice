/**
 * HELIOS OS10 qualification gate.
 */

import { asUtcInstant } from '../../../../domain/src/time.ts';
import {
  SIMCORP_ENTITY_ID,
  SIMCORP_Q2_2024_10Q,
  SIMCORP_Q2_2024_10Q_A,
  SIMCORP_SUBMISSION_TIMELINE,
  ingestSecFundamentalSubmissions,
} from '../../../../external-data/src/sec-fundamentals/index.ts';
import { assertNoFutureFundamentalLeak, buildPointInTimeFundamentalSnapshot } from './features.ts';
import { createFundamentalObservationStore, effectiveFactsAt } from './store.ts';
import { bindSecObservationsToAaf } from './aaf-bridge.ts';
import { createHeliosFundamentalFeatureFabric } from './service.ts';

export const HELIOS_OS10_POINT_IN_TIME_FUNDAMENTALS_QUALIFIED =
  'HELIOS_OS10_POINT_IN_TIME_FUNDAMENTALS_QUALIFIED' as const;
export const HELIOS_OS10_POINT_IN_TIME_FUNDAMENTALS_BLOCKED =
  'HELIOS_OS10_POINT_IN_TIME_FUNDAMENTALS_BLOCKED' as const;

export type HeliosOs10QualificationResult = {
  readonly marker:
    | typeof HELIOS_OS10_POINT_IN_TIME_FUNDAMENTALS_QUALIFIED
    | typeof HELIOS_OS10_POINT_IN_TIME_FUNDAMENTALS_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

type AdversarialCheck = { readonly id: string; readonly pass: boolean; readonly detail?: string };

function runAdversarialChecks(): readonly AdversarialCheck[] {
  const ingested = ingestSecFundamentalSubmissions(SIMCORP_SUBMISSION_TIMELINE);
  const fabric = createHeliosFundamentalFeatureFabric();
  fabric.ingest(ingested.observations);

  const checks: AdversarialCheck[] = [];

  const beforeQ2Filed = fabric.snapshotAt({
    canonicalEntityId: SIMCORP_ENTITY_ID,
    evaluationTimeUtc: asUtcInstant('2024-07-31T23:59:59.000Z'),
    reportPeriod: '2024-06-30',
  });
  checks.push({
    id: 'no_q2_before_filing',
    pass: !beforeQ2Filed.features.revenue.supported,
    detail: 'Q2 revenue must not exist before Aug 1 filing knowableAt',
  });

  const q2Backtest = fabric.snapshotAt({
    canonicalEntityId: SIMCORP_ENTITY_ID,
    evaluationTimeUtc: asUtcInstant('2024-08-15T12:00:00.000Z'),
    reportPeriod: '2024-06-30',
    priorReportPeriod: '2024-03-31',
  });
  checks.push({
    id: 'q2_original_revenue_at_backtest',
    pass: q2Backtest.features.revenue.supported && q2Backtest.features.revenue.valueMinor === 1_000_000_000_00n,
  });
  checks.push({
    id: 'no_q3_in_q2_window',
    pass: !q2Backtest.features.revenue.knowableAt?.startsWith('2024-11'),
  });

  const leak = assertNoFutureFundamentalLeak({
    evaluationTimeUtc: asUtcInstant('2024-08-15T12:00:00.000Z'),
    snapshot: q2Backtest,
  });
  checks.push({ id: 'no_future_leak_q2_window', pass: leak.ok });

  const afterRestatement = fabric.snapshotAt({
    canonicalEntityId: SIMCORP_ENTITY_ID,
    evaluationTimeUtc: asUtcInstant('2024-10-01T12:00:00.000Z'),
    reportPeriod: '2024-06-30',
  });
  checks.push({
    id: 'restatement_updates_effective_revenue',
    pass: afterRestatement.features.revenue.supported && afterRestatement.features.revenue.valueMinor === 980_000_000_00n,
  });

  const store = createFundamentalObservationStore();
  store.append(ingested.observations);
  const allQ2RevenueFacts = store
    .factsForEntity(SIMCORP_ENTITY_ID)
    .filter((f) => f.periodEnd === '2024-06-30' && f.concept === 'us-gaap:Revenues');
  checks.push({
    id: 'restatement_does_not_delete_original',
    pass: allQ2RevenueFacts.length >= 2,
    detail: `expected >=2 revenue facts, got ${allQ2RevenueFacts.length}`,
  });

  const binding = bindSecObservationsToAaf({
    cik: '0000999999',
    ticker: 'SIMC',
    observations: ingested.observations,
  });
  const effective = binding.ledger.effectiveFilingIdsAt(SIMCORP_Q2_2024_10Q.filingId, '2024-10-01T12:00:00.000Z');
  checks.push({
    id: 'aaf_revision_ledger_tracks_amendment',
    pass: effective.includes(SIMCORP_Q2_2024_10Q.filingId) && effective.includes(SIMCORP_Q2_2024_10Q_A.filingId),
  });

  const pitFacts = effectiveFactsAt(store.factsForEntity(SIMCORP_ENTITY_ID), asUtcInstant('2024-08-15T12:00:00.000Z'));
  const pitRevenue = pitFacts.find((f) => f.concept === 'us-gaap:Revenues' && f.periodEnd === '2024-06-30');
  checks.push({
    id: 'pit_effective_fact_before_restatement',
    pass: pitRevenue?.filingId === SIMCORP_Q2_2024_10Q.filingId,
  });

  const q2Facts = store
    .factsForEntity(SIMCORP_ENTITY_ID)
    .filter((f) => f.periodEnd === '2024-06-30');
  const directSnapshot = buildPointInTimeFundamentalSnapshot({
    canonicalEntityId: SIMCORP_ENTITY_ID,
    evaluationTimeUtc: asUtcInstant('2024-08-15T12:00:00.000Z'),
    facts: q2Facts,
  });
  checks.push({
    id: 'derived_margins_when_facts_support',
    pass: directSnapshot.features.gross_margin.supported && directSnapshot.features.operating_margin.supported,
  });

  return Object.freeze(checks);
}

export function evaluateHeliosOs10PointInTimeFundamentalsQualification(): HeliosOs10QualificationResult {
  const checks = runAdversarialChecks();
  const blockers = checks.filter((c) => !c.pass).map((c) => `${c.id}${c.detail ? `: ${c.detail}` : ''}`);

  if (blockers.length === 0) {
    return Object.freeze({
      marker: HELIOS_OS10_POINT_IN_TIME_FUNDAMENTALS_QUALIFIED,
      qualified: true,
      blockers: Object.freeze([]),
    });
  }

  return Object.freeze({
    marker: HELIOS_OS10_POINT_IN_TIME_FUNDAMENTALS_BLOCKED,
    qualified: false,
    blockers: Object.freeze(blockers),
  });
}
