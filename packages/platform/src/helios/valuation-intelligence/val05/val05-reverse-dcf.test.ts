import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  HELIOS_VAL05_REVERSE_DCF_QUALIFIED,
  buildHeliosProbabilisticExpectations,
  evaluateVal05ReverseDcfQualification,
  runVal05ReverseDcfAnalysis,
  val05DemoCapitalStructure,
  val05DemoDiscountRate,
  val05DemoOperatingEconomics,
  val05DemoPrice,
  VAL05_FIXTURE_AS_OF,
  VAL05_FIXTURE_ENTITY_ID,
} from './index.ts';

describe('HELIOS VAL05 reverse DCF', () => {
  it('builds a multi-combination market-implied surface and expectation gap without buy/sell labels', () => {
    const operatingEconomics = val05DemoOperatingEconomics();
    const heliosExpectations = buildHeliosProbabilisticExpectations({
      entityId: VAL05_FIXTURE_ENTITY_ID,
      asOf: VAL05_FIXTURE_AS_OF,
      operatingEconomics,
      revenueCagr: { p10: 400, p50: 800, p90: 1_200 },
      terminalGrowth: { p10: 100, p50: 200, p90: 250 },
    });

    const artifact = runVal05ReverseDcfAnalysis({
      entityId: VAL05_FIXTURE_ENTITY_ID,
      asOf: VAL05_FIXTURE_AS_OF,
      price: val05DemoPrice(),
      capitalStructure: val05DemoCapitalStructure(),
      discountRate: val05DemoDiscountRate(),
      operatingEconomics,
      heliosExpectations,
    });

    assert.ok(artifact.marketImplied.combinationCount > 1);
    assert.equal(artifact.marketImplied.nonUniqueAcknowledged, true);
    assert.equal(artifact.expectationGap.investmentRecommendation, null);
    assert.equal(artifact.grantsExecutionAuthority, false);
    assert.ok(Number.isFinite(artifact.expectationGap.growthGapBps));
    assert.ok(artifact.priceLevelScenarios.length >= 3);
    for (const scenario of artifact.priceLevelScenarios) {
      assert.ok(scenario.whatMustBeTrue.length >= 6);
      assert.equal(scenario.researchEvidenceOnly, true);
    }
  });

  it('qualifies HELIOS_VAL05_REVERSE_DCF_QUALIFIED when engineering checks pass', () => {
    const artifact = runVal05ReverseDcfAnalysis({
      entityId: VAL05_FIXTURE_ENTITY_ID,
      asOf: VAL05_FIXTURE_AS_OF,
      price: val05DemoPrice(),
      capitalStructure: val05DemoCapitalStructure(),
      discountRate: val05DemoDiscountRate(),
      operatingEconomics: val05DemoOperatingEconomics(),
      heliosExpectations: buildHeliosProbabilisticExpectations({
        entityId: VAL05_FIXTURE_ENTITY_ID,
        asOf: VAL05_FIXTURE_AS_OF,
        operatingEconomics: val05DemoOperatingEconomics(),
        revenueCagr: { p10: 400, p50: 800, p90: 1_200 },
        terminalGrowth: { p10: 100, p50: 200, p90: 250 },
      }),
    });

    const qualification = evaluateVal05ReverseDcfQualification({
      combinationSurfaceNonEmpty: artifact.marketImplied.combinationCount > 0,
      nonUniqueAnswerAcknowledged: artifact.marketImplied.nonUniqueAcknowledged === true,
      expectationGapComputed: Number.isFinite(artifact.expectationGap.growthGapBps),
      priceLevelScenariosPresent: artifact.priceLevelScenarios.length > 0,
      noInvestmentRecommendation: artifact.expectationGap.investmentRecommendation === null,
      researchEvidenceOnly: artifact.marketImplied.researchEvidenceOnly === true,
      noExecutionAuthority:
        artifact.grantsExecutionAuthority === false && artifact.authorizesFinancialExecution === false,
      capitalStructurePresent: artifact.capitalStructure.sharesOutstanding > 0n,
      discountDistributionPresent: artifact.discountRate.samplesBps.length > 0,
      operatingEconomicsPresent: artifact.operatingEconomics.baseRevenueMinor > 0n,
    });

    assert.equal(qualification.marker, HELIOS_VAL05_REVERSE_DCF_QUALIFIED, qualification.blockers.join('; '));
  });
});
