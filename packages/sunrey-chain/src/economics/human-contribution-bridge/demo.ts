/**
 * Deterministic Chunk 108 demo.
 *
 * verified contribution → candidate → missing authorization = REFUSED
 * then DEVELOPMENT fixture authorization → HumanEconomicEvidence →
 * existing MonetaryIssuanceAuthority → simulation issuance → supply
 * reconciliation.
 */

import { nativeAssetConstitution } from '../constitution.ts';
import { emptyBook, expectedTotal, observedTotal, supplyReconciles } from '../supply.ts';
import {
  AI_AUTHORIZED,
  HumanContributionMonetaryBridge,
  PEVE_USED_AS_TOKEN_FORMULA,
  PRODUCTION_ACTIVATED,
  RAW_PERSONAL_DATA,
  VALUATION_ENGINE_IMPLEMENTED,
  createDevelopmentSettlementAuthorization,
  fixtureVerifiedContribution,
} from './index.ts';

export function runHumanContributionMonetaryBridgeDemo(): {
  readonly refusedWithoutAuthorization: true;
  readonly issuedWithFixtureAuthorization: true;
  readonly productionActivated: false;
  readonly peveUsedAsTokenFormula: false;
  readonly rawPersonalData: false;
  readonly aiAuthorized: false;
  readonly valuationEngineImplemented: false;
  readonly supplyReconciled: true;
  readonly moonreyUnaffected: true;
} {
  const constitution = nativeAssetConstitution('DEVELOPMENT_ACTIVE');
  const bridge = new HumanContributionMonetaryBridge({ constitution });
  const contribution = fixtureVerifiedContribution({
    contributionId: 'hec.contrib.demo.community.1',
    contributionClass: 'COMMUNITY_CONTRIBUTION',
  });
  const candidate = bridge.candidate(contribution);
  if (!candidate.ok) {
    throw new Error(`demo candidate refused: ${candidate.code}`);
  }
  let book = emptyBook('SUNREY_COIN', constitution.assets[0]!.policyVersion.versionId);
  const refused = bridge.attempt(
    {
      recipient: 'acct.human.demo.1',
      contribution,
    },
    book,
  );
  if (refused.ok || refused.code !== 'SETTLEMENT_AUTHORIZATION_REQUIRED') {
    throw new Error('demo must refuse issuance without settlement authorization');
  }
  const authorization = createDevelopmentSettlementAuthorization({
    contribution,
    authorizedSunReyQuantity: 250n,
    authorizationId: 'hcesa.demo.community.1',
  });
  const issued = bridge.attempt(
    {
      recipient: 'acct.human.demo.1',
      contribution,
      authorization,
      actorKind: 'HUMAN',
    },
    book,
  );
  if (!issued.ok) {
    throw new Error(`demo issuance refused: ${issued.code}`);
  }
  book = issued.book;
  if (!supplyReconciles(book) || expectedTotal(book) !== observedTotal(book) || book.issuedPostGenesis !== 250n) {
    throw new Error('demo supply failed to reconcile');
  }
  const moonrey = bridge.issueMoonReyUnaffected({
    quantity: 40n,
    replayIdentifier: 'demo.moonrey.unaffected',
    contributionId: 'moonrey.prod.demo.1',
    fingerprint: 'moonrey.fp.demo.1',
    authorizationId: 'moonrey.auth.demo.1',
  });
  if (!moonrey.ok) {
    throw new Error(`MoonRey path must remain unaffected: ${moonrey.code}`);
  }
  return {
    refusedWithoutAuthorization: true,
    issuedWithFixtureAuthorization: true,
    productionActivated: PRODUCTION_ACTIVATED,
    peveUsedAsTokenFormula: PEVE_USED_AS_TOKEN_FORMULA,
    rawPersonalData: RAW_PERSONAL_DATA,
    aiAuthorized: AI_AUTHORIZED,
    valuationEngineImplemented: VALUATION_ENGINE_IMPLEMENTED,
    supplyReconciled: true,
    moonreyUnaffected: true,
  };
}

const report = runHumanContributionMonetaryBridgeDemo();
console.log(JSON.stringify(report, null, 2));
console.log('PRODUCTION_ACTIVATED=false');
console.log('PEVE_USED_AS_TOKEN_FORMULA=false');
console.log('RAW_PERSONAL_DATA=false');
console.log('AI_AUTHORIZED=false');
console.log(`VALUATION_ENGINE_IMPLEMENTED=${String(VALUATION_ENGINE_IMPLEMENTED)}`);
