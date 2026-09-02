import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../domain/src/time.ts';
import {
  HUMAN_ECONOMY_UNIQUENESS_CONTROLS,
  HumanContributionResolutionEngine,
  HumanContributionMonetizationStore,
  aggregationKeyForClass,
  asContributionResolutionFingerprint,
  asMonetizationContextId,
  authoritativeIdCommitmentFrom,
  buildCanonicalHumanContributionEvent,
  contentCommitmentFromEvidence,
  deriveActorCommitment,
  humanEconomicIdentityIdFor,
  isRecurringContributionClass,
  monetizationKeyOf,
  resolveCrossSourceObservations,
} from './resolution/index.ts';

const NOW = asUtcInstant('2026-09-02T12:00:00.000Z');
const ACTOR = deriveActorCommitment(['orcid:0000-0002-1825-0097']);
const IDENTITY = humanEconomicIdentityIdFor({ actorCommitment: ACTOR, jurisdiction: 'GB' });
const DOI = authoritativeIdCommitmentFrom('doi', '10.1000/wave6-paper');
const RECEIPT = authoritativeIdCommitmentFrom('receipt', 'compute-job-abc');
const CREDENTIAL = authoritativeIdCommitmentFrom('credential', 'vc-research-001');

function baseObservation(overrides: Partial<Parameters<HumanContributionResolutionEngine['submitObservation']>[0]> = {}) {
  return {
    sourceClass: 'VERIFIED_RESEARCH_ATTESTATION' as const,
    providerId: 'pubmed',
    providerRecordId: 'pmid:12345',
    humanEconomicIdentityId: IDENTITY,
    walletBindingRef: null,
    contributionClass: 'RESEARCH_PARTICIPATION' as const,
    authoritativeIdCommitments: [DOI],
    contentCommitment: contentCommitmentFromEvidence(['evidence:paper-body']),
    validFromUtc: NOW,
    validUntilUtc: null,
    measurementQuantity: 1n,
    measurementUnit: 'VERIFIED_RESEARCH_SESSION' as const,
    observedAtUtc: NOW,
    ...overrides,
  };
}

describe('Wave 6 human contribution resolution — audit', () => {
  it('documents existing uniqueness controls', () => {
    assert.ok(HUMAN_ECONOMY_UNIQUENESS_CONTROLS.length >= 10);
    const fingerprint = HUMAN_ECONOMY_UNIQUENESS_CONTROLS.find((control) => control.control.includes('fingerprint'));
    assert.ok(fingerprint?.appliesToHumanEconomy);
    assert.ok(fingerprint?.wave6Extension);
  });
});

describe('Wave 6 canonical human contribution event', () => {
  it('derives stable canonical event id from authoritative ids not timestamps alone', () => {
    const eventA = buildCanonicalHumanContributionEvent({
      humanEconomicIdentityId: IDENTITY,
      contributionClass: 'RESEARCH_PARTICIPATION',
      authoritativeIdCommitments: [DOI],
      validFromUtc: NOW,
      validUntilUtc: null,
      contentCommitment: contentCommitmentFromEvidence(['evidence:paper']),
      measurementQuantity: 1n,
      measurementUnit: 'VERIFIED_RESEARCH_SESSION',
    });
    const eventB = buildCanonicalHumanContributionEvent({
      humanEconomicIdentityId: IDENTITY,
      contributionClass: 'RESEARCH_PARTICIPATION',
      authoritativeIdCommitments: [DOI],
      validFromUtc: asUtcInstant('2026-09-02T13:00:00.000Z'),
      validUntilUtc: null,
      contentCommitment: contentCommitmentFromEvidence(['evidence:paper']),
      measurementQuantity: 1n,
      measurementUnit: 'VERIFIED_RESEARCH_SESSION',
    });
    assert.equal(eventA.canonicalEventId, eventB.canonicalEventId);
    assert.equal(eventA.resolutionFingerprint, eventB.resolutionFingerprint);
  });
});

describe('Wave 6 cross-source resolution', () => {
  it('resolves same publication from four databases into one canonical event', () => {
    const engine = new HumanContributionResolutionEngine();
    const sources = [
      { providerId: 'pubmed', providerRecordId: 'pmid:1', sourceClass: 'VERIFIED_RESEARCH_ATTESTATION' as const },
      { providerId: 'crossref', providerRecordId: 'cr:1', sourceClass: 'VERIFIED_RESEARCH_ATTESTATION' as const },
      { providerId: 'university', providerRecordId: 'uni:1', sourceClass: 'VERIFIED_INSTITUTIONAL_ATTESTATION' as const },
      { providerId: 'orcid', providerRecordId: 'orcid:1', sourceClass: 'VERIFIED_RESEARCH_ATTESTATION' as const },
    ];
    for (const source of sources) {
      const submitted = engine.submitObservation(baseObservation(source));
      assert.equal(submitted.ok, true, source.providerId);
    }
    const clusters = engine.resolveAll();
    assert.equal(clusters.length, 1);
    assert.equal(clusters[0]!.resolutionStatus, 'RESOLVED');
    assert.equal(clusters[0]!.observationIds.length, 4);
    assert.equal(clusters[0]!.sourceClasses.length, 2);
  });
});

