/**
 * HELIOS ALT10 — public procurement and government demand intelligence.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  ADVERSARIAL_PROCUREMENT_TIMELINE,
  DUPLICATE_AWARD_SUBSIDIARY,
  ENTITY_IDS,
  ingestProcurementObservation,
} from '../packages/external-data/src/procurement/index.ts';
import {
  assertNoFutureProcurementLeak,
  computeGovernmentDemandFeatures,
  createProcurementIntelligenceService,
  evaluateAlt10Qualification,
  estimateContractRevenueFromCalibration,
  HELIOS_ALT10_PROCUREMENT_INTELLIGENCE_QUALIFIED,
  parentDoesNotInheritJvCeiling,
  runAlt10AdversarialChecks,
  type Alt10QualificationChecks,
} from '../packages/platform/src/helios/procurement-intelligence/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

describe('HELIOS ALT10 government procurement intelligence', () => {
  it('passes HELIOS boundary lint for procurement-intelligence paths', () => {
    const findings = lintHeliosBoundary(process.cwd());
    const scoped = findings.filter((f) => f.file.includes('helios/procurement-intelligence'));
    assert.deepEqual(scoped, []);
  });

  it('adversarial: future award cannot leak before knowableAt', () => {
    const checks = runAlt10AdversarialChecks();
    assert.equal(checks.futureAwardCannotLeak, true);
  });

  it('adversarial: joint venture award is not attributed to parent company', () => {
    const checks = runAlt10AdversarialChecks();
    assert.equal(checks.jointVentureNotAttributedToParent, true);
  });

  it('adversarial: award ceiling and obligation are distinct from revenue estimate', () => {
    const checks = runAlt10AdversarialChecks();
    assert.equal(checks.awardCeilingDistinctFromRevenueEstimate, true);
    assert.equal(checks.obligationDistinctFromRevenueEstimate, true);
  });

  it('adversarial: duplicate provider reports dedupe', () => {
    const checks = runAlt10AdversarialChecks();
    assert.equal(checks.duplicateProviderReportsDedupe, true);
  });

  it('emits HELIOS_ALT10_PROCUREMENT_INTELLIGENCE_QUALIFIED when adversarial checks pass', () => {
    const result = evaluateAlt10Qualification(runAlt10AdversarialChecks());
    assert.equal(result.qualified, true, result.blockers.join('; '));
    assert.equal(result.marker, HELIOS_ALT10_PROCUREMENT_INTELLIGENCE_QUALIFIED);
  });
});
