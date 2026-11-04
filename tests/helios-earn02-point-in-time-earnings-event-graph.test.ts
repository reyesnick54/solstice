/**
 * HELIOS EARN02 — point-in-time earnings event graph qualification.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  ADVERSARIAL_EARNINGS_TIMELINE,
  ADVERSARIAL_EVENT_KEY,
  IR_EARLY_RELEASE,
  SEC_8K_AMENDMENT,
  SEC_8K_RELEASE,
} from '../packages/external-data/src/earnings/index.ts';
import {
  assertNoFutureEarningsLeak,
  createEarningsEventGraphService,
  evaluateEarn02Qualification,
  HELIOS_EARN02_EVENT_GRAPH_QUALIFIED,
  type Earn02QualificationChecks,
} from '../packages/platform/src/helios/earnings-intelligence/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

function runEarn02AdversarialChecks(): Earn02QualificationChecks {
  const service = createEarningsEventGraphService();
  for (const row of ADVERSARIAL_EARNINGS_TIMELINE) {
    service.ingestObservation(row);
  }

  const beforeRelease = service.snapshotAt({
    earningsEventKey: ADVERSARIAL_EVENT_KEY,
    decisionTimeUtc: asUtcInstant('2025-04-29T11:00:00.000Z'),
  });
  const afterIrRelease = service.snapshotAt({
    earningsEventKey: ADVERSARIAL_EVENT_KEY,
    decisionTimeUtc: asUtcInstant('2025-04-29T12:00:00.000Z'),
  });
  const afterSecOriginal = service.snapshotAt({
    earningsEventKey: ADVERSARIAL_EVENT_KEY,
    decisionTimeUtc: asUtcInstant('2025-04-29T22:00:00.000Z'),
  });
  const afterRescheduleKnowable = service.snapshotAt({
    earningsEventKey: ADVERSARIAL_EVENT_KEY,
    decisionTimeUtc: asUtcInstant('2025-04-10T09:00:00.000Z'),
  });
  const afterAmendment = service.snapshotAt({
    earningsEventKey: ADVERSARIAL_EVENT_KEY,
    decisionTimeUtc: asUtcInstant('2025-05-02T17:00:00.000Z'),
  });

  const ledger = service.revisionLedger();
  const secChain = ledger.listChain(SEC_8K_RELEASE.lineageRootId);
  const beforeAmendmentChain = secChain.filter(
    (row) => Date.parse(row.knowableAt) <= Date.parse('2025-04-29T22:00:00.000Z'),
  );

  const releaseNodesBefore = (beforeRelease?.nodes ?? []).filter((n) => n.kind === 'EARNINGS_RELEASE');
  const secNodesBefore = (beforeRelease?.nodes ?? []).filter((n) => n.kind === 'SEC_FILING');

  const irReleaseNodes = service
    .store()
    .listObservations()
    .filter((row) => row.observation.artifactKind === 'EARNINGS_RELEASE');

  return Object.freeze({
    futureReleaseCannotLeak:
      beforeRelease !== null &&
      releaseNodesBefore.length === 0 &&
      secNodesBefore.length === 0 &&
      beforeRelease.times.actualReleaseTime === null &&
      assertNoFutureEarningsLeak({
        decisionTimeUtc: asUtcInstant('2025-04-29T11:00:00.000Z'),
        snapshot: beforeRelease,
      }).ok,
    revisedReleasePreservesPriorState:
      afterIrRelease !== null &&
      afterSecOriginal !== null &&
      afterIrRelease.times.actualReleaseTime === IR_EARLY_RELEASE.times.actualReleaseTime,
    rescheduledEventRetainsLineage:
      afterRescheduleKnowable !== null &&
      afterRescheduleKnowable.nodes.some((n) => n.observationId === 'cal:adv:schedule:v1') &&
      afterRescheduleKnowable.nodes.some((n) => n.observationId === 'cal:adv:schedule:v2') &&
      afterRescheduleKnowable.edges.some((e) => e.kind === 'AMENDS'),
    sessionTimingClassificationCorrect:
      afterIrRelease !== null &&
      afterIrRelease.sessionTiming === 'BEFORE_MARKET' &&
      afterSecOriginal !== null &&
      afterSecOriginal.sessionTiming === 'AFTER_MARKET',
    amendedFilingDoesNotRewriteHistory:
      beforeAmendmentChain.length === 1 &&
      beforeAmendmentChain[0]!.observationRef === SEC_8K_RELEASE.observationId &&
      afterAmendment !== null &&
      secChain.length === 2 &&
      secChain[0]!.observationRef === SEC_8K_RELEASE.observationId &&
      secChain[1]!.observationRef === SEC_8K_AMENDMENT.observationId,
    duplicateProviderReportsDedupe: irReleaseNodes.length === 1,
  });
}

describe('HELIOS EARN02 point-in-time earnings event graph', () => {
  it('passes HELIOS boundary lint for earnings-intelligence paths', () => {
    const findings = lintHeliosBoundary(process.cwd());
    const earnFindings = findings.filter((f) => f.file.includes('helios/earnings-intelligence'));
    assert.deepEqual(earnFindings, []);
  });

  it('adversarial: future release cannot leak before knowableAt', () => {
    const checks = runEarn02AdversarialChecks();
    assert.equal(checks.futureReleaseCannotLeak, true);
  });

  it('adversarial: rescheduled event retains lineage and prior schedule state', () => {
    const checks = runEarn02AdversarialChecks();
    assert.equal(checks.rescheduledEventRetainsLineage, true);
  });

  it('adversarial: before-market vs during-market session timing', () => {
    const checks = runEarn02AdversarialChecks();
    assert.equal(checks.sessionTimingClassificationCorrect, true);
  });

  it('adversarial: amended SEC filing appends revision without erasing original', () => {
    const checks = runEarn02AdversarialChecks();
    assert.equal(checks.amendedFilingDoesNotRewriteHistory, true);
  });

  it('adversarial: duplicate provider reports dedupe to one sealed observation', () => {
    const checks = runEarn02AdversarialChecks();
    assert.equal(checks.duplicateProviderReportsDedupe, true);
  });

  it('emits HELIOS_EARN02_EVENT_GRAPH_QUALIFIED when adversarial checks pass', () => {
    const result = evaluateEarn02Qualification(runEarn02AdversarialChecks());
    assert.equal(result.qualified, true, result.blockers.join('; '));
    assert.equal(result.marker, HELIOS_EARN02_EVENT_GRAPH_QUALIFIED);
  });
});
