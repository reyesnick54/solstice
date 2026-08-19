import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { nativeAssetConstitution } from './constitution.ts';
import {
  AI_AUTHORIZED,
  HumanContributionMonetaryBridge,
  PEVE_USED_AS_TOKEN_FORMULA,
  PRODUCTION_ACTIVATED,
  PURPOSE_CLASS_MAPPING_IS_ISSUANCE_AUTHORIZATION,
  RAW_PERSONAL_DATA,
  VALUATION_ENGINE_IMPLEMENTED,
  createDevelopmentSettlementAuthorization,
  fixtureUnverifiedContribution,
  fixtureVerifiedContribution,
  mapContributionClassToPurposeClass,
  refuseStandaloneAttempt,
  toHumanEconomicEvidence,
  toMonetaryEvidenceCandidate,
} from './human-contribution-bridge/index.ts';
import { authorizeIssuance, developmentMoonReyAuthority } from './issuance.ts';
import { emptyBook, expectedTotal, observedTotal, supplyReconciles } from './supply.ts';

const BRIDGE_DIR = dirname(fileURLToPath(import.meta.url));

function book() {
  const constitution = nativeAssetConstitution('DEVELOPMENT_ACTIVE');
  return emptyBook('SUNREY_COIN', constitution.assets[0]!.policyVersion.versionId);
}

