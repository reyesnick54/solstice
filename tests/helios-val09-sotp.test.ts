/**
 * HELIOS VAL09 — sum-of-the-parts and segment valuation engine.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  bindSegmentIdentities,
  evaluateVal09SotpQualification,
  fixtureSotpValuationInput,
  HELIOS_VAL09_SOTP_QUALIFIED,
  runSotpValuationEngine,
  SEGMENT_VALUATION_METHODS,
  VAL09_SOTP_SCHEMA,
  val09FixtureSegmentObservations,
} from '../packages/platform/src/helios/valuation-intelligence/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

describe('HELIOS VAL09 SOTP engine', () => {
  it('passes HELIOS boundary lint', () => {
    const findings = lintHeliosBoundary(process.cwd());
    assert.equal(findings.length, 0, findings.map((f) => f.message).join('; '));
  });

  it('preserves historical segment labels without rewriting structure', () => {
    const segments = bindSegmentIdentities(val09FixtureSegmentObservations());
    const cloudKeys = segments.filter((row) => row.displayLabel.includes('Cloud'));
    assert.ok(cloudKeys.length >= 2, 'rename should retain distinct historical identities');
    const renamed = cloudKeys.find((row) => row.displayLabel === 'Cloud & SaaS');
    assert.ok(renamed);
    assert.ok(
      renamed!.identityHistory.some((row) => row.eventKind === 'RENAMED' || row.eventKind === 'REPORTED'),
    );
  });

  it('values segments with independent methods and corporate bridge', () => {
    const result = runSotpValuationEngine(fixtureSotpValuationInput());

    assert.equal(result.schema, VAL09_SOTP_SCHEMA);
    assert.equal(result.grantsExecutionAuthority, false);
    assert.equal(result.researchOnly, true);
    assert.equal(result.qualificationMarker, HELIOS_VAL09_SOTP_QUALIFIED);
    assert.equal(result.segmentValuations.length, 3);

    const methods = new Set(result.segmentValuations.map((row) => row.method));
    assert.ok(methods.has('DCF_FCFF'));
    assert.ok(methods.has('COMPARABLE_MULTIPLES'));
    assert.ok(methods.has('ASSET_BASED'));

    assert.ok(result.bridge.intersegmentEliminationsMinor > 0n);
    assert.ok(result.bridge.corporateBridge.adjustments.length >= 3);
    assert.ok(result.intrinsicDistribution.equityValueMinor > 0n);
    assert.ok(result.contributionMap.totalEnterpriseValueMinor > 0n);
    assert.equal(result.bridge.observedConglomerateDiscount.notAppliedToIntrinsic, true);
    assert.ok(result.bridge.observedConglomerateDiscount.discountBps !== null);
    assert.ok(
      result.intrinsicDistribution.medianMinor !== result.bridge.observedConglomerateDiscount.sumOfPartsMinor ||
        result.bridge.observedConglomerateDiscount.observed,
    );
  });

  it('qualifies HELIOS_VAL09_SOTP_QUALIFIED when engineering checks pass', () => {
    const result = runSotpValuationEngine(fixtureSotpValuationInput());
    const qualification = evaluateVal09SotpQualification({
      multiSegmentIdentityBinding: result.segments.length >= 2,
      temporalSegmentHistoryPreserved: result.segments.some((row) => row.identityHistory.length >= 1),
      perSegmentMethodSelection: new Set(result.segmentValuations.map((row) => row.method)).size >= 2,
      segmentDriverTreesSupported: result.segmentValuations.some((row) =>
        row.methodRationale.includes('driver_tree_attached'),
      ),
      intersegmentEliminationHandling: result.bridge.intersegmentEliminationsMinor > 0n,
      corporateBridgePresent: result.bridge.corporateBridge.adjustments.length > 0,
      conglomerateDiscountNotAutoApplied: result.bridge.observedConglomerateDiscount.notAppliedToIntrinsic,
      scenarioWeightedUncertainSegments: result.segmentValuations.some(
        (row) => row.distribution.scenarioBreakdown.length > 1,
      ),
      intrinsicDistributionOutputs: result.intrinsicDistribution.segmentCount >= 2,
      noExecutionAuthority: result.grantsExecutionAuthority === false,
      researchOnly: result.researchOnly === true,
    });

    assert.equal(qualification.marker, HELIOS_VAL09_SOTP_QUALIFIED, qualification.blockers.join('; '));
    assert.equal(qualification.segmentMethodsSupported.length, SEGMENT_VALUATION_METHODS.length);
  });
});
