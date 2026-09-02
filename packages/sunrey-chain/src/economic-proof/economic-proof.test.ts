import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  claimCannotAuthorizeIssuance,
  evidenceCannotAuthorizeIssuance,
  humanAndProductiveClaimsAreDistinguishable,
  observationCannotAuthorizeIssuance,
  verifiedFactCannotAuthorizeIssuance,
} from './authority.ts';
import {
  buildHumanEconomicClaim,
  buildProductiveEconomicClaim,
  buildVerifiedFactFromEvidence,
  fromEconomyDataObservation,
  fromOracleVerifiedFact,
} from './adapters.ts';
import { ECONOMIC_OBSERVATION_SCHEMA_VERSION } from './constants.ts';
import {
  fixtureHumanProofPipeline,
  fixtureProductiveProofPipeline,
  malformedClaim,
} from './fixtures.ts';
import { duplicateClaimFingerprint } from './ids.ts';
import { InMemoryEconomicProofPersistence } from './persistence.ts';
import {
  chainCommitmentRepresentation,
  claimCommitment,
  encodeCanonicalEconomicClaim,
  encodeEconomicEvidence,
  encodeEconomicObservation,
  encodeVerifiedEconomicFact,
  evidenceCommitment,
  observationCommitment,
  verifiedFactCommitment,
} from './serialization.ts';
import type { EconomicObservation } from './types.ts';
import {
  assertSupportedSchemaVersion,
  validateCanonicalEconomicClaim,
  validateEconomicEvidence,
  validateEconomicObservation,
  validateVerifiedEconomicFact,
} from './validation.ts';