describe('Wave 6 duplicate and replay protection', () => {
  it('rejects same work receipt twice', () => {
    const engine = new HumanContributionResolutionEngine();
    const first = engine.submitObservation(
      baseObservation({
        providerId: 'clean-room',
        providerRecordId: 'receipt:work-1',
        authoritativeIdCommitments: [RECEIPT],
        contributionClass: 'MODEL_TRAINING_PARTICIPATION',
        measurementUnit: 'MODEL_TRAINING_PARTICIPATION_UNIT',
        contentCommitment: contentCommitmentFromEvidence(['job-output']),
        receiptId: 'receipt:work-1',
      }),
    );
    assert.equal(first.ok, true);
    const second = engine.submitObservation(
      baseObservation({
        providerId: 'clean-room',
        providerRecordId: 'receipt:work-1',
        authoritativeIdCommitments: [RECEIPT],
        contributionClass: 'MODEL_TRAINING_PARTICIPATION',
        measurementUnit: 'MODEL_TRAINING_PARTICIPATION_UNIT',
        contentCommitment: contentCommitmentFromEvidence(['job-output']),
        receiptId: 'receipt:work-1',
      }),
    );
    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.equal(second.error.code, 'OBSERVATION_REPLAY');
    }
  });

  it('rejects same credential twice', () => {
    const engine = new HumanContributionResolutionEngine();
    const obs = baseObservation({
      authoritativeIdCommitments: [CREDENTIAL],
      credentialCommitment: 'vc-research-001',
      contributionClass: 'EDUCATION_SKILL_ATTESTATION',
      measurementUnit: 'EDUCATION_SKILL_ATTESTATION_UNIT',
    });
    assert.equal(engine.submitObservation(obs).ok, true);
    const replay = engine.submitObservation({
      ...obs,
      providerRecordId: 'cred:replay',
      providerId: 'issuer',
    });
    assert.equal(replay.ok, false);
  });

  it('rejects same computation job twice from different provider records', () => {
    const engine = new HumanContributionResolutionEngine();
    const material = {
      contributionClass: 'MODEL_TRAINING_PARTICIPATION' as const,
      authoritativeIdCommitments: [RECEIPT],
      measurementUnit: 'MODEL_TRAINING_PARTICIPATION_UNIT' as const,
      contentCommitment: contentCommitmentFromEvidence(['compute-output']),
      receiptId: 'job:42',
    };
    assert.equal(
      engine.submitObservation(baseObservation({ ...material, providerId: 'a', providerRecordId: 'a:1' })).ok,
      true,
    );
    const clusters = engine.resolveAll();
    assert.equal(clusters.length, 1);
    const duplicate = engine.submitObservation(
      baseObservation({ ...material, providerId: 'b', providerRecordId: 'b:1', observedAtUtc: asUtcInstant('2026-09-02T13:00:00.000Z') }),
    );
    assert.equal(duplicate.ok, true);
    assert.equal(engine.resolveAll().length, 1);
    assert.equal(engine.resolveAll()[0]!.observationIds.length, 2);
  });

  it('flags timestamp alteration on identical content', () => {
    const engine = new HumanContributionResolutionEngine();
    assert.equal(engine.submitObservation(baseObservation({ providerRecordId: 'first' })).ok, true);
    const altered = engine.submitObservation(
      baseObservation({
        providerRecordId: 'second',
        validFromUtc: asUtcInstant('2026-09-01T00:00:00.000Z'),
      }),
    );
    assert.equal(altered.ok, false);
    if (!altered.ok) {
      assert.equal(altered.error.code, 'UNRESOLVED_DUPLICATE');
    }
  });
});

describe('Wave 6 multiple wallet protection', () => {
  it('binds wallets A B C to one economic identity and one canonical event', () => {
    const engine = new HumanContributionResolutionEngine();
    const observation = {
      ...baseObservation(),
      providerRecordId: 'wallet-test',
    };
    for (const wallet of ['wallet-a', 'wallet-b', 'wallet-c']) {
      const submitted = engine.bindWalletAndSubmit({
        walletCommitment: wallet,
        actorCommitment: ACTOR,
        jurisdiction: 'GB',
        observation: { ...observation, providerRecordId: `${wallet}:record` },
      });
      assert.equal(submitted.ok, true, wallet);
    }
    const clusters = engine.resolveAll();
    assert.equal(clusters.length, 1);
    assert.equal(clusters[0]!.humanEconomicIdentityId, IDENTITY);
  });
});

