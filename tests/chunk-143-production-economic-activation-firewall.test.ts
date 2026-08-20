import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  ENVIRONMENT,
  LIVE_CRYPTO_ENABLED,
  LIVE_EXCHANGE_ENABLED,
} from '../packages/config/src/flags.ts';
import { nativeAssetConstitution } from '../packages/sunrey-chain/src/economics/constitution.ts';
import { moonreyIssuanceActivated } from '../packages/sunrey-chain/src/protocol/assets.ts';
import {
  CHUNK_71_REMAINS_MONETARY_AUTHORITY,
  evaluateProductionEconomicActivation,
  currentRepositorySnapshot,
} from '../packages/sunrey-chain/src/economics/production-activation/index.ts';

describe('Chunk 143 exit criteria', () => {
  it('ships the firewall under the monetary owner and forbids competing packages', () => {
    assert.equal(existsSync('docs/economics/chunk-143-production-economic-activation-firewall.md'), true);
    assert.equal(existsSync('docs/architecture/chunks/chunk-143.json'), true);
    assert.equal(
      existsSync('packages/sunrey-chain/src/economics/production-activation/firewall.ts'),
      true,
    );
    assert.equal(existsSync('packages/production-economics'), false);
    assert.equal(existsSync('packages/monetary-activation'), false);
    assert.equal(existsSync('packages/mainnet-economics'), false);
    assert.equal(existsSync('packages/tokenomics-v2'), false);
    assert.equal(existsSync('packages/launch-economics'), false);
  });

  it('keeps current main blocked, production inactive, and Chunk 71 authoritative', () => {
    const constitution = nativeAssetConstitution();
    assert.equal(constitution.productionEconomicActivationUnavailable, true);
    assert.equal(constitution.assets[0]?.supplyConstraints.maximumSupply, 'UNCONFIGURED');
    assert.equal(constitution.assets[0]?.supplyConstraints.productionIssuanceActivated, false);
    assert.equal(moonreyIssuanceActivated(), false);
    assert.equal(CHUNK_71_REMAINS_MONETARY_AUTHORITY, true);
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_CRYPTO_ENABLED, false);
    assert.equal(LIVE_EXCHANGE_ENABLED, false);
    const decision = evaluateProductionEconomicActivation(currentRepositorySnapshot());
    assert.equal(decision.overallState, 'ECONOMIC_ACTIVATION_BLOCKED');
    assert.equal(decision.productionActivated, false);
    assert.equal(decision.liveFlagsChanged, false);
    assert.equal(decision.monetaryAuthorityInvoked, false);
  });

  it('does not implement an activation function', () => {
    const source = readFileSync(
      'packages/sunrey-chain/src/economics/production-activation/firewall.ts',
      'utf8',
    );
    assert.equal(source.includes('function activateProduction'), false);
    assert.equal(source.includes('enableMainnetMoney'), false);
    assert.equal(source.includes('turnOnMoonRey'), false);
    assert.equal(source.includes('turnOnSunRey'), false);
  });
});
