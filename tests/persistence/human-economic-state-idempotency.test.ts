// @ts-nocheck
/**
 * Prompt 5 — durable economic state and idempotency integration tests.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Client } from 'pg';

import { asUtcInstant } from '../../packages/domain/src/time.ts';
import { fixtureContribution } from '../../packages/human-economic-contribution/src/fixtures.ts';
import {
  asMonetizationContextId,
  authoritativeIdCommitmentFrom,
  contentCommitmentFromEvidence,
  deriveActorCommitment,
  humanEconomicIdentityIdFor,
} from '../../packages/human-economic-contribution/src/resolution/index.ts';
import {
  defaultFactsFromRecord,
  evidenceBundleFromRecord,
  withExpectedDigest,
} from '../../packages/human-economic-contribution/src/verification/index.ts';
import { DATABASES, openPersistenceSession } from '../../packages/persistence/src/index.ts';
import { reserveMonetizationKey, withHumanEconomicReservation } from '../../packages/persistence/src/human-economic-contribution/pg-store.ts';
import { createHumanEconomicPersistencePort } from '../../services/accounts/src/human-economic-persistence.ts';
import { DurableHumanEconomicStateService } from '../../services/api/src/product-integration/durable-human-economic-state.ts';
import { persistenceAvailable, preparePersistence } from './helpers.ts';

const describePersistence = persistenceAvailable() ? describe : describe.skip;
const NOW = asUtcInstant('2026-09-02T12:00:00.000Z');
const ACTOR = deriveActorCommitment(['orcid:0000-0002-1825-0097']);
const IDENTITY = humanEconomicIdentityIdFor({ actorCommitment: ACTOR });
const DOI = authoritativeIdCommitmentFrom('doi', '10.1000/idempotency-test');
const CONTEXT = asMonetizationContextId('hctx_0123456789abcdef0123456789abcdef');

function baseObservation(providerId: string, providerRecordId: string) {
  return {
    sourceClass: 'VERIFIED_RESEARCH_ATTESTATION' as const,
    providerId,
    providerRecordId,
    humanEconomicIdentityId: IDENTITY,
    walletBindingRef: null,
    contributionClass: 'RESEARCH_PARTICIPATION' as const,
    authoritativeIdCommitments: [DOI],
    contentCommitment: contentCommitmentFromEvidence(['evidence:idempotency']),
    validFromUtc: NOW,
    validUntilUtc: null,
    measurementQuantity: 1n,
    measurementUnit: 'VERIFIED_RESEARCH_SESSION' as const,
    observedAtUtc: NOW,
  };
}

async function createService(env: Awaited<ReturnType<typeof preparePersistence>>) {
  const session = openPersistenceSession(env);
  const pool = session.pools.customer;
  const persistence = createHumanEconomicPersistencePort(pool);
  const service = await DurableHumanEconomicStateService.create(persistence, { requireDurable: true });
  return {
    session,
    pool,
    persistence,
    service,
    async close() {
      await session.close();
    },
  };
}

async function setupClaim(service: DurableHumanEconomicStateService) {
  for (const [providerId, providerRecordId] of [
    ['pubmed', 'pmid:idempotency-a'],
    ['crossref', 'cr:idempotency-a'],
  ] as const) {
    const submitted = await service.submitObservation(baseObservation(providerId, providerRecordId));
    assert.equal(submitted.ok, true, `${providerId} observation`);
  }
  const cluster = service.resolution.resolveAll()[0]!;
  const claim = service.resolution.generateClaimForCluster(cluster.clusterId, NOW);
  assert.equal(claim.ok, true);
  if (!claim.ok) {
    throw new Error('claim generation failed');
  }
  return claim.value;
}

describePersistence('Human economic state idempotency (Prompt 5)', () => {
  it('TEST 1 — RESTART: duplicate monetization does not occur after service restart', async () => {
    const env = await preparePersistence();
    const ctx = await createService(env);
    try {
      const claim = await setupClaim(ctx.service);
      const monetized = await ctx.service.attemptMonetization({ claimId: claim.claimId, contextId: CONTEXT, now: NOW });
      assert.equal(monetized.ok, true);

      const restarted = await ctx.service.restart();
      const replay = await restarted.attemptMonetization({ claimId: claim.claimId, contextId: CONTEXT, now: NOW });
      assert.equal(replay.ok, false);
      if (!replay.ok) {
        assert.equal(replay.error.code, 'DUPLICATE_MONETIZATION_KEY');
      }
    } finally {
      await ctx.close();
    }
  });

  it('TEST 2 — DUPLICATE REQUEST: same monetization command twice yields one effect', async () => {
    const env = await preparePersistence();
    const ctx = await createService(env);
    try {
      const claim = await setupClaim(ctx.service);
      const first = await ctx.service.attemptMonetization({ claimId: claim.claimId, contextId: CONTEXT, now: NOW });
      const second = await ctx.service.attemptMonetization({ claimId: claim.claimId, contextId: CONTEXT, now: NOW });
      assert.equal(first.ok, true);
      assert.equal(second.ok, false);
      assert.equal(ctx.service.resolution.monetizationStore.listConsumedKeys().length, 1);
    } finally {
      await ctx.close();
    }
  });

  it('TEST 3 — CONCURRENCY: concurrent monetization attempts create exactly one effect', async () => {
    const env = await preparePersistence();
    const setup = await createService(env);
    const session = openPersistenceSession(env);
    try {
      const claim = await setupClaim(setup.service);
      await setup.service.persist();

      const instanceA = await DurableHumanEconomicStateService.create(
        createHumanEconomicPersistencePort(session.pools.customer),
        { requireDurable: true },
      );
      const instanceB = await DurableHumanEconomicStateService.create(
        createHumanEconomicPersistencePort(session.pools.customer),
        { requireDurable: true },
      );
      const results = await Promise.all([
        instanceA.attemptMonetization({ claimId: claim.claimId, contextId: CONTEXT, now: NOW }),
        instanceB.attemptMonetization({ claimId: claim.claimId, contextId: CONTEXT, now: NOW }),
      ]);
      const successes = results.filter((row) => row.ok);
      const failures = results.filter((row) => !row.ok);
      assert.equal(successes.length, 1);
      assert.equal(failures.length, 1);
      if (!failures[0]!.ok) {
        assert.equal(failures[0]!.error.code, 'DUPLICATE_MONETIZATION_KEY');
      }
    } finally {
      await session.close();
      await setup.close();
    }
  });

  it('TEST 4 — MULTI-INSTANCE: two instances cannot independently monetize the same claim', async () => {
    const env = await preparePersistence();
    const setup = await createService(env);
    const session = openPersistenceSession(env);
    try {
      const claim = await setupClaim(setup.service);
      await setup.service.persist();

      const left = await DurableHumanEconomicStateService.create(createHumanEconomicPersistencePort(session.pools.customer), {
        requireDurable: true,
      });
      const right = await DurableHumanEconomicStateService.create(createHumanEconomicPersistencePort(session.pools.customer), {
        requireDurable: true,
      });
      assert.equal(await left.attemptMonetization({ claimId: claim.claimId, contextId: CONTEXT, now: NOW }).then((r) => r.ok), true);
      assert.equal(await right.attemptMonetization({ claimId: claim.claimId, contextId: CONTEXT, now: NOW }).then((r) => r.ok), false);
      const reloaded = await DurableHumanEconomicStateService.create(createHumanEconomicPersistencePort(session.pools.customer), {
        requireDurable: true,
      });
      assert.equal(reloaded.resolution.monetizationStore.listConsumedKeys().length, 1);
    } finally {
      await session.close();
      await setup.close();
    }
  });

  it('TEST 5 — EVENT REPLAY: replaying the same observation is deterministic', async () => {
    const env = await preparePersistence();
    const ctx = await createService(env);
    try {
      const observation = baseObservation('pubmed', 'pmid:replay-once');
      const first = await ctx.service.submitObservation(observation);
      const second = await ctx.service.submitObservation(observation);
      assert.equal(first.ok, true);
      assert.equal(second.ok, false);
      if (!second.ok) {
        assert.equal(second.error.code, 'OBSERVATION_REPLAY');
      }
      const restarted = await ctx.service.restart();
      const third = await restarted.submitObservation(observation);
      assert.equal(third.ok, false);
      assert.equal(restarted.resolution.snapshot().observations.length, 1);
    } finally {
      await ctx.close();
    }
  });

  it('TEST 6 — DATABASE CONSTRAINT: uniqueness enforced when application pre-check is bypassed', async () => {
    const env = await preparePersistence();
    const session = openPersistenceSession(env);
    try {
      const pool = session.pools.customer;

      const reservation = await withHumanEconomicReservation(pool, async (client) => {
        const first = await reserveMonetizationKey(client, 'bypass-key', 'claim-a');
        const second = await reserveMonetizationKey(client, 'bypass-key', 'claim-b');
        return { first, second };
      });
      assert.equal(reservation.first.ok, true);
      assert.equal(reservation.second.ok, false);
      if (!reservation.second.ok) {
        assert.equal(reservation.second.code, 'DUPLICATE_MONETIZATION_KEY');
      }

      const client = new Client({
        host: env.host,
        port: env.port,
        user: env.customerUser,
        password: env.customerPassword,
        database: DATABASES.customer,
      });
      await client.connect();
      try {
        await client.query(
          `INSERT INTO human_contribution.active_fingerprint (fingerprint, contribution_id, reserved_at)
           VALUES ('fp-bypass-test', 'contrib-a', NOW())`,
        );
        await assert.rejects(() =>
          client.query(
            `INSERT INTO human_contribution.active_fingerprint (fingerprint, contribution_id, reserved_at)
             VALUES ('fp-bypass-test', 'contrib-b', NOW())`,
          ),
        );
      } finally {
        await client.end();
      }
    } finally {
      await session.close();
    }
  });

  it('TEST 7 — FAILURE/RETRY: retry after partial failure does not duplicate contribution fingerprint', async () => {
    const env = await preparePersistence();
    const ctx = await createService(env);
    try {
      const input = fixtureContribution('RESEARCH_PARTICIPATION', 'retry-boundary');
      const first = await ctx.service.submitContribution(input);
      assert.equal(first.ok, true);
      const retry = await ctx.service.submitContribution(input);
      assert.equal(retry.ok, true);
      if (first.ok && retry.ok) {
        assert.equal(first.value.contributionId, retry.value.contributionId);
      }
      const duplicate = await ctx.service.submitContribution({
        ...fixtureContribution('RESEARCH_PARTICIPATION', 'retry-boundary'),
        createdAt: asUtcInstant('2026-09-02T12:00:01.000Z'),
        eventReference: input.eventReference,
        evidenceReferences: input.evidenceReferences,
        consentReferences: input.consentReferences,
        purposeReferences: input.purposeReferences,
        rightsReferences: input.rightsReferences,
        provenanceReferences: input.provenanceReferences,
        attestationReferences: input.attestationReferences,
      });
      assert.equal(duplicate.ok, false);
      if (!duplicate.ok) {
        assert.equal(duplicate.error.code, 'DUPLICATE_FINGERPRINT');
      }
    } finally {
      await ctx.close();
    }
  });

  it('verified contribution fingerprint remains unique across verify retry', async () => {
    const env = await preparePersistence();
    const ctx = await createService(env);
    try {
      const input = fixtureContribution('RESEARCH_PARTICIPATION', 'verify-retry');
      const submitted = await ctx.service.submitContribution(input);
      assert.equal(submitted.ok, true);
      if (!submitted.ok) {
        return;
      }
      const record = submitted.value;
      const bundle = evidenceBundleFromRecord(record);
      const facts = withExpectedDigest(
        defaultFactsFromRecord(record, NOW, { activeDuplicateFingerprint: false }),
        bundle.evidenceDigest,
      );
      const verified = await ctx.service.verifyContribution({
        contributionId: record.contributionId,
        verificationTimestamp: NOW,
        facts,
      });
      assert.equal(verified.ok, true);
      const retry = await ctx.service.verifyContribution({
        contributionId: record.contributionId,
        verificationTimestamp: NOW,
        facts,
      });
      assert.equal(retry.ok, true);
      if (verified.ok && retry.ok) {
        assert.equal(verified.value.contributionId, retry.value.contributionId);
      }
    } finally {
      await ctx.close();
    }
  });
});
