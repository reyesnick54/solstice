/**
 * HELIOS Valuation Intelligence VAL05 — reverse DCF and market-implied expectations.
 * Research evidence only; positive expectation gap is not a buy signal.
 */

import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  HELIOS_VAL05_REVERSE_DCF_QUALIFIED,
  HELIOS_VALUATION_INTELLIGENCE_AUTHORITY,
  HELIOS_VALUATION_INTELLIGENCE_SCHEMA,
  buildHeliosProbabilisticExpectations,
  evaluateVal05ReverseDcfQualification,
  runVal05ReverseDcfAnalysis,
  val05DemoCapitalStructure,
  val05DemoDiscountRate,
  val05DemoOperatingEconomics,
  val05DemoPrice,
  VAL05_FIXTURE_AS_OF,
  VAL05_FIXTURE_ENTITY_ID,
} from '../packages/platform/src/helios/valuation-intelligence/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const ROOT = join(import.meta.dirname, '..');

describe('HELIOS VAL05 — reverse DCF and market-implied expectations engine', () => {
  it('architecture guard: valuation-intelligence stays inside helios boundary', () => {
    const findings = lintHeliosBoundary(ROOT);
    const scoped = findings.filter((f) => f.file.includes('valuation-intelligence'));
    assert.equal(scoped.length, 0, JSON.stringify(scoped));
  });

  it('schema and authority are research-only reference', () => {
    assert.equal(HELIOS_VALUATION_INTELLIGENCE_SCHEMA, 'helios.valuation-intelligence.v1');
    assert.equal(
      HELIOS_VALUATION_INTELLIGENCE_AUTHORITY,
      'packages/platform/src/helios/valuation-intelligence',
    );
  });

  it('emits HELIOS_VAL05_REVERSE_DCF_QUALIFIED when checks pass', () => {
    const operatingEconomics = val05DemoOperatingEconomics();
    const artifact = runVal05ReverseDcfAnalysis({
      entityId: VAL05_FIXTURE_ENTITY_ID,
      asOf: VAL05_FIXTURE_AS_OF,
      price: val05DemoPrice(),
      capitalStructure: val05DemoCapitalStructure(),
      discountRate: val05DemoDiscountRate(),
      operatingEconomics,
      heliosExpectations: buildHeliosProbabilisticExpectations({
        entityId: VAL05_FIXTURE_ENTITY_ID,
        asOf: VAL05_FIXTURE_AS_OF,
        operatingEconomics,
        revenueCagr: { p10: 500, p50: 900, p90: 1_300 },
        terminalGrowth: { p10: 100, p50: 200, p90: 250 },
      }),
    });

    assert.ok(artifact.marketImplied.combos.length > 1, 'expected multiple implied paths');
    assert.equal(artifact.expectationGap.investmentRecommendation, null);

    const qualification = evaluateVal05ReverseDcfQualification({
      combinationSurfaceNonEmpty: artifact.marketImplied.combinationCount > 0,
      nonUniqueAnswerAcknowledged: artifact.marketImplied.nonUniqueAcknowledged === true,
      expectationGapComputed: Number.isFinite(artifact.expectationGap.fcfGapBps),
      priceLevelScenariosPresent: artifact.priceLevelScenarios.length > 0,
      noInvestmentRecommendation: artifact.expectationGap.investmentRecommendation === null,
      researchEvidenceOnly: artifact.marketImplied.researchEvidenceOnly === true,
      noExecutionAuthority:
        artifact.grantsExecutionAuthority === false && artifact.authorizesFinancialExecution === false,
      capitalStructurePresent: true,
      discountDistributionPresent: true,
      operatingEconomicsPresent: true,
    });

    assert.equal(qualification.marker, HELIOS_VAL05_REVERSE_DCF_QUALIFIED, qualification.blockers.join('; '));
  });
});
