/**
 * HELIOS AAF06 — coverage-bias sentinel and revision ledger.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  HELIOS_AAF06_COVERAGE_BIAS_AND_REVISION_LEDGER_QUALIFIED,
  assessCoverageBias,
  canBypassSevereCoverageBias,
  evaluateAaf06Qualification,
  evaluateCoverageBiasPromotionGate,
  type CoverageBiasControlledReviewState,
  type UniverseEntityCharacteristics,
} from '../packages/platform/src/helios/feature-fabric/aaf06/index.ts';
import {
  createRevisionLedgerStore,
  selectKnowableRevisionAt,
} from '../packages/platform/src/helios/feature-fabric/revision-ledger/index.ts';
import { macroReadingToRevisionLedgerEntry } from '../packages/platform/src/helios/feature-fabric/macro-intelligence/ingest.ts';
import { gatePromotionOnCoverageBias } from '../packages/strategy-lab/src/evaluation/coverage-bias-promotion-gate.ts';

const EVAL_AT = asUtcInstant('2026-04-01T12:00:00.000Z');

function entity(
  id: string,
  overrides: Partial<UniverseEntityCharacteristics> = {},
): UniverseEntityCharacteristics {
  return Object.freeze({
    entityId: id,
    marketCapMinor: overrides.marketCapMinor ?? 1_000_000_000n,
    liquidityScore: overrides.liquidityScore ?? 5_000,
    volatilityBps: overrides.volatilityBps ?? 1_200,
    sector: overrides.sector ?? 'TECH',
    geography: overrides.geography ?? 'US',
    listingAgeDays: overrides.listingAgeDays ?? 1_000,
    historicalReturnBps: overrides.historicalReturnBps ?? 500,
    assetClass: overrides.assetClass ?? 'EQUITY',
  });
}

function syntheticUniverse(): UniverseEntityCharacteristics[] {
  const rows: UniverseEntityCharacteristics[] = [];
  for (let i = 0; i < 40; i += 1) {
    const largeCap = i < 20;
    rows.push(
      entity(`ent_${i}`, {
        marketCapMinor: largeCap ? 50_000_000_000n : 200_000_000n,
        sector: largeCap ? 'TECH' : 'ENERGY',
        geography: largeCap ? 'US' : 'EM',
        liquidityScore: largeCap ? 9_000 : 2_000,
        volatilityBps: largeCap ? 800 : 2_400,
        listingAgeDays: largeCap ? 3_000 : 200,
        historicalReturnBps: largeCap ? 700 : -200,
        assetClass: largeCap ? 'EQUITY' : 'EQUITY',
      }),
    );
  }
  return rows;
}

describe('HELIOS AAF06 coverage-bias sentinel', () => {
  it('flags severe coverage-selection bias between full and feature-covered universes', () => {
    const eligible = syntheticUniverse();
    const covered = eligible.filter((row) => (row.marketCapMinor ?? 0n) >= 10_000_000_000n).map((row) => row.entityId);
    const assessment = assessCoverageBias({
      assessmentId: 'cba_severe_fixture',
      researchDatasetId: 'ds_research_fixture',
      evaluatedAt: EVAL_AT,
      eligibleUniverse: eligible,
      featureCoveredEntityIds: covered,
    });
    assert.equal(assessment.severity, 'SEVERE');
    assert.ok(assessment.evidence.some((row) => row.correlationIsNotCausation));
    assert.ok(assessment.evidence.some((row) => row.metricKind === 'STANDARDIZED_MEAN_DIFFERENCE'));
    assert.equal(canBypassSevereCoverageBias(assessment, null), false);
  });

  it('blocks promotion on severe bias until controlled review is recorded', () => {
    const eligible = syntheticUniverse();
    const covered = eligible.slice(0, 30).map((row) => row.entityId);
    const assessment = assessCoverageBias({
      assessmentId: 'cba_promotion_gate',
      researchDatasetId: 'ds_research_fixture',
      evaluatedAt: EVAL_AT,
      eligibleUniverse: eligible,
      featureCoveredEntityIds: covered,
    });
    const blocked = evaluateCoverageBiasPromotionGate({
      assessment,
      policy: { policyId: 'test', requirePass: false, allowWarningWithExplicitReview: true },
    });
    if (assessment.severity === 'SEVERE') {
      assert.equal(blocked.permitted, false);
      const review: CoverageBiasControlledReviewState = Object.freeze({
        reviewId: 'rev_1',
        assessmentId: assessment.assessmentId,
        reviewerRef: 'governance:research',
        reviewedAt: EVAL_AT,
        evidenceRef: 'evidence:severe_review',
        severeBiasExplicitlyReviewed: true,
      });
      const allowed = evaluateCoverageBiasPromotionGate({
        assessment,
        policy: { policyId: 'test', requirePass: false, allowWarningWithExplicitReview: true },
        severeReview: review,
      });
      assert.equal(allowed.permitted, true);
    }
  });

  it('survivorship-style gap: delisted names remain in eligible universe but not covered', () => {
    const eligible = syntheticUniverse();
    const delisted = entity('ent_delisted', {
      marketCapMinor: 50_000_000n,
      sector: 'RETAIL',
      listingAgeDays: 50,
      liquidityScore: 500,
    });
    const withDelisted = [...eligible, delisted];
    const covered = eligible.map((row) => row.entityId);
    const assessment = assessCoverageBias({
      assessmentId: 'cba_survivorship',
      researchDatasetId: 'ds_survivorship',
      evaluatedAt: EVAL_AT,
      eligibleUniverse: withDelisted,
      featureCoveredEntityIds: covered,
    });
    assert.ok(assessment.overallCoverageRate < 1);
    assert.notEqual(assessment.severity, 'INSUFFICIENT_DATA');
  });
});

describe('HELIOS AAF06 revision ledger', () => {
  const JAN_KNOWABLE = asUtcInstant('2026-01-31T14:00:00.000Z');
  const MAR_REVISION_KNOWABLE = asUtcInstant('2026-03-29T14:00:00.000Z');
  const JAN_BACKTEST = asUtcInstant('2026-02-05T10:00:00.000Z');
  const LIVE_QUERY = asUtcInstant('2026-04-10T10:00:00.000Z');
  const PERIOD_END = asUtcInstant('2026-01-31T23:59:59.000Z');

  function gdpReading(
    revisionSequence: number,
    knowableAt: typeof JAN_KNOWABLE,
    valueMinor: bigint,
    observationRef: string,
  ) {
    return Object.freeze({
      seriesKey: 'gdp' as const,
      periodEnd: PERIOD_END,
      valueMinor,
      providerAvailabilityTime: knowableAt,
      sunreyArrivalTime: knowableAt,
      knowableAt,
      revisionSequence,
      revisionChainId: 'chain.gdp.2026-01',
      observationRef,
      source: Object.freeze({
        providerId: 'bea_fixture',
        seriesId: 'GDP',
        capability: 'macro_release',
      }),
      entitlement: Object.freeze({
        entitlementClass: 'reference_data' as const,
        sourceProvider: 'bea_fixture',
        commercialUseStatus: 'permitted' as const,
      }),
      releaseType: 'gdp_release' as const,
      actualPublicationTime: knowableAt,
    });
  }

  it('January backtest sees January release; live query sees March revision', () => {
    const ledger = createRevisionLedgerStore();
    const initial = macroReadingToRevisionLedgerEntry(gdpReading(0, JAN_KNOWABLE, 25_000n, 'gdp_v0'), {});
    ledger.append(initial);
    const revision = macroReadingToRevisionLedgerEntry(
      gdpReading(1, MAR_REVISION_KNOWABLE, 24_500n, 'gdp_v1'),
      {
        supersedesObservationRef: initial.observationRef,
        originalPublicationTime: JAN_KNOWABLE,
      },
    );
    ledger.append(revision);

    const chain = ledger.listChain('chain.gdp.2026-01');
    assert.equal(chain.length, 2);

    const atBacktest = selectKnowableRevisionAt(chain, JAN_BACKTEST, 'LATEST_KNOWABLE_REVISION');
    const atLive = selectKnowableRevisionAt(chain, LIVE_QUERY, 'LATEST_KNOWABLE_REVISION');
    assert.equal(atBacktest?.valueMinor, 25_000n);
    assert.equal(atLive?.valueMinor, 24_500n);
    assert.equal(atLive?.revisionKind, 'REVISION');
    assert.equal(atLive?.supersedesObservationRef, 'gdp_v0');
  });

  it('preserves provider correction history without overwriting prior vintages', () => {
    const ledger = createRevisionLedgerStore();
    const initial = macroReadingToRevisionLedgerEntry(gdpReading(0, JAN_KNOWABLE, 100n, 'cpi_v0'), {});
    ledger.append(initial);
    const correction = macroReadingToRevisionLedgerEntry(
      {
        ...gdpReading(1, MAR_REVISION_KNOWABLE, 101n, 'cpi_v1'),
        releaseType: 'official_release',
      },
      { supersedesObservationRef: initial.observationRef, originalPublicationTime: JAN_KNOWABLE },
    );
    ledger.append(correction);
    assert.equal(ledger.list().length, 2);
    const snap = ledger.snapshot();
    const restored = createRevisionLedgerStore();
    restored.restore(snap);
    assert.equal(restored.list().length, 2);
    assert.equal(restored.listChain('chain.gdp.2026-01')[0]?.valueMinor, 100n);
  });
});

describe('HELIOS AAF06 qualification marker', () => {
  it('emits HELIOS_AAF06_COVERAGE_BIAS_AND_REVISION_LEDGER_QUALIFIED when checks pass', () => {
    const result = evaluateAaf06Qualification({
      coverageBiasDeterministic: true,
      survivorshipDiagnostic: true,
      coverageSelectionDiagnostic: true,
      revisionLedgerAppendOnly: true,
      knowableAtBacktestSemantics: true,
      providerCorrectionPreservesHistory: true,
      restartPersistence: true,
      severeRequiresControlledReview: true,
      noCausalClaimsFromCorrelation: true,
    });
    assert.equal(result.marker, HELIOS_AAF06_COVERAGE_BIAS_AND_REVISION_LEDGER_QUALIFIED);
    const gate = gatePromotionOnCoverageBias({
      assessment: { assessmentId: 'x', severity: 'PASS' },
      policy: { requirePass: true, allowWarningWithExplicitReview: false },
    });
    assert.equal(gate.permitted, true);
  });
});
