import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../domain/src/time.ts';
import { fixtureContribution, FIXTURE_NOW, FIXTURE_SUBJECT } from './fixtures.ts';
import { DEFAULT_VERIFICATION_POLICY_VERSION, fingerprintEconomicEvent } from './fingerprint.ts';
import { eventReferenceFor, evidenceRefFor, subjectRefFor } from './ids.ts';
import type { ContributionId } from './ids.ts';
import { HumanContributionRegistry, HumanEconomicContributionRegistry } from './registry.ts';
import { InMemoryHumanContributionRegistryStore } from './store.ts';
import type { HumanContributionRegistryPort } from './port.ts';
import type { HumanContributionRegistryRecord } from './types.ts';

function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: { code: string; message: string } }): T {
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.value;
}

function verifyAt(registry: HumanContributionRegistry, contributionId: ContributionId) {
  return unwrap(
    registry.verify({
      contributionId,
      verificationTimestamp: asUtcInstant('2026-08-19T12:05:00.000Z'),
      verificationPolicyVersion: DEFAULT_VERIFICATION_POLICY_VERSION,
    }),
  );
}

function assertNoForbiddenFields(record: HumanContributionRegistryRecord): void {
  assert.equal(record.sunReyQuantity, null);
  assert.equal(record.valuationAmount, null);
  assert.equal(record.issuesExecutionAuthority, false);
  assert.equal(record.issuesMintAuthority, false);
  assert.equal(record.event.sunReyQuantity, null);
  assert.equal(record.event.humanWorthScore, false);
  assert.equal(record.event.privacyBoundary.containRawPersonalData, false);
  assert.equal('legalName' in record, false);
  assert.equal('email' in record, false);
  assert.equal('rawPdvContent' in record, false);
  assert.equal('rawCleanRoomRows' in record, false);
}