describe('Chunk 108 human contribution monetary bridge', () => {
  it('refuses issuance from a verified contribution alone', () => {
    const bridge = new HumanContributionMonetaryBridge();
    const contribution = fixtureVerifiedContribution();
    const candidate = toMonetaryEvidenceCandidate(contribution);
    assert.equal(candidate.ok, true);
    if (candidate.ok) {
      assert.equal(candidate.candidate.mappingIsIssuanceAuthorization, false);
      assert.equal(candidate.candidate.quantityBasis, null);
    }
    const result = bridge.attempt({ recipient: 'alice', contribution }, book());
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'SETTLEMENT_AUTHORIZATION_REQUIRED');
    }
  });

  it('produces privacy-safe HumanEconomicEvidence and simulation issuance with a fixture authorization', () => {
    const bridge = new HumanContributionMonetaryBridge();
    const contribution = fixtureVerifiedContribution({
      contributionId: 'hec.ok.1',
      contributionClass: 'INFORMATION_RIGHT_CONTRIBUTION',
    });
    const authorization = createDevelopmentSettlementAuthorization({
      contribution,
      authorizedSunReyQuantity: 75n,
    });
    const evidence = toHumanEconomicEvidence(contribution, authorization);
    if (!evidence.ok) {
      throw new Error(evidence.code);
    }
    assert.equal(evidence.evidence.containsRawPersonalData, false);
    assert.equal(evidence.evidence.pdvSourceExposed, false);
    assert.equal(evidence.evidence.cleanRoomSourceExposed, false);
    assert.equal(evidence.evidence.contributionId, 'hec.ok.1');
    assert.equal(evidence.evidence.fingerprint, contribution.fingerprint);
    assert.equal(evidence.evidence.purposeClass, 'CONSENT_SCOPED_INFORMATION_RIGHT_SETTLEMENT');
    assert.equal(evidence.evidence.settlementAuthorizationRef, authorization.authorizationId);
    const issued = bridge.attempt(
      { recipient: 'alice', contribution, authorization, actorKind: 'HUMAN' },
      book(),
    );
    if (!issued.ok) {
      throw new Error(issued.code);
    }
    assert.equal(issued.authority.issuanceClass, 'AUTHORIZED_HUMAN_ECONOMIC_CONTRIBUTION');
    assert.equal(issued.book.issuedPostGenesis, 75n);
    assert.equal(supplyReconciles(issued.book), true);
  });

  it('refuses an invalid or unverified contribution', () => {
    const bridge = new HumanContributionMonetaryBridge();
    const unverified = fixtureUnverifiedContribution();
    const authorization = createDevelopmentSettlementAuthorization({
      contribution: { ...unverified, verificationState: 'VERIFIED' },
      authorizedSunReyQuantity: 10n,
    });
    const result = bridge.attempt(
      { recipient: 'alice', contribution: unverified, authorization },
      book(),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'INVALID_CONTRIBUTION');
    }
  });

  it('refuses duplicate contribution settlement', () => {
    const bridge = new HumanContributionMonetaryBridge();
    const contribution = fixtureVerifiedContribution({ contributionId: 'hec.dup.1' });
    const authorization = createDevelopmentSettlementAuthorization({
      contribution,
      authorizedSunReyQuantity: 20n,
    });
    const first = bridge.attempt({ recipient: 'alice', contribution, authorization }, book());
    if (!first.ok) {
      throw new Error(first.code);
    }
    const replay = bridge.attempt({ recipient: 'alice', contribution, authorization }, first.book);
    assert.equal(replay.ok, false);
    if (!replay.ok) {
      assert.equal(replay.code, 'DUPLICATE_CONTRIBUTION_SETTLEMENT');
    }
  });

  it('refuses HIN consent, usage receipt, and clean-room result alone', () => {
    const bridge = new HumanContributionMonetaryBridge();
    const consent = bridge.attempt(
      { recipient: 'alice', standalone: { kind: 'HIN_CONSENT', consentRef: 'hin.consent.1' } },
      book(),
    );
    assert.equal(consent.ok, false);
    if (!consent.ok) {
      assert.equal(consent.code, 'HIN_CONSENT_ALONE_CANNOT_ISSUE');
    }
    const receipt = refuseStandaloneAttempt({ kind: 'HIN_USAGE_RECEIPT', receiptId: 'hin.receipt.1' });
    assert.equal(receipt.code, 'HIN_USAGE_RECEIPT_ALONE_CANNOT_ISSUE');
    const cleanRoom = refuseStandaloneAttempt({ kind: 'CLEAN_ROOM_RESULT', resultId: 'cr.result.1' });
    assert.equal(cleanRoom.code, 'CLEAN_ROOM_RESULT_ALONE_CANNOT_ISSUE');
    const genericConsent = refuseStandaloneAttempt({ kind: 'CONSENT', consentRef: 'consent.1' });
    assert.equal(genericConsent.code, 'CONSENT_ALONE_CANNOT_ISSUE');
  });

  it('refuses a PEVE composite score as SunRey quantity', () => {
    const bridge = new HumanContributionMonetaryBridge();
    const peve = bridge.attempt(
      { recipient: 'alice', standalone: { kind: 'PEVE_SCORE', score: 99n } },
      book(),
    );
    assert.equal(peve.ok, false);
    if (!peve.ok) {
      assert.equal(peve.code, 'PEVE_SCORE_CANNOT_BECOME_ISSUANCE_QUANTITY');
    }
    const contribution = fixtureVerifiedContribution({ contributionId: 'hec.peve.1' });
    const authorization = createDevelopmentSettlementAuthorization({
      contribution,
      authorizedSunReyQuantity: 99n,
    });
    const poisoned = bridge.attempt(
      {
        recipient: 'alice',
        contribution,
        authorization,
        extra: { peveComposite: 99n },
      },
      book(),
    );
    assert.equal(poisoned.ok, false);
    if (!poisoned.ok) {
      assert.equal(poisoned.code, 'PEVE_SCORE_CANNOT_BECOME_ISSUANCE_QUANTITY');
    }
    assert.equal(PEVE_USED_AS_TOKEN_FORMULA, false);
  });

  it('refuses AI and Financial Agent authorization', () => {
    const bridge = new HumanContributionMonetaryBridge();
    const contribution = fixtureVerifiedContribution({ contributionId: 'hec.ai.1' });
    const authorization = createDevelopmentSettlementAuthorization({
      contribution,
      authorizedSunReyQuantity: 5n,
    });
    const ai = bridge.attempt(
      { recipient: 'alice', contribution, authorization, actorKind: 'AI' },
      book(),
    );
    assert.equal(ai.ok, false);
    if (!ai.ok) {
      assert.equal(ai.code, 'AI_CANNOT_AUTHORIZE_ISSUANCE');
    }
    const agent = bridge.attempt(
      { recipient: 'alice', contribution, authorization, actorKind: 'FINANCIAL_AGENT' },
      book(),
    );
    assert.equal(agent.ok, false);
    if (!agent.ok) {
      assert.equal(agent.code, 'FINANCIAL_AGENT_CANNOT_AUTHORIZE_ISSUANCE');
    }
    assert.equal(refuseStandaloneAttempt({ kind: 'AI_OUTPUT', outputDigest: 'abc' }).code, 'AI_CANNOT_AUTHORIZE_ISSUANCE');
    assert.equal(AI_AUTHORIZED, false);
  });

  it('rejects raw personal data and protected-trait valuation', () => {
    const bridge = new HumanContributionMonetaryBridge();
    const contribution = fixtureVerifiedContribution({ contributionId: 'hec.pii.1' });
    const authorization = createDevelopmentSettlementAuthorization({
      contribution,
      authorizedSunReyQuantity: 3n,
    });
    const raw = bridge.attempt(
      { recipient: 'alice', contribution, authorization, extra: { name: 'Ada Lovelace' } },
      book(),
    );
    assert.equal(raw.ok, false);
    if (!raw.ok) {
      assert.equal(raw.code, 'RAW_PERSONAL_DATA_REJECTED');
    }
    const trait = bridge.attempt(
      { recipient: 'alice', contribution, authorization, extra: { race: 'forbidden' } },
      book(),
    );
    assert.equal(trait.ok, false);
    if (!trait.ok) {
      assert.equal(trait.code, 'PROTECTED_TRAIT_VALUATION_REJECTED');
    }
    const worth = bridge.attempt(
      { recipient: 'alice', contribution, authorization, extra: { humanWorthScore: 1 } },
      book(),
    );
    assert.equal(worth.ok, false);
    if (!worth.ok) {
      assert.equal(worth.code, 'HUMAN_WORTH_SCORE_REJECTED');
    }
    assert.equal(RAW_PERSONAL_DATA, false);
  });

  it('requires explicit correction handling for a superseded contribution', () => {
    const bridge = new HumanContributionMonetaryBridge();
    const original = fixtureVerifiedContribution({ contributionId: 'hec.orig.1' });
    const firstAuth = createDevelopmentSettlementAuthorization({
      contribution: original,
      authorizedSunReyQuantity: 50n,
      authorizationId: 'hcesa.orig.1',
    });
    const first = bridge.attempt({ recipient: 'alice', contribution: original, authorization: firstAuth }, book());
    if (!first.ok) {
      throw new Error(first.code);
    }
    const superseded = fixtureVerifiedContribution({
      contributionId: 'hec.orig.1.corr',
      fingerprint: original.fingerprint,
      verificationState: 'SUPERSEDED',
      supersededContributionId: original.contributionId,
    });
    const silent = createDevelopmentSettlementAuthorization({
      contribution: superseded,
      authorizedSunReyQuantity: 50n,
      authorizationId: 'hcesa.orig.1',
    });
    const silentResult = bridge.attempt(
      { recipient: 'alice', contribution: superseded, authorization: silent },
      first.book,
    );
    assert.equal(silentResult.ok, false);
    if (!silentResult.ok) {
      assert.ok(
        silentResult.code === 'SUPERSESSION_REQUIRES_EXPLICIT_ADJUSTMENT' ||
          silentResult.code === 'DUPLICATE_CONTRIBUTION_SETTLEMENT' ||
          silentResult.code === 'SILENT_REMINT_FORBIDDEN',
      );
    }
    const adjustmentAuth = createDevelopmentSettlementAuthorization({
      contribution: superseded,
      authorizedSunReyQuantity: 8n,
      authorizationId: 'hcesa.adj.1',
    });
    const adjusted = bridge.attempt(
      {
        recipient: 'alice',
        contribution: superseded,
        authorization: adjustmentAuth,
        correction: {
          kind: 'EXPLICIT_ADJUSTMENT',
          priorContributionId: original.contributionId,
          priorAuthorizationId: firstAuth.authorizationId,
          supersededContributionId: superseded.contributionId,
          adjustmentQuantity: 8n,
          adjustmentAuthorizationId: adjustmentAuth.authorizationId,
          clawbackForbidden: true,
        },
      },
      first.book,
    );
    if (!adjusted.ok) {
      throw new Error(adjusted.code);
    }
    assert.equal(adjusted.book.issuedPostGenesis, 58n);
    const clawback = bridge.attempt(
      {
        recipient: 'alice',
        contribution: superseded,
        authorization: createDevelopmentSettlementAuthorization({
          contribution: superseded,
          authorizedSunReyQuantity: 1n,
          authorizationId: 'hcesa.claw.1',
        }),
        correction: {
          kind: 'EXPLICIT_ADJUSTMENT',
          priorContributionId: original.contributionId,
          priorAuthorizationId: firstAuth.authorizationId,
          supersededContributionId: superseded.contributionId,
          adjustmentQuantity: 0n,
          adjustmentAuthorizationId: 'hcesa.claw.1',
          clawbackForbidden: true,
        },
      },
      adjusted.book,
    );
    assert.equal(clawback.ok, false);
    if (!clawback.ok) {
      assert.equal(clawback.code, 'CLAWBACK_UNAVAILABLE');
    }
  });

  it('keeps production issuance unavailable and does not implement a valuation formula', () => {
    assert.equal(PRODUCTION_ACTIVATED, false);
    assert.equal(VALUATION_ENGINE_IMPLEMENTED, false);
    assert.equal(PURPOSE_CLASS_MAPPING_IS_ISSUANCE_AUTHORIZATION, false);
    const constitution = nativeAssetConstitution('PRODUCTION_CANDIDATE');
    assert.equal(constitution.assets[0]?.supplyConstraints.productionIssuanceActivated, false);
    const bridge = new HumanContributionMonetaryBridge({ constitution });
    const contribution = fixtureVerifiedContribution({ contributionId: 'hec.prod.1' });
    const authorization = createDevelopmentSettlementAuthorization({
      contribution,
      authorizedSunReyQuantity: 1n,
    });
    const result = bridge.attempt({ recipient: 'alice', contribution, authorization }, book());
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'PRODUCTION_ISSUANCE_UNCONFIGURED');
    }
  });

  it('reconciles SunRey supply and leaves the MoonRey issuance path unaffected', () => {
    const constitution = nativeAssetConstitution('DEVELOPMENT_ACTIVE');
    const bridge = new HumanContributionMonetaryBridge({ constitution });
    const contribution = fixtureVerifiedContribution({
      contributionId: 'hec.supply.1',
      contributionClass: 'GOVERNED_PARTICIPATION_EVENT',
    });
    assert.equal(mapContributionClassToPurposeClass('GOVERNED_PARTICIPATION_EVENT'), 'AUTHORIZED_ECONOMIC_PARTICIPATION_EVENT');
    const authorization = createDevelopmentSettlementAuthorization({
      contribution,
      authorizedSunReyQuantity: 30n,
    });
    const issued = bridge.attempt({ recipient: 'alice', contribution, authorization }, book());
    if (!issued.ok) {
      throw new Error(issued.code);
    }
    assert.equal(supplyReconciles(issued.book), true);
    assert.equal(expectedTotal(issued.book), observedTotal(issued.book));
    const moonrey = authorizeIssuance(
      constitution,
      emptyBook('MOONREY_COIN', constitution.assets[1]!.policyVersion.versionId),
      developmentMoonReyAuthority({
        quantity: 12n,
        replayIdentifier: 'moonrey.unaffected.108',
        contributionId: 'moon.1',
        fingerprint: 'moon.fp.1',
        authorizationId: 'moon.auth.1',
      }),
    );
    assert.equal(moonrey.ok, true);
    if (moonrey.ok) {
      assert.equal(moonrey.book.issuedPostGenesis, 12n);
      assert.equal(issued.book.issuedPostGenesis, 30n);
    }
  });

  it('does not import PEVE formula logic into the monetary bridge', () => {
    const files = [
      'human-contribution-bridge/types.ts',
      'human-contribution-bridge/mapping.ts',
      'human-contribution-bridge/firewall.ts',
      'human-contribution-bridge/authorization.ts',
      'human-contribution-bridge/evidence.ts',
      'human-contribution-bridge/gate.ts',
      'human-contribution-bridge/fixtures.ts',
      'human-contribution-bridge/adapter.ts',
      'human-contribution-bridge/conversion.ts',
      'human-contribution-bridge/index.ts',
    ];
    for (const rel of files) {
      const source = readFileSync(join(BRIDGE_DIR, rel), 'utf8');
      assert.equal(source.includes('packages/platform'), false, rel);
      assert.equal(/from ['"].*\/value\//.test(source), false, rel);
      assert.equal(source.includes('PersonalEconomicValueEngine'), false, rel);
      assert.equal(source.includes('computePeve'), false, rel);
    }
  });
});