describe('Wave 6 cross-identity claim attack', () => {
  it('flags same credential claimed by two identities as fraud suspected', () => {
    const engine = new HumanContributionResolutionEngine();
    const identityB = humanEconomicIdentityIdFor({ actorCommitment: deriveActorCommitment(['orcid:other-person']) });
    const first = engine.submitObservation(
      baseObservation({
        humanEconomicIdentityId: IDENTITY,
        authoritativeIdCommitments: [CREDENTIAL],
        credentialCommitment: 'vc-research-001',
        contributionClass: 'EDUCATION_SKILL_ATTESTATION',
        measurementUnit: 'EDUCATION_SKILL_ATTESTATION_UNIT',
        providerRecordId: 'id-a',
      }),
    );
    assert.equal(first.ok, true);
    const second = engine.submitObservation(
      baseObservation({
        humanEconomicIdentityId: identityB,
        authoritativeIdCommitments: [CREDENTIAL],
        credentialCommitment: 'vc-research-001',
        contributionClass: 'EDUCATION_SKILL_ATTESTATION',
        measurementUnit: 'EDUCATION_SKILL_ATTESTATION_UNIT',
        providerRecordId: 'id-b',
      }),
    );
    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.equal(second.error.code, 'FRAUD_SUSPECTED');
    }
    assert.equal(engine.listConflicts().length, 1);
    assert.equal(engine.listConflicts()[0]!.code, 'FRAUD_SUSPECTED');
  });

  it('requires manual review for same publication claimed by two identities', () => {
    const engine = new HumanContributionResolutionEngine();
    const identityB = humanEconomicIdentityIdFor({ actorCommitment: deriveActorCommitment(['hin:other']) });
    assert.equal(engine.submitObservation(baseObservation({ humanEconomicIdentityId: IDENTITY, providerRecordId: 'a' })).ok, true);
    const conflict = engine.submitObservation(
      baseObservation({ humanEconomicIdentityId: identityB, providerRecordId: 'b' }),
    );
    assert.equal(conflict.ok, false);
    if (!conflict.ok) {
      assert.equal(conflict.error.code, 'MANUAL_REVIEW_REQUIRED');
    }
  });
});

describe('Wave 6 recurring legitimate activity', () => {
  it('distinguishes employment across many days', () => {
    const keyDay1 = aggregationKeyForClass('PROFESSIONAL_EXPERTISE', {
      authoritativeIdCommitments: [authoritativeIdCommitmentFrom('employer', 'acme')],
      validFromUtc: asUtcInstant('2026-09-01T09:00:00.000Z'),
      validUntilUtc: asUtcInstant('2026-09-01T17:00:00.000Z'),
      contentCommitment: 'work',
    });
    const keyDay2 = aggregationKeyForClass('PROFESSIONAL_EXPERTISE', {
      authoritativeIdCommitments: [authoritativeIdCommitmentFrom('employer', 'acme')],
      validFromUtc: asUtcInstant('2026-09-02T09:00:00.000Z'),
      validUntilUtc: asUtcInstant('2026-09-02T17:00:00.000Z'),
      contentCommitment: 'work',
    });
    assert.notEqual(keyDay1, keyDay2);
    assert.equal(isRecurringContributionClass('PROFESSIONAL_EXPERTISE'), true);
  });

  it('allows legitimate multiple publications', () => {
    const engine = new HumanContributionResolutionEngine();
    const doiA = authoritativeIdCommitmentFrom('doi', '10.1000/paper-a');
    const doiB = authoritativeIdCommitmentFrom('doi', '10.1000/paper-b');
    assert.equal(engine.submitObservation(baseObservation({ authoritativeIdCommitments: [doiA], providerRecordId: 'a' })).ok, true);
    assert.equal(engine.submitObservation(baseObservation({ authoritativeIdCommitments: [doiB], providerRecordId: 'b' })).ok, true);
    assert.equal(engine.resolveAll().length, 2);
  });

  it('allows legitimate multiple compute jobs', () => {
    const engine = new HumanContributionResolutionEngine();
    const jobA = authoritativeIdCommitmentFrom('receipt', 'job-a');
    const jobB = authoritativeIdCommitmentFrom('receipt', 'job-b');
    const material = {
      contributionClass: 'MODEL_TRAINING_PARTICIPATION' as const,
      measurementUnit: 'MODEL_TRAINING_PARTICIPATION_UNIT' as const,
      contentCommitment: contentCommitmentFromEvidence(['output']),
    };
    assert.equal(
      engine.submitObservation(baseObservation({ ...material, authoritativeIdCommitments: [jobA], providerRecordId: 'ja' })).ok,
      true,
    );
    assert.equal(
      engine.submitObservation(baseObservation({ ...material, authoritativeIdCommitments: [jobB], providerRecordId: 'jb' })).ok,
      true,
    );
    assert.equal(engine.resolveAll().length, 2);
  });
});