describe('CHUNK-106 human contribution registry', () => {
  it('registers a valid verified contribution', () => {
    const registry: HumanContributionRegistryPort = new HumanContributionRegistry();
    const submitted = unwrap(registry.submit(fixtureContribution('RESEARCH_PARTICIPATION', 'reg-valid')));
    assert.notEqual(submitted.status, 'VERIFIED');
    const verified = verifyAt(registry as HumanContributionRegistry, submitted.contributionId);
    assert.equal(verified.status, 'VERIFIED');
    assert.ok(verified.verifiedMeasurement);
    assert.equal(verified.verifiedMeasurement?.quantity, 1n);
    assert.equal(verified.verificationPolicyVersion, DEFAULT_VERIFICATION_POLICY_VERSION);
    assert.ok(verified.verificationTimestamp);
    assert.ok(verified.registryRecordId.startsWith('hrr_'));
    assert.ok(verified.fingerprint.startsWith('hfp_'));
    assert.ok(verified.evidenceDigest.length > 0);
    assert.ok(registry.getVerifiedReference(verified.contributionId));
    assertNoForbiddenFields(verified);
  });

  it('refuses a duplicate active fingerprint', () => {
    const registry = new HumanContributionRegistry();
    const first = unwrap(registry.submit(fixtureContribution('CREATIVE_PRODUCTION', 'dup-event')));
    verifyAt(registry, first.contributionId);
    const replaySameId = registry.submit({
      ...fixtureContribution('CREATIVE_PRODUCTION', 'dup-event'),
      contributionId: first.contributionId,
    });
    assert.equal(replaySameId.ok, true);

    const duplicate = registry.submit({
      ...fixtureContribution('CREATIVE_PRODUCTION', 'dup-event'),
      createdAt: asUtcInstant('2026-08-19T12:10:00.000Z'),
    });
    assert.equal(duplicate.ok, false);
    if (!duplicate.ok) {
      assert.equal(duplicate.error.code, 'DUPLICATE_FINGERPRINT');
    }
    assert.equal(registry.audit().duplicateAttempts, 1);
  });

  it('does not treat a rejected contribution as verified', () => {
    const registry = new HumanContributionRegistry();
    const submitted = unwrap(registry.submit(fixtureContribution('COMMUNITY_CONTRIBUTION', 'rej-1')));
    const rejected = unwrap(
      registry.reject({
        contributionId: submitted.contributionId,
        rejectedAt: asUtcInstant('2026-08-19T12:06:00.000Z'),
        reasonCode: 'INSUFFICIENT_EVIDENCE',
      }),
    );
    assert.equal(rejected.status, 'REJECTED');
    assert.equal(registry.getVerifiedReference(rejected.contributionId), undefined);
    assert.equal(registry.query({ verifiedOnly: true }).length, 0);
    assert.equal(registry.query({ status: 'REJECTED' })[0]?.contributionId, rejected.contributionId);
  });

  it('corrects by creating a new record that references the prior', () => {
    const registry = new HumanContributionRegistry();
    const original = unwrap(registry.submit(fixtureContribution('PROFESSIONAL_EXPERTISE', 'corr-1')));
    verifyAt(registry, original.contributionId);
    const correction = unwrap(
      registry.correct(original.contributionId, {
        ...fixtureContribution('PROFESSIONAL_EXPERTISE', 'corr-2'),
        createdAt: asUtcInstant('2026-08-19T13:00:00.000Z'),
        measurementQuantity: 3n,
      }),
    );
    const prior = registry.getRecord(original.contributionId);
    assert.ok(prior);
    assert.equal(prior.status, 'CORRECTED');
    assert.equal(prior.supersededBy, correction.contributionId);
    assert.equal(correction.corrects, original.contributionId);
    assert.equal(correction.supersedes, original.contributionId);
    assert.equal(registry.getVerifiedReference(original.contributionId), undefined);
  });

  it('supersedes without deleting history', () => {
    const registry = new HumanContributionRegistry();
    const original = unwrap(registry.record(fixtureContribution('RESEARCH_PARTICIPATION', 'sup-1')));
    const successor = unwrap(
      registry.supersede(original.contributionId, {
        ...fixtureContribution('RESEARCH_PARTICIPATION', 'sup-2'),
        createdAt: asUtcInstant('2026-08-19T13:00:00.000Z'),
        measurementQuantity: 2n,
      }),
    );
    assert.equal(registry.get(original.contributionId)?.status, 'SUPERSEDED');
    assert.equal(successor.supersedes, original.contributionId);
    assert.equal(registry.history(successor.contributionId).length, 2);
  });

  it('queries by subject, class, and jurisdiction', () => {
    const registry = new HumanContributionRegistry();
    const other = subjectRefFor('other-contributor');
    unwrap(registry.submit(fixtureContribution('CREATIVE_PRODUCTION', 'q-creative')));
    unwrap(
      registry.submit({
        ...fixtureContribution('RESEARCH_PARTICIPATION', 'q-research'),
        jurisdiction: 'US',
      }),
    );
    unwrap(
      registry.submit({
        ...fixtureContribution('COMMUNITY_CONTRIBUTION', 'q-other'),
        subjectRef: other,
      }),
    );

    assert.equal(registry.query({ subjectRef: FIXTURE_SUBJECT }).length, 2);
    assert.equal(registry.query({ contributionClass: 'CREATIVE_PRODUCTION' }).length, 1);
    assert.equal(registry.query({ jurisdiction: 'US' }).length, 1);
    assert.equal(registry.listBySubject(FIXTURE_SUBJECT).length, 2);
  });

  it('queries by period, source, fingerprint, and evidence', () => {
    const registry = new HumanContributionRegistry();
    const input = fixtureContribution('HUMAN_SERVICE_DELIVERY', 'q-period');
    const recorded = unwrap(registry.submit(input));
    const fingerprint = fingerprintEconomicEvent({
      subjectRef: recorded.subjectRef,
      contributionClass: recorded.contributionClass,
      eventReference: recorded.event.eventReference,
      validFrom: recorded.measurementPeriod.start,
      validUntil: recorded.measurementPeriod.end,
      measurementQuantity: recorded.event.measurement.quantity,
      measurementUnit: recorded.measurementUnit,
      jurisdiction: recorded.jurisdiction,
      sourceClass: recorded.sourceClass,
    });
    assert.equal(registry.query({ fingerprint })[0]?.contributionId, recorded.contributionId);
    assert.equal(registry.query({ sourceClass: 'VERIFIED_INSTITUTIONAL_ATTESTATION' }).length, 1);
    assert.equal(registry.query({ evidenceRef: evidenceRefFor('q-period') }).length, 1);
    assert.equal(
      registry.query({
        periodStart: asUtcInstant('2026-08-01T00:00:00.000Z'),
        periodEnd: asUtcInstant('2026-09-01T00:00:00.000Z'),
      }).length,
      1,
    );
    assert.equal(
      registry.query({
        periodStart: asUtcInstant('2025-01-01T00:00:00.000Z'),
        periodEnd: asUtcInstant('2025-02-01T00:00:00.000Z'),
      }).length,
      0,
    );
  });

  it('rebuilds projections from canonical records after they are cleared', () => {
    const store = new InMemoryHumanContributionRegistryStore();
    const registry = new HumanContributionRegistry(store);
    const submitted = unwrap(registry.submit(fixtureContribution('EDUCATION_SKILL_ATTESTATION', 'snap-1')));
    verifyAt(registry, submitted.contributionId);
    registry.persist();
    const snapshot = registry.snapshot();
    assert.equal(snapshot.records.length, 1);

    registry.clearProjections();
    assert.equal(registry.query({ contributionClass: 'EDUCATION_SKILL_ATTESTATION' }).length, 1);
    registry.rebuildProjections();
    assert.equal(registry.query({ subjectRef: FIXTURE_SUBJECT }).length, 1);
    assert.equal(registry.get(submitted.contributionId)?.contributionId, submitted.contributionId);

    const rebuilt = new HumanContributionRegistry(store);
    rebuilt.loadFromStore();
    assert.equal(rebuilt.getRecord(submitted.contributionId)?.status, 'VERIFIED');
    assert.equal(rebuilt.query({ verifiedOnly: true }).length, 1);
  });

  it('produces a deterministic audit report without valuation totals', () => {
    const registry = new HumanContributionRegistry();
    const research = unwrap(registry.submit(fixtureContribution('RESEARCH_PARTICIPATION', 'aud-research')));
    verifyAt(registry, research.contributionId);
    const community = unwrap(registry.submit(fixtureContribution('COMMUNITY_CONTRIBUTION', 'aud-community')));
    unwrap(
      registry.reject({
        contributionId: community.contributionId,
        rejectedAt: asUtcInstant('2026-08-19T12:20:00.000Z'),
        reasonCode: 'SOURCE_NOT_ATTESTED',
      }),
    );
    unwrap(registry.submit(fixtureContribution('CREATIVE_PRODUCTION', 'aud-creative')));
    registry.submit({
      ...fixtureContribution('RESEARCH_PARTICIPATION', 'aud-research'),
      createdAt: asUtcInstant('2026-08-19T12:30:00.000Z'),
    });

    const first = registry.audit();
    const second = registry.audit();
    assert.deepEqual(first, second);
    assert.equal(first.verified, 1);
    assert.equal(first.rejected, 1);
    assert.equal(first.submitted, 1);
    assert.equal(first.duplicateAttempts, 1);
    assert.ok(first.countsByContributionClass.length >= 3);
    assert.ok(first.verificationPolicyVersions.includes(DEFAULT_VERIFICATION_POLICY_VERSION));
    assert.equal(first.valuationTotals, null);
    assert.equal(first.sunReyTotals, null);
  });

  it('keeps replay of the same contributionId idempotent', () => {
    const registry = new HumanContributionRegistry();
    const input = fixtureContribution('ENTREPRENEURIAL_ACTIVITY', 'idem-1');
    const first = unwrap(registry.submit(input));
    const second = unwrap(registry.submit({ ...input, contributionId: first.contributionId }));
    assert.equal(first.registryRecordId, second.registryRecordId);
    assert.equal(first.fingerprint, second.fingerprint);
    const verifiedOnce = verifyAt(registry, first.contributionId);
    const verifiedTwice = verifyAt(registry, first.contributionId);
    assert.equal(verifiedOnce.verificationTimestamp, verifiedTwice.verificationTimestamp);
  });

  it('exposes the same class as HumanEconomicContributionRegistry', () => {
    assert.equal(HumanEconomicContributionRegistry, HumanContributionRegistry);
    const registry = new HumanEconomicContributionRegistry();
    assert.equal(registry.authorizeExecution(unwrap(registry.record(fixtureContribution('COMMUNITY_CONTRIBUTION', 'alias')))).authorized, false);
    assert.equal(registry.authorizeMint(unwrap(registry.record(fixtureContribution('COMMUNITY_CONTRIBUTION', 'alias-2')))).authorized, false);
  });

  it('does not create a second event reference for the same fixture seed', () => {
    assert.equal(eventReferenceFor('same-seed'), eventReferenceFor('same-seed'));
  });
});
