import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../domain/src/time.ts';
import { InMemoryCaseManagementPort } from '../../kernel/src/regulated/case-management.ts';
import { digitalAssetInstrument, informationRightInstrument } from './instruments.ts';
import {
  engageExchangeKillSwitch,
  evaluateHirPrivacy,
  evaluateMarketAccess,
  evaluateProductionListing,
  evaluateRegulatedMarketReadiness,
  exportSurveillanceCases,
  familyInheritsRegulatoryStatus,
  rawPdvExportAvailable,
  readinessForCapability,
  unlicensedActivationRemainsIncomplete,
} from './regulated/index.ts';

const NOW = asUtcInstant('2026-08-17T11:00:00.000Z');

describe('market access and families', () => {
  it('evaluates access without inheriting another family regulatory status', () => {
    const digital = evaluateMarketAccess({
      identityClass: 'RETAIL',
      jurisdiction: 'GB',
      marketFamily: 'DIGITAL_ASSET',
      complianceState: 'CLEAR',
      professionalStatus: false,
      institutionalStatus: false,
      consentReady: false,
      rightsReady: false,
      listingAllowed: true,
      riskRestricted: false,
    });
    assert.equal(digital.allowed, true);
    assert.equal(digital.inheritedFamilyStatus, false);
    const hir = evaluateMarketAccess({
      identityClass: 'RETAIL',
      jurisdiction: 'GB',
      marketFamily: 'HUMAN_INFORMATION_RIGHT',
      complianceState: 'CLEAR',
      professionalStatus: false,
      institutionalStatus: false,
      consentReady: false,
      rightsReady: false,
      listingAllowed: true,
      riskRestricted: false,
    });
    assert.equal(hir.allowed, false);
    assert.ok(hir.reasonCodes.includes('HIR_PRIVACY_DEFAULT_DENY'));
    assert.equal(familyInheritsRegulatoryStatus(), false);
  });
});

describe('listing governance and HIR privacy', () => {
  it('rejects AI listing authorization and keeps raw PDV unavailable', () => {
    const instrument = digitalAssetInstrument({
      instrumentId: 'inst_sunrey_sim',
      nativeAssetId: 'asset_sunrey_coin_native',
      issuer: 'sim',
      settlementAssets: ['asset_sunrey_coin_native'],
    });
    const ai = evaluateProductionListing({
      instrument,
      riskAssessment: true,
      securityReview: true,
      legalRegulatoryEvidence: true,
      authorizedBy: 'AI',
    });
    assert.equal(ai.accepted, false);
    assert.ok(ai.reasonCodes.includes('AI_LISTING_AUTHORIZATION_REJECTED'));
    const human = evaluateProductionListing({
      instrument,
      riskAssessment: true,
      securityReview: true,
      legalRegulatoryEvidence: true,
      authorizedBy: 'HUMAN',
    });
    assert.equal(human.accepted, true);
    const hir = evaluateHirPrivacy({
      consentReady: true,
      purposePolicyReady: true,
      privacyReviewReady: true,
      legalEvidenceReady: true,
      cleanRoomReady: true,
    });
    assert.equal(hir.rawPdvExportAvailable, false);
    assert.equal(rawPdvExportAvailable(), false);
    const right = informationRightInstrument({
      instrumentId: 'inst_hir',
      issuer: 'sim',
      cohortRef: 'cohort',
      templateId: 'tpl',
      purpose: 'research',
      recipientClass: 'RESEARCHER',
      consentPolicyRef: 'consent-sim',
      settlementAsset: 'asset_sunrey_coin_native',
    });
    assert.equal(right.rightsPolicy.rawExportAllowed, false);
  });
});

describe('surveillance export, kill switches, readiness', () => {
  it('exports candidate cases and keeps unlicensed activation incomplete', () => {
    const cases = new InMemoryCaseManagementPort();
    const exported = exportSurveillanceCases(
      {
        marketId: 'mkt_sim',
        selfTrades: ['tr_1'],
        listedCapacity: 10n,
        deliveredCapacity: 12n,
      },
      NOW,
      cases,
      'alice',
    );
    assert.ok(exported.some((item) => item.kind === 'WASH_SELF_TRADING'));
    assert.ok(exported.every((item) => item.legalGuilt === false));
    const halt = engageExchangeKillSwitch({
      scope: 'WITHDRAWAL',
      targetId: 'SUNREY_COIN',
      actorKind: 'HUMAN',
      reason: 'SECURITY_EVENT',
    });
    assert.equal(halt.accepted, true);
    const aiHalt = engageExchangeKillSwitch({
      scope: 'SETTLEMENT',
      targetId: '*',
      actorKind: 'AI',
      reason: 'no',
    });
    assert.equal(aiHalt.accepted, false);
    const report = evaluateRegulatedMarketReadiness({
      technicalComplete: true,
      securityComplete: false,
      operationsComplete: false,
      providerComplete: false,
      legalComplete: false,
      licenseComplete: false,
      humanAuthorized: false,
    });
    assert.equal(unlicensedActivationRemainsIncomplete(report), true);
    assert.equal(report.productionActivated, false);
    const feed = readinessForCapability('SUNREY_EXCHANGE', report);
    assert.equal(feed.runtime_enabled, false);
    assert.equal(feed.license_or_partner_ready, false);
  });
});
