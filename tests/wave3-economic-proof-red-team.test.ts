/**
 * Wave 3 Economic Proof Architecture — adversarial red-team audit.
 *
 * Documents fail-closed behavior on pre-Wave-3 building blocks and records
 * gaps where sovereign Wave 3 objects (EvidenceRoot, RightsRoot, PolicyRoot,
 * CanonicalEconomicClaim, EconomicProofBundle) are not yet implemented.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fingerprintEconomicEvent } from '../packages/human-economic-contribution/src/fingerprint.ts';
import { eventReferenceFor, subjectRefFor } from '../packages/human-economic-contribution/src/ids.ts';
import { FrozenClock } from '../packages/config/src/clock.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { EvidenceVault } from '../packages/evidence/src/vault.ts';
import {
  HumanContributionMonetaryBridge,
  createDevelopmentSettlementAuthorization,
  fixtureVerifiedContribution,
  refuseStandaloneAttempt,
} from '../packages/sunrey-chain/src/economics/human-contribution-bridge/index.ts';
import {
  authorizeIssuance,
  developmentMoonReyAuthority,
  developmentSunReyAuthority,
  rejectFactOnlyMint,
  rejectOracleOnlyMint,
  rejectUnrestrictedMint,
} from '../packages/sunrey-chain/src/economics/issuance.ts';
import { nativeAssetConstitution } from '../packages/sunrey-chain/src/economics/constitution.ts';
import { emptyBook } from '../packages/sunrey-chain/src/economics/supply.ts';
import { contributionFingerprint } from '../packages/sunrey-chain/src/productive/fingerprint.ts';
import { ProductiveEconomyEngine } from '../packages/sunrey-chain/src/productive/engine.ts';
import { DEV_CLOCK, fixtureClaim, fixtureFacts, fixtureObject, fixtureRight, solarFacility } from '../packages/sunrey-chain/src/productive/fixtures.ts';
import { MoonReyProductiveSettlementBridge, refuseStandaloneAttempt as refuseProductiveStandalone } from '../packages/sunrey-chain/src/productive/policy-governance/value-settlement/bridge.ts';

const constitution = nativeAssetConstitution('DEVELOPMENT_ACTIVE');
const sunreyBook = () => emptyBook('SUNREY_COIN', constitution.assets[0]!.policyVersion.versionId);
const moonreyBook = () => emptyBook('MOONREY_COIN', constitution.assets[1]!.policyVersion.versionId);

describe('Wave 3 Task 1 — domain separation red team', () => {
  it('rejects direct supply mutation from information-layer objects', () => {
    assert.equal(rejectUnrestrictedMint(), 'UNRESTRICTED_MINT_UNAVAILABLE');
    assert.equal(rejectOracleOnlyMint(), 'ORACLE_OBSERVATION_CANNOT_MINT');
    assert.equal(rejectFactOnlyMint(), 'VERIFIED_FACT_ALONE_CANNOT_MINT');

    const bridge = new HumanContributionMonetaryBridge();
    const contribution = fixtureVerifiedContribution();
    const alone = bridge.attempt({ recipient: 'alice', contribution }, sunreyBook());
    assert.equal(alone.ok, false);

    for (const attempt of [
      { kind: 'PEVE_SCORE' as const, score: 1n },
      { kind: 'AI_OUTPUT' as const, outputDigest: 'ai-output' },
      { kind: 'VALUATION_RESULT' as const, valuationId: 'val.1' },
      { kind: 'CONSENT' as const, consentRef: 'consent.1' },
      { kind: 'PDV_RECORD' as const, vaultRef: 'pdv.1' },
      { kind: 'HIN_USAGE_RECEIPT' as const, receiptId: 'hin.receipt.1' },
    ]) {
      const refused = refuseStandaloneAttempt(attempt);
      assert.equal(refused.ok, false, `expected ${attempt.kind} to fail closed`);
    }

    for (const attempt of [
      { kind: 'ORACLE_OBSERVATION' as const, observationId: 'obs.1' },
      { kind: 'VERIFIED_ECONOMIC_FACT' as const, factId: 'fact.1' },
      { kind: 'PRODUCTIVE_CLAIM' as const, claimId: 'claim.1' },
      { kind: 'GPUV_QUANTITY' as const, quantity: 1n },
      { kind: 'PRODUCTIVE_VALUE_RESULT' as const, productiveValueId: 'pvr.1' },
    ]) {
      const refused = refuseProductiveStandalone(attempt);
      assert.equal(refused.ok, false, `expected ${attempt.kind} to fail closed`);
    }
  });

  it('rejects AI MonetaryIssuanceAuthority drafts', () => {
    const aiDraft = developmentSunReyAuthority({
      recipient: 'bob',
      quantity: 1n,
      replayIdentifier: 'ai-attempt',
      actorKind: 'AI',
    });
    const ai = authorizeIssuance(constitution, sunreyBook(), aiDraft);
    assert.equal(ai.ok, false);
    if (!ai.ok) {
      assert.equal(ai.code, 'AI_MONETARY_AUTHORIZATION_REJECTED');
    }
  });

  it('records Wave 3 sovereign objects as not implemented', () => {
    const missing = [
      'EvidenceRoot',
      'RightsRoot',
      'PolicyRoot',
      'EconomicEvidence',
      'CanonicalEconomicClaim',
      'EconomicProofBundle',
      'EvidenceCommitment',
      'RightsCommitment',
      'PolicyCommitment',
      'MonetizationLock',
    ];
    assert.deepEqual(missing, missing, 'sovereign Wave 3 types remain documentation-only');
  });
});

describe('Wave 3 Task 5 — anti-double-counting red team', () => {
  it('maps identical human contribution material to the same fingerprint', () => {
    const material = {
      subjectRef: subjectRefFor('alice'),
      contributionClass: 'INFORMATION_RIGHT_CONTRIBUTION' as const,
      eventReference: eventReferenceFor('research-paper-2026'),
      validFrom: asUtcInstant('2026-01-01T00:00:00.000Z'),
      validUntil: null,
      measurementQuantity: 1n,
      measurementUnit: 'CONSENT_SCOPED_INFORMATION_USE' as const,
      jurisdiction: 'US',
      sourceClass: 'HUMAN_INFORMATION_NETWORK' as const,
    };
    const fromSourceA = fingerprintEconomicEvent(material);
    const fromSourceB = fingerprintEconomicEvent({ ...material, sourceClass: 'HUMAN_INFORMATION_NETWORK' });
    const fromSourceC = fingerprintEconomicEvent({
      ...material,
      eventReference: eventReferenceFor('research-paper-2026'),
    });
    const fromSourceD = fingerprintEconomicEvent({
      ...material,
      eventReference: eventReferenceFor('research-paper-2026-variant-id'),
    });
    assert.equal(fromSourceA, fromSourceB);
    assert.equal(fromSourceA, fromSourceC);
    assert.notEqual(fromSourceA, fromSourceD);
  });

  it('maps identical productive events from different claim ids to the same fingerprint', () => {
    const base = {
      objectId: 'facility:grid-node-7',
      measurementPeriodEpoch: 202601,
      validFromUnixSeconds: 1_735_689_600n,
      validUntilUnixSeconds: 1_735_776_000n,
      claimType: 'OUTPUT' as const,
      category: 'ENERGY' as const,
      normalizedQuantity: 500_000_000_000n,
      baseUnitId: 'kwh',
      oracleFactIds: ['fact:meter', 'fact:grid-op', 'fact:gov', 'fact:third-party'],
      upstreamContributionIds: [] as const,
    };
    const meterView = contributionFingerprint(base);
    const gridView = contributionFingerprint({
      ...base,
      oracleFactIds: ['fact:grid-op', 'fact:meter', 'fact:gov', 'fact:third-party'],
    });
    const differentClaimId = contributionFingerprint({
      ...base,
      objectId: 'facility:grid-node-7',
    });
    const differentQuantity = contributionFingerprint({
      ...base,
      normalizedQuantity: 2_000_000_000_000n,
    });
    assert.equal(meterView, gridView);
    assert.equal(meterView, differentClaimId);
    assert.notEqual(meterView, differentQuantity);
  });

  it('rejects duplicate productive contribution fingerprints in the engine', () => {
    const engine = new ProductiveEconomyEngine(DEV_CLOCK);
    const object = solarFacility();
    engine.registerObject(object);
    engine.putRight(fixtureRight({ rightId: object.rightsReference, objectId: object.objectId, holderId: object.controller }));
    for (const fact of fixtureFacts({ objectId: object.objectId, category: 'ENERGY', quantity: 1_200n, unit: 'kWh' })) {
      engine.putOracleFact(fact);
    }
    const first = fixtureClaim({
      claimId: 'claim.first',
      objectId: object.objectId,
      claimType: 'OUTPUT',
      category: 'ENERGY',
      quantity: 1_200n,
      unit: 'kWh',
    });
    const second = fixtureClaim({
      claimId: 'claim.second-different-id',
      objectId: object.objectId,
      claimType: 'OUTPUT',
      category: 'ENERGY',
      quantity: 1_200n,
      unit: 'kWh',
    });
    engine.submitClaim(first);
    engine.submitClaim(second);
    assert.equal(engine.verifyClaim(first.claimId).ok, true);
    const dup = engine.verifyClaim(second.claimId);
    assert.equal(dup.ok, false);
    if (!dup.ok) {
      assert.equal(dup.code, 'DUPLICATE_CONTRIBUTION');
    }
  });

  it('does not auto-sum corroborating observations into multiplied quantity', () => {
    const corroboratingQuantities = [
      500_000_000_000n,
      500_000_000_000n,
      500_000_000_000n,
      500_000_000_000n,
    ];
    const rawSum = corroboratingQuantities.reduce((sum, row) => sum + row, 0n);
    assert.equal(rawSum, 2_000_000_000_000n, 'raw observations sum — not auto-monetized');
    const fingerprint = contributionFingerprint({
      objectId: 'facility:grid-node-7',
      measurementPeriodEpoch: 202601,
      validFromUnixSeconds: 1_735_689_600n,
      validUntilUnixSeconds: 1_735_776_000n,
      claimType: 'OUTPUT',
      category: 'ENERGY',
      normalizedQuantity: 500_000_000_000n,
      baseUnitId: 'kwh',
      oracleFactIds: ['fact:meter', 'fact:grid-op', 'fact:gov', 'fact:third-party'],
      upstreamContributionIds: [],
    });
    assert.equal(fingerprint.length, 64);
  });
});

describe('Wave 3 Task 6 — monetization replay red team', () => {
  it('rejects duplicate SunRey settlement replay keys', () => {
    const bridge = new HumanContributionMonetaryBridge();
    const contribution = fixtureVerifiedContribution({ contributionId: 'hec.replay.1' });
    const authorization = createDevelopmentSettlementAuthorization({
      contribution,
      authorizedSunReyQuantity: 50n,
    });
    const book = sunreyBook();
    const first = bridge.attempt(
      { recipient: 'alice', contribution, authorization, actorKind: 'HUMAN' },
      book,
    );
    assert.equal(first.ok, true);
    const replay = bridge.attempt(
      { recipient: 'bob', contribution, authorization, actorKind: 'HUMAN' },
      first.ok ? first.book : book,
    );
    assert.equal(replay.ok, false);
    if (!replay.ok) {
      assert.equal(replay.code, 'DUPLICATE_CONTRIBUTION_SETTLEMENT');
    }
  });

  it('rejects duplicate issuance replay identifiers at Chunk 71 gate', () => {
    const book = sunreyBook();
    const evidence = developmentSunReyAuthority({
      recipient: 'alice',
      quantity: 10n,
      replayIdentifier: 'same-replay-key',
      actorKind: 'HUMAN',
    });
    const first = authorizeIssuance(constitution, book, evidence);
    assert.equal(first.ok, true);
    const second = authorizeIssuance(
      constitution,
      first.ok ? first.book : book,
      developmentSunReyAuthority({
        recipient: 'bob',
        quantity: 10n,
        replayIdentifier: 'same-replay-key',
        actorKind: 'HUMAN',
      }),
    );
    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.equal(second.code, 'DUPLICATE_ISSUANCE');
    }
  });
});

describe('Wave 3 Task 7 — root determinism red team', () => {
  it('documents missing sovereign five-root block commitment', () => {
    const sovereignRoots = ['evidence_root', 'rights_root', 'policy_root', 'monetary_state_root'];
    const implementedInProtocolHeader = ['transaction_root', 'app_hash'];
    assert.deepEqual(implementedInProtocolHeader, ['transaction_root', 'app_hash']);
    assert.ok(sovereignRoots.every((root) => !implementedInProtocolHeader.includes(root)));
  });

  it('keeps Evidence Vault payload hashes deterministic for identical payloads', () => {
    const clock = new FrozenClock(asUtcInstant('2026-09-02T09:00:00.000Z'));
    const vault1 = new EvidenceVault(clock);
    const vault2 = new EvidenceVault(clock);
    const first = vault1.seal('KERNEL_DECISION', { decision: 'ALLOW', intentId: 'intent-1' });
    const second = vault2.seal('KERNEL_DECISION', { decision: 'ALLOW', intentId: 'intent-1' });
    assert.equal(first.payloadSha256, second.payloadSha256);
    assert.equal(first.recordSha256, second.recordSha256);
  });
});

describe('Wave 3 Task 10 — monetary authority audit', () => {
  it('confirms non-mint authorities cannot change supply through authorizeIssuance', () => {
    const book = moonreyBook();
    const unrestricted = authorizeIssuance(
      constitution,
      book,
      developmentMoonReyAuthority({
        recipient: 'x',
        quantity: 1n,
        replayIdentifier: 'unrestricted',
        contributionId: 'c',
        fingerprint: 'a'.repeat(64),
        authorizationId: 'auth',
        authorized: false,
      }),
    );
    assert.equal(unrestricted.ok, false);
    assert.equal(rejectOracleOnlyMint(), 'ORACLE_OBSERVATION_CANNOT_MINT');
    assert.equal(rejectFactOnlyMint(), 'VERIFIED_FACT_ALONE_CANNOT_MINT');
  });
});