describe('Wave 6 claim generation and monetization lock', () => {
  it('only resolved clusters produce claims and block duplicate monetization', () => {
    const engine = new HumanContributionResolutionEngine();
    for (const source of ['pubmed', 'crossref']) {
      engine.submitObservation(
        baseObservation({
          providerId: source,
          providerRecordId: `${source}:1`,
        }),
      );
    }
    const cluster = engine.resolveAll()[0]!;
    const claim = engine.generateClaimForCluster(cluster.clusterId, NOW);
    assert.equal(claim.ok, true);
    if (!claim.ok) {
      return;
    }
    const duplicateClaim = engine.generateClaimForCluster(cluster.clusterId, NOW);
    assert.equal(duplicateClaim.ok, false);

    const context = asMonetizationContextId('hctx_0123456789abcdef0123456789abcdef');
    const monetized = engine.attemptMonetization({ claimId: claim.value.claimId, contextId: context, now: NOW });
    assert.equal(monetized.ok, true);
    const replay = engine.attemptMonetization({ claimId: claim.value.claimId, contextId: context, now: NOW });
    assert.equal(replay.ok, false);
    if (!replay.ok) {
      assert.equal(replay.error.code, 'ALREADY_CONSUMED');
    }
  });

  it('blocks monetization replay across restart via consumed key store', () => {
    const store = new HumanContributionMonetizationStore();
    const context = asMonetizationContextId('hctx_abcdef0123456789abcdef0123456789');
    const fingerprint = asContributionResolutionFingerprint('hcrf_0123456789abcdef0123456789abcdef');
    store.restoreConsumedKeys([monetizationKeyOf(fingerprint, context)]);
    assert.equal(store.isConsumed(fingerprint, context), true);
  });

  it('includes consumed monetization keys in engine snapshot', () => {
    const engine = new HumanContributionResolutionEngine();
    for (const source of ['pubmed', 'crossref']) {
      engine.submitObservation(baseObservation({ providerId: source, providerRecordId: `${source}:snapshot` }));
    }
    const cluster = engine.resolveAll()[0]!;
    const claim = engine.generateClaimForCluster(cluster.clusterId, NOW);
    assert.equal(claim.ok, true);
    if (!claim.ok) return;
    const context = asMonetizationContextId('hctx_0123456789abcdef0123456789abcdef');
    assert.equal(engine.attemptMonetization({ claimId: claim.value.claimId, contextId: context, now: NOW }).ok, true);
    const snapshot = engine.snapshot();
    assert.ok(snapshot.consumedMonetizationKeys.length >= 1);
  });

  it('does not generate claim for unresolved single-source without force', () => {
    const engine = new HumanContributionResolutionEngine();
    engine.submitObservation(baseObservation());
    const cluster = engine.resolveAll()[0]!;
    assert.equal(cluster.resolutionStatus, 'PENDING_CORROBORATION');
    const blocked = engine.generateClaimForCluster(cluster.clusterId, NOW);
    assert.equal(blocked.ok, false);
    const forced = engine.generateClaimForCluster(cluster.clusterId, NOW, true);
    assert.equal(forced.ok, true);
  });
});

describe('Wave 6 cross-source resolution unit', () => {
  it('merges observations into supporting evidence for one event', () => {
    const observations = [
      baseObservation({ providerId: 'publisher', providerRecordId: 'pub:1' }),
      baseObservation({ providerId: 'registry', providerRecordId: 'reg:1', sourceClass: 'VERIFIED_INSTITUTIONAL_ATTESTATION' }),
    ].map((observation, index) => ({
      ...observation,
      observationId: `heobs_${'a'.repeat(16)}${index}` as never,
    }));
    const resolved = resolveCrossSourceObservations(observations);
    assert.equal(resolved.observationIds.length, 2);
    assert.equal(resolved.canonicalEvent.authoritativeIdCommitments.length, 1);
    assert.equal(resolved.resolutionStatus, 'RESOLVED');
  });
});
