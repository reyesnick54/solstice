import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { describe, it } from 'node:test';

import { nativeAssetConstitution } from '../packages/sunrey-chain/src/economics/constitution.ts';
import {
  AI_AUTHORIZED,
  HumanContributionMonetaryBridge,
  PEVE_USED_AS_TOKEN_FORMULA,
  PRODUCTION_ACTIVATED,
  RAW_PERSONAL_DATA,
  VALUATION_ENGINE_IMPLEMENTED,
  createDevelopmentSettlementAuthorization,
  fixtureVerifiedContribution,
} from '../packages/sunrey-chain/src/economics/human-contribution-bridge/index.ts';
import { emptyBook } from '../packages/sunrey-chain/src/economics/supply.ts';

describe('Chunk 108 exit criteria', () => {
  it('ships the bridge docs and forbids competing mint packages', () => {
    assert.equal(existsSync('docs/economics/chunk-108-human-contribution-monetary-bridge.md'), true);
    assert.equal(existsSync('docs/architecture/chunk-108-human-contribution-monetary-bridge.md'), true);
    assert.equal(existsSync('docs/architecture/chunks/chunk-108-human-contribution-monetary-bridge.json'), true);
    assert.equal(existsSync('packages/sunrey-chain/src/economics/human-contribution-bridge/gate.ts'), true);
    assert.equal(existsSync('packages/human-contribution-mint'), false);
    assert.equal(existsSync('packages/human-valuation-engine'), false);
    assert.equal(existsSync('packages/peve-mint'), false);
  });

  it('keeps production inactive and does not treat PEVE, AI, or raw data as mint authority', () => {
    const constitution = nativeAssetConstitution('PRODUCTION_CANDIDATE');
    assert.equal(constitution.assets[0]?.supplyConstraints.productionIssuanceActivated, false);
    assert.equal(PRODUCTION_ACTIVATED, false);
    assert.equal(PEVE_USED_AS_TOKEN_FORMULA, false);
    assert.equal(RAW_PERSONAL_DATA, false);
    assert.equal(AI_AUTHORIZED, false);
    assert.equal(VALUATION_ENGINE_IMPLEMENTED, false);
    const bridge = new HumanContributionMonetaryBridge();
    const contribution = fixtureVerifiedContribution({ contributionId: 'hec.exit.1' });
    const missing = bridge.attempt(
      { recipient: 'alice', contribution },
      emptyBook('SUNREY_COIN', constitution.assets[0]!.policyVersion.versionId),
    );
    assert.equal(missing.ok, false);
    const authorization = createDevelopmentSettlementAuthorization({
      contribution,
      authorizedSunReyQuantity: 11n,
    });
    const issued = new HumanContributionMonetaryBridge({
      constitution: nativeAssetConstitution('DEVELOPMENT_ACTIVE'),
    }).attempt(
      { recipient: 'alice', contribution, authorization },
      emptyBook('SUNREY_COIN', 'sunrey.monetary.constitution.v1'),
    );
    assert.equal(issued.ok, true);
  });
});
