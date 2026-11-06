/**
 * HELIOS VAL07 — Residual income, economic profit, and excess-return valuation.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { join } from 'node:path';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  HELIOS_VAL07_RESIDUAL_INCOME_QUALIFIED,
  RESIDUAL_CASH_FLOW_RESEARCH_DISCLAIMER,
  buildCostOfCapitalSnapshot,
  classifyEconomicValueCreation,
  compareIntrinsicToMarketPrice,
  computeEconomicProfitState,
  computeExcessReturnState,
  computeResidualCashFlowState,
  costOfEquityMidBpsFromVal03,
  evaluateVal07ResidualIncomeQualification,
  evaluateValuationMethodApplicability,
  fixturePositiveResidualIncomeInput,
  fixtureRoeEqualsKeInput,
  fixtureVal03CostOfCapitalInput,
  reconcileCleanSurplus,
  residualIncomeForPeriod,
  runResidualIncomeValuation,
  runVal07ResidualIncomeAnalysis,
  singleStageIntrinsicFromConstantRi,
  val07EngineeringQualificationChecks,
} from '../packages/platform/src/helios/valuation-intelligence/index.ts';
import { val07FeaturesFromResidualIncome } from '../packages/platform/src/helios/feature-fabric/valuation/index.ts';

const ROOT = join(import.meta.dirname, '..');
const AS_OF = asUtcInstant('2026-11-01T00:00:00.000Z');

describe('HELIOS VAL07 residual income valuation', () => {
  it('exports qualification marker HELIOS_VAL07_RESIDUAL_INCOME_QUALIFIED', () => {
    assert.equal(HELIOS_VAL07_RESIDUAL_INCOME_QUALIFIED, 'HELIOS_VAL07_RESIDUAL_INCOME_QUALIFIED');
  });

  it('qualifies engineering baseline', () => {
    const checks = val07EngineeringQualificationChecks(ROOT);
    const q = evaluateVal07ResidualIncomeQualification(checks);
    assert.equal(q.marker, HELIOS_VAL07_RESIDUAL_INCOME_QUALIFIED, q.blockers.join('; '));
  });

  it('positive residual income known answer (Gordon on constant RI)', () => {
    const intrinsic = singleStageIntrinsicFromConstantRi({
      bookEquity: 100,
      residualIncome: 5,
      costOfEquityBps: 1000,
    });
    assert.ok(Math.abs(intrinsic - 150) < 1e-6);
    const val = runResidualIncomeValuation(fixturePositiveResidualIncomeInput());
    assert.ok(Math.abs(val.intrinsicEquityValue - 150) < 0.05);
    assert.equal(val.priceFree, true);
  });

  it('negative residual income reduces value below book', () => {
    const val = runResidualIncomeValuation({
      valuationId: 'val07_neg',
      entityLabel: 'neg',
      evaluationTime: AS_OF,
      currentBookEquity: 100,
      costOfEquityBps: 1000,
      forecast: {
        stageKind: 'SINGLE_STAGE',
        currency: 'USD',
        assumeCleanSurplus: true,
        explicitPeriods: [{ periodIndex: 1, netIncome: 5, beginningBookEquity: 100 }],
        continuing: {
          kind: 'PERPETUAL_RESIDUAL_INCOME',
          terminalResidualIncome: -5,
          terminalGrowthBps: 0,
        },
      },
    });
    assert.ok(val.intrinsicEquityValue < 100);
  });

  it('ROE equal to cost of equity implies zero residual income intrinsic at book (terminal RI 0)', () => {
    const val = runResidualIncomeValuation(fixtureRoeEqualsKeInput());
    assert.ok(Math.abs(val.intrinsicEquityValue - 200) < 0.05);
    const ri = residualIncomeForPeriod({
      netIncome: 24,
      beginningBookEquity: 200,
      costOfEquityBps: 1200,
    });
    assert.ok(Math.abs(ri.residualIncome) < 1e-6);
  });

  it('changing cost of equity shifts intrinsic value', () => {
    const base = runResidualIncomeValuation(fixturePositiveResidualIncomeInput());
    const higherKe = runResidualIncomeValuation({
      ...fixturePositiveResidualIncomeInput(),
      costOfEquityBps: 1500,
    });
    assert.ok(higherKe.intrinsicEquityValue < base.intrinsicEquityValue);
  });

  it('share repurchase reduces book equity under clean surplus', () => {
    const { endingBookEquity } = reconcileCleanSurplus({
      period: {
        periodIndex: 1,
        netIncome: 10,
        shareRepurchases: 20,
      },
      beginningBookEquity: 100,
      netIncome: 10,
      assumeCleanSurplus: true,
    });
    assert.equal(endingBookEquity, 90);
  });

  it('OCI adjustment flows through book equity reconciliation', () => {
    const { adjustment } = reconcileCleanSurplus({
      period: {
        periodIndex: 1,
        netIncome: 10,
        otherComprehensiveIncome: 3,
        reportedEndingBookEquity: 113,
      },
      beginningBookEquity: 100,
      netIncome: 10,
      assumeCleanSurplus: false,
    });
    assert.equal(adjustment.ociAmount, 3);
    assert.equal(adjustment.cleanSurplusHolds, true);
  });

  it('book-value restatement is explicit in clean surplus adjustment', () => {
    const { adjustment } = reconcileCleanSurplus({
      period: {
        periodIndex: 1,
        netIncome: 10,
        restatementAdjustment: -4,
        reportedEndingBookEquity: 106,
      },
      beginningBookEquity: 100,
      netIncome: 10,
      assumeCleanSurplus: false,
    });
    assert.equal(adjustment.restatementAmount, -4);
    assert.equal(adjustment.cleanSurplusHolds, true);
  });

  it('loss-making firm produces negative residual income', () => {
    const ri = residualIncomeForPeriod({
      netIncome: -20,
      beginningBookEquity: 100,
      costOfEquityBps: 800,
    });
    assert.ok(ri.residualIncome < 0);
  });

  it('bank applicability favors residual income over FCFF', () => {
    const profile = Object.freeze({
      canonicalEntityId: 'bank_1',
      sector: 'Financials',
      reportingSegments: 3,
      paysRegularDividend: true,
      hasPositiveOperatingCashFlow: true,
      hasMeaningfulBookEquity: true,
      hasMarketPrice: true,
      hasPeerUniverse: true,
      isPreRevenue: false,
      hasLeverageInputs: false,
      isFinancialInstitution: true,
    });
    const ri = evaluateValuationMethodApplicability(profile, 'RESIDUAL_INCOME');
    const fcff = evaluateValuationMethodApplicability(profile, 'DCF_FCFF');
    assert.equal(ri.applicable, true);
    assert.equal(fcff.applicable, false);
  });

  it('financial institution excess return uses book equity and ROE', () => {
    const row = computeExcessReturnState({
      periodIndex: 1,
      bookEquity: 500,
      roeBps: 1400,
      costOfEquityBps: 1000,
      regulatoryCapitalRequired: 400,
      isFinancialInstitution: true,
    });
    assert.equal(row.financialInstitution, true);
    assert.equal(row.regulatoryCapitalRequired, 400);
    assert.ok(row.excessReturn > 0);
  });

  it('bridges cost of equity from VAL03', () => {
    const snapshot = buildCostOfCapitalSnapshot(fixtureVal03CostOfCapitalInput());
    const ke = costOfEquityMidBpsFromVal03(snapshot);
    assert.ok(ke > 0);
  });

  it('economic profit classification is research-only', () => {
    const ep = computeEconomicProfitState({
      periodIndex: 1,
      nopat: 50,
      investedCapital: 200,
      waccBps: 800,
    });
    const label = classifyEconomicValueCreation({
      roicBps: ep.roicBps,
      waccBps: ep.waccBps,
      investedCapital: ep.investedCapital,
      economicProfit: ep.economicProfit,
    });
    assert.equal(label.researchClassificationOnly, true);
    assert.equal(label.label, 'VALUE_CREATING');
  });

  it('residual operating cash flow is experimental and separate from canonical RIV', () => {
    const row = computeResidualCashFlowState({
      periodIndex: 1,
      operatingCashFlow: 80,
      waccBps: 900,
      investedCapital: 400,
    });
    assert.equal(row.experimentalDisclaimer, RESIDUAL_CASH_FLOW_RESEARCH_DISCLAIMER);
  });

  it('rejects market price as intrinsic input (price-free)', () => {
    assert.throws(() =>
      runResidualIncomeValuation({
        ...fixturePositiveResidualIncomeInput(),
        marketPriceMinor: 1000n,
      } as never),
    );
  });

  it('allows post-hoc market comparison only after intrinsic value', () => {
    const val = runResidualIncomeValuation(fixturePositiveResidualIncomeInput());
    const cmp = compareIntrinsicToMarketPrice({
      intrinsicEquityValue: val.intrinsicEquityValue,
      marketPriceMinor: 1200n,
      sharesOutstanding: 1,
    });
    assert.equal(cmp.computedAfterIntrinsic, true);
    assert.equal(cmp.notUsedInIntrinsicCalculation, true);
  });

  it('runs full VAL07 analysis bundle', () => {
    const result = runVal07ResidualIncomeAnalysis(fixturePositiveResidualIncomeInput(), {
      economicProfit: [{ periodIndex: 1, nopat: 50, investedCapital: 200, waccBps: 800 }],
      excessReturn: [
        {
          periodIndex: 1,
          bookEquity: 100,
          roeBps: 1500,
          costOfEquityBps: 1000,
        },
      ],
      residualCashFlowResearch: [
        { periodIndex: 1, operatingCashFlow: 60, waccBps: 900, investedCapital: 300 },
      ],
    });
    assert.equal(result.qualificationMarker, HELIOS_VAL07_RESIDUAL_INCOME_QUALIFIED);
    assert.equal(result.grantsExecutionAuthority, false);
  });

  it('compiles VAL07 features for feature fabric', () => {
    const val = runResidualIncomeValuation(fixturePositiveResidualIncomeInput());
    const features = val07FeaturesFromResidualIncome({
      valuation: val,
      evaluationTime: AS_OF,
      canonicalEntityId: 'entity',
      manifestId: 'manifest',
    });
    assert.equal(features.length, 4);
  });
});