describe('Wave 3 economic proof domain', () => {
  it('produces deterministic serialization for observations', () => {
    const { observation } = fixtureHumanProofPipeline();
    const first = encodeEconomicObservation(observation);
    const second = encodeEconomicObservation(observation);
    assert.equal(Buffer.compare(first, second), 0);
    assert.equal(observationCommitment(observation), observationCommitment(observation));
  });

  it('produces deterministic serialization for evidence, facts, and claims', () => {
    const human = fixtureHumanProofPipeline();
    const productive = fixtureProductiveProofPipeline();

    assert.equal(Buffer.compare(encodeEconomicEvidence(human.evidence), encodeEconomicEvidence(human.evidence)), 0);
    assert.equal(
      Buffer.compare(encodeVerifiedEconomicFact(human.fact), encodeVerifiedEconomicFact(human.fact)),
      0,
    );
    assert.equal(
      Buffer.compare(encodeCanonicalEconomicClaim(human.claim), encodeCanonicalEconomicClaim(human.claim)),
      0,
    );
    assert.notEqual(evidenceCommitment(human.evidence), evidenceCommitment(productive.evidence));
    assert.notEqual(claimCommitment(human.claim), claimCommitment(productive.claim));
  });

  it('produces deterministic duplicate claim fingerprints', () => {
    const input = {
      economicDomain: 'HUMAN_ECONOMIC',
      claimType: 'HUMAN_CONTRIBUTION',
      canonicalEntityId: 'entity_1',
      canonicalEventId: 'event_1',
      subjectRef: 'subj_1',
      temporalStartUtc: '2026-01-01T00:00:00.000Z',
      temporalEndUtc: '2026-01-01T01:00:00.000Z',
    };
    assert.equal(duplicateClaimFingerprint(input), duplicateClaimFingerprint(input));
    assert.notEqual(
      duplicateClaimFingerprint(input),
      duplicateClaimFingerprint({ ...input, economicDomain: 'PRODUCTIVE_ECONOMIC' }),
    );
  });

  it('keeps human and productive claims distinguishable', () => {
    const human = fixtureHumanProofPipeline().claim;
    const productive = fixtureProductiveProofPipeline().claim;
    assert.equal(human.economicDomain, 'HUMAN_ECONOMIC');
    assert.equal(productive.economicDomain, 'PRODUCTIVE_ECONOMIC');
    assert.ok(humanAndProductiveClaimsAreDistinguishable(human, productive));
    assert.notEqual(human.duplicateFingerprint, productive.duplicateFingerprint);
  });

  it('observation cannot authorize issuance', () => {
    const { observation } = fixtureHumanProofPipeline();
    assert.equal(observationCannotAuthorizeIssuance(observation), null);
    const bad = {
      ...observation,
      authority: { ...observation.authority, mintsNativeAsset: true as const },
    } as EconomicObservation;
    assert.notEqual(observationCannotAuthorizeIssuance(bad), null);
  });

  it('evidence cannot authorize issuance', () => {
    const { evidence } = fixtureHumanProofPipeline();
    assert.equal(evidenceCannotAuthorizeIssuance(evidence), null);
  });

  it('verified fact cannot authorize issuance', () => {
    const { fact } = fixtureHumanProofPipeline();
    assert.equal(verifiedFactCannotAuthorizeIssuance(fact), null);
  });

  it('claim cannot authorize issuance', () => {
    const { claim } = fixtureProductiveProofPipeline();
    assert.equal(claimCannotAuthorizeIssuance(claim), null);
  });

  it('rejects malformed claim', () => {
    const result = validateCanonicalEconomicClaim(malformedClaim());
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(
        ['INVALID_TEMPORAL_RANGE', 'MISSING_REQUIRED_ID', 'MALFORMED_CLAIM'].includes(result.code),
        `unexpected rejection code: ${result.code}`,
      );
    }
  });

  it('rejects unsupported schema version', () => {
    const result = assertSupportedSchemaVersion('observation', 'sunrey.economic-proof.observation.v0');
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'UNSUPPORTED_SCHEMA_VERSION');
    }
  });

  it('chain commitment representation does not require raw payload', () => {
    const { claim } = fixtureHumanProofPipeline();
    const commitment = claimCommitment(claim);
    const representation = chainCommitmentRepresentation({
      objectType: 'claim',
      objectId: claim.economicClaimId,
      schemaVersion: claim.schemaVersion,
      commitment,
      economicDomain: claim.economicDomain,
    });
    assert.equal(representation.rawPayloadRequired, false);
    assert.equal(representation.commitment.length, 64);
  });

  it('validates full human proof pipeline', () => {
    const { observation, evidence, fact, claim } = fixtureHumanProofPipeline();
    assert.equal(validateEconomicObservation(observation).ok, true);
    assert.equal(validateEconomicEvidence(evidence).ok, true);
    assert.equal(validateVerifiedEconomicFact(fact).ok, true);
    assert.equal(validateCanonicalEconomicClaim(claim).ok, true);
  });

  it('persists proof records without becoming a monetary authority', () => {
    const store = new InMemoryEconomicProofPersistence();
    const { observation, evidence, fact, claim } = fixtureProductiveProofPipeline();
    store.observations.putObservation(observation);
    store.evidence.putEvidence(evidence);
    store.verifiedFacts.putVerifiedFact(fact);
    store.claims.putClaim(claim);
    store.sealCommitment({
      kind: 'claim',
      objectId: claim.economicClaimId,
      schemaVersion: claim.schemaVersion,
      commitment: claimCommitment(claim),
      sealedAtUtc: '2026-01-01T01:00:00.000Z',
      economicDomain: claim.economicDomain,
    });
    assert.equal(store.claims.getClaim(claim.economicClaimId)?.economicDomain, 'PRODUCTIVE_ECONOMIC');
    assert.equal(store.vaultSeals.length, 1);
  });

  it('adapts economy-data observation without collapsing domains', () => {
    const { observation: productiveObservation } = fixtureProductiveProofPipeline();
    const adapted = fromEconomyDataObservation(
      {
        schema: 'sunrey.productive.economy-data.v1',
        observationId: 'legacy_obs',
        category: 'COMPUTE',
        resourceId: productiveObservation.resourceRef!,
        metric: productiveObservation.metric,
        value: productiveObservation.quantity.value,
        unit: productiveObservation.quantity.unit,
        canonicalUnit: productiveObservation.quantity.unit,
        canonicalValue: productiveObservation.quantity.value,
        timestampUtc: productiveObservation.observedAtUtc,
        source: 'fixture',
        provider: productiveObservation.providerId,
        provenance: {
          sourceId: 'fixture',
          providerId: productiveObservation.providerId,
          sourceClass: 'SANDBOX_FIXTURE',
          method: 'fixture',
          evidenceRef: productiveObservation.provenanceRef.provenanceId,
          collectedAtUtc: productiveObservation.observedAtUtc,
          license: 'SANDBOX_FIXTURE',
          signatureValid: true,
          configuredDoesNotImplyTrusted: true,
        },
        verification: 'SINGLE_SOURCE_VERIFIED',
        confidenceBps: 9_000n,
        freshness: productiveObservation.freshness,
        license: 'SANDBOX_FIXTURE',
        integrity: 'INTACT',
        status: 'NORMALIZED',
        simulation: true,
        mintsMoonRey: false,
        setsMarketPrice: false,
        unlabeled: false,
      },
      { observationId: 'adapted_obs', economicDomain: 'PRODUCTIVE_ECONOMIC' },
    );
    assert.equal(adapted.schemaVersion, ECONOMIC_OBSERVATION_SCHEMA_VERSION);
    assert.equal(adapted.economicDomain, 'PRODUCTIVE_ECONOMIC');
    assert.equal(adapted.authority.mintsNativeAsset, false);
  });

  it('adapts oracle verified fact into proof lattice', () => {
    const oracleFact = {
      schemaVersion: 1 as const,
      factId: 'oracle_fact_1',
      feedId: 'feed_gpu',
      subject: 'resource_compute_001',
      aggregatedValue: { schemaVersion: 1 as const, mantissa: 100n, scale: 0, unit: 'gpu_s' as const },
      sourceObservationIds: ['obs_1', 'obs_2'],
      aggregationPolicy: 'MEDIAN' as const,
      observationWindow: { startUnix: 1_735_689_600n, endUnix: 1_735_693_200n },
      validUntilUnix: 1_735_696_800n,
      qualityStatus: 'VERIFIED' as const,
      finalizedHeight: 10,
      conflictReason: null,
    };
    const adapted = fromOracleVerifiedFact(oracleFact, {
      verifiedFactId: 'vef_adapted',
      economicDomain: 'PRODUCTIVE_ECONOMIC',
    });
    assert.equal(adapted.economicDomain, 'PRODUCTIVE_ECONOMIC');
    assert.equal(adapted.authority.mintsNativeAsset, false);
    assert.equal(validateVerifiedEconomicFact(adapted).ok, true);
  });

  it('builds claims with distinct human and productive domains', () => {
    const human = buildHumanEconomicClaim({
      economicClaimId: 'cec_h',
      canonicalEntityId: 'ent_h',
      canonicalEventId: 'evt_h',
      subjectRef: 'subj_h',
      supportingFactIds: ['vef_h'],
      evidenceRefs: ['evd_h'],
      temporalBounds: { startUtc: '2026-01-01T00:00:00.000Z', endUtc: '2026-01-01T01:00:00.000Z' },
    });
    const productive = buildProductiveEconomicClaim({
      economicClaimId: 'cec_p',
      canonicalEntityId: 'ent_p',
      canonicalEventId: 'evt_p',
      subjectRef: 'subj_p',
      resourceRef: 'res_p',
      supportingFactIds: ['vef_p'],
      evidenceRefs: ['evd_p'],
      temporalBounds: { startUtc: '2026-01-01T00:00:00.000Z', endUtc: '2026-01-01T01:00:00.000Z' },
    });
    assert.notEqual(human.economicDomain, productive.economicDomain);
    assert.notEqual(human.claimType, productive.claimType);
  });

  it('verified fact built from evidence cannot mint', () => {
    const { evidence } = fixtureHumanProofPipeline();
    const fact = buildVerifiedFactFromEvidence(evidence, {
      verifiedFactId: 'vef_test',
      metric: 'test_metric',
      quantity: { value: 1n, unit: 'event' },
      temporalBounds: { startUtc: '2026-01-01T00:00:00.000Z', endUtc: '2026-01-01T01:00:00.000Z' },
    });
    assert.equal(fact.authority.mintsNativeAsset, false);
    assert.equal(verifiedFactCannotAuthorizeIssuance(fact), null);
  });
});
