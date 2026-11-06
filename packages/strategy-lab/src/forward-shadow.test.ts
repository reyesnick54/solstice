import assert from 'node:assert/strict';
import test from 'node:test';

import { asUtcInstant } from '@solstice/domain';

import {
  HELIOS_CF02_REJECTED_OPPORTUNITY_BOOK_QUALIFIED,
  MARKET_PATH_OBSERVED,
  EXECUTION_COUNTERFACTUAL_ESTIMATED,
  appendRejectedOpportunityShadowEntry,
  createRejectedOpportunityShadowBook,
  shadowOriginalDecisionFromForwardShadow,
} from './forward-shadow.ts';
import {
  asForwardShadowDecisionId,
  asForwardShadowRunId,
  asRejectedOpportunityShadowOpportunityId,
} from './ids.ts';

test('HELIOS CF02 — rejected opportunity shadow book keeps observed vs counterfactual lanes', () => {
  assert.equal(HELIOS_CF02_REJECTED_OPPORTUNITY_BOOK_QUALIFIED, 'HELIOS_CF02_REJECTED_OPPORTUNITY_BOOK_QUALIFIED');
  const t0 = asUtcInstant('2026-06-01T12:00:00.000Z');
  const book = createRejectedOpportunityShadowBook({
    bookId: 'cf02_demo_book',
    observationRef: 'pit_manifest_ref_demo',
    createdAt: t0,
  });
  assert.equal(book.entries.length, 0);
  assert.equal(book.researchOnly, true);

  const decision = {
    decisionId: asForwardShadowDecisionId('fsdec_cf02test0123456789'),
    runId: asForwardShadowRunId('fshd_cf02test01234567890'),
    capsuleFingerprint: 'cap_fp',
    decisionTime: t0,
    proposedAction: '{"SIM_ETF_1":5000}',
    actionKind: 'TRADE' as const,
    rejectionReason: 'kernel_hold' as string | null,
    predictedAssumptions: Object.freeze({}),
    marketTermsAtDecision: Object.freeze({ SIM_ETF_1: '10000' }),
    estimatedCostsMinor: 0n,
    invalidations: Object.freeze([]),
    missedOpportunity: false,
    subsequentOutcome: null,
    outcomeRecordedAt: null,
    immutableAfterOutcome: false,
    modelVersions: Object.freeze([]),
    toolVersions: Object.freeze(['strategy-lab-v1']),
    brokerSubmission: false as const,
  };

  const run = {
    runId: decision.runId,
    capsuleId: 'cap',
    capsuleFingerprint: 'cap_fp',
    strategyId: 'str_demo',
    strategyVersion: '1',
    startedAt: t0,
    completedAt: null,
    observationRef: book.observationRef,
    evol11Role: 'INCUBATION' as const,
    sendsOrders: false as const,
    changesInvestmentState: false as const,
    financialEffectCreated: false as const,
    modelVersions: Object.freeze([]),
    toolVersions: Object.freeze(['strategy-lab-v1']),
  };

  const path1h = {
    marketPathObserved: { pricesByInstrumentId: { SIM_ETF_1: '10100' } },
    executionCounterfactualEstimated: { pricesByInstrumentId: { SIM_ETF_1: '10090' } },
    policyCounterfactualEstimated: null,
    benchmarkPaths: [
      { benchmark: 'MARKET' as const, path: { pricesByInstrumentId: { SIM_ETF_1: '10050' } } },
      { benchmark: 'CASH_NO_ACTION' as const, path: { pricesByInstrumentId: { USD_CASH: '10000' } } },
    ],
  };

  const outcomeRecordedAt = asUtcInstant('2026-06-01T13:00:00.000Z');
  const appended = appendRejectedOpportunityShadowEntry({
    book,
    forwardShadowRun: run,
    originalDecision: shadowOriginalDecisionFromForwardShadow({ decision }),
    reasonRejected: 'HELIOS policy deferred execution',
    proposedDirection: 'long SIM_ETF_1',
    proposedSize: '5_000_bps_of_nav',
    proposedExecutionPlan: 'twap_30m_simulated',
    outcome: {
      recordedAt: outcomeRecordedAt,
      byHorizon: { '1h': path1h },
      notes: `${MARKET_PATH_OBSERVED} ${EXECUTION_COUNTERFACTUAL_ESTIMATED}; internal research only`,
    },
  });
  assert.equal(appended.entries.length, 1);
  const entry = appended.entries[0]!;
  assert.equal(entry.invariant, 'REJECTED_OPPORTUNITY_NOT_COUNTERFACTUAL');
  assert.equal(entry.researchOnly, true);
  assert.equal(entry.marketStateAtDecision.SIM_ETF_1, '10000');
  assert.ok(entry.shadowOpportunityId.startsWith('rosh_'));

  const appended2 = appendRejectedOpportunityShadowEntry({
    book: appended,
    forwardShadowRun: run,
    originalDecision: shadowOriginalDecisionFromForwardShadow({ decision }),
    reasonRejected: 'HELIOS policy deferred execution',
    proposedDirection: 'long SIM_ETF_1',
    proposedSize: '5_000_bps_of_nav',
    proposedExecutionPlan: 'twap_30m_simulated',
    outcome: {
      recordedAt: outcomeRecordedAt,
      byHorizon: { '1h': path1h },
      notes: 'stable id — same material as first entry',
    },
  });
  assert.equal(appended2.entries[1]!.shadowOpportunityId, appended2.entries[0]!.shadowOpportunityId);

  assert.throws(
    () =>
      appendRejectedOpportunityShadowEntry({
        book,
        forwardShadowRun: run,
        originalDecision: shadowOriginalDecisionFromForwardShadow({ decision }),
        reasonRejected: 'bad horizon key',
        proposedDirection: 'x',
        proposedSize: 'y',
        proposedExecutionPlan: 'z',
        outcome: {
          recordedAt: outcomeRecordedAt,
          byHorizon: { '2h': path1h } as never,
          notes: 'should throw',
        },
      }),
    /unknown shadow observation horizon/,
  );

  const id = asRejectedOpportunityShadowOpportunityId('rosh_customid123456789012');
  assert.ok(id.length > 4);
});
