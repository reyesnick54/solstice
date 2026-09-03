// @ts-nocheck
/**
 * Wave 6 Human Contribution Resolution — cross-package integration.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  HumanContributionResolutionEngine,
  authoritativeIdCommitmentFrom,
  contentCommitmentFromEvidence,
  deriveActorCommitment,
  humanEconomicIdentityIdFor,
  monetizationReplayKey,
} from '../packages/human-economic-contribution/src/resolution/index.ts';
import { buildHumanEconomicClaim } from '../packages/sunrey-chain/src/economic-proof/adapters.ts';
import { deriveCanonicalEntityId } from '../packages/sunrey-chain/src/economic-proof/entity-identity.ts';
import { deriveCanonicalEventId } from '../packages/sunrey-chain/src/economic-proof/event-identity.ts';
import { replayKeyOf } from '../packages/sunrey-chain/src/economics/human-contribution-bridge/gate.ts';

const NOW = asUtcInstant('2026-09-02T12:00:00.000Z');

describe('Wave 6 human contribution resolution integration', () => {
  it('bridges resolved claim to Wave 3 human economic claim adapter', () => {
    const engine = new HumanContributionResolutionEngine();
    const actor = deriveActorCommitment(['orcid:0000-0002-1825-0097']);
    const identity = humanEconomicIdentityIdFor({ actorCommitment: actor });
    const doi = authoritativeIdCommitmentFrom('doi', '10.1000/wave6-integration');
    for (const [providerId, providerRecordId] of [
      ['pubmed', 'pmid:wave6'],
      ['crossref', 'cr:wave6'],
    ] as const) {
      const submitted = engine.submitObservation({
        sourceClass: 'VERIFIED_RESEARCH_ATTESTATION',
        providerId,
        providerRecordId,
        humanEconomicIdentityId: identity,
        walletBindingRef: null,
        contributionClass: 'RESEARCH_PARTICIPATION',
        authoritativeIdCommitments: [doi],
        contentCommitment: contentCommitmentFromEvidence(['integration-evidence']),
        validFromUtc: NOW,
        validUntilUtc: null,
        measurementQuantity: 1n,
        measurementUnit: 'VERIFIED_RESEARCH_SESSION',
        observedAtUtc: NOW,
      });
      assert.equal(submitted.ok, true);
    }
    const cluster = engine.resolveAll()[0]!;
    const claimResult = engine.generateClaimForCluster(cluster.clusterId, NOW);
    assert.equal(claimResult.ok, true);
    if (!claimResult.ok) {
      return;
    }
    const entityId = deriveCanonicalEntityId({
      economy: 'HUMAN',
      entityKind: 'PERSON',
      entityCommitment: actor,
      jurisdiction: 'GB',
    });
    const eventId = deriveCanonicalEventId({
      canonicalEntityId: entityId,
      economicAction: 'RESEARCH_PARTICIPATION',
      quantity: 1n,
      unit: 'VERIFIED_RESEARCH_SESSION',
      validFromUtc: NOW,
      validUntilUtc: null,
      domainIdentifierCommitment: String(doi),
    });
    const wave3Claim = buildHumanEconomicClaim({
      economicClaimId: `claim-${claimResult.value.claimId}`,
      canonicalEntityId: entityId,
      canonicalEventId: eventId,
      subjectRef: String(identity),
      supportingFactIds: [],
      evidenceRefs: [String(doi)],
      temporalBounds: { startUtc: NOW, endUtc: NOW },
    });
    assert.equal(wave3Claim.claimType, 'HUMAN_CONTRIBUTION');
    assert.ok(wave3Claim.duplicateFingerprint);
    const bridgeReplay = replayKeyOf(String(claimResult.value.resolutionFingerprint), 'auth-wave6');
    const localReplay = monetizationReplayKey(claimResult.value.resolutionFingerprint, 'auth-wave6');
    assert.equal(bridgeReplay, localReplay);
  });
});
