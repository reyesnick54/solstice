import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { allowlistFingerprint, matchNamingAllowlist, NAMING_ALLOWLIST } from './naming-allowlist.ts';
import { classifyLegacyOccurrence } from './naming-classification.ts';
import { ENV_REMOVAL_DATE, findLegacyEnvironmentVariable } from './naming-env-inventory.ts';
import {
  currentBlockchainName,
  currentExchangeName,
  currentMasterBrand,
  currentNativeAssetDisplayNames,
  currentNativeAssetProtocolIds,
  isLegacyProductName,
  LEGACY_PRODUCT_IDENTITY,
  NEW_PUBLIC_SOLSTICE_BRANDING_FORBIDDEN,
  PRODUCT_IDENTITY,
  PROTOCOL_NATIVE_ASSET_IDS,
  TICKER_STATUS,
} from './product-identity.ts';

describe('canonical SunRey product identity', () => {
  it('canonical brand is SunRey', () => {
    assert.equal(currentMasterBrand(), 'SunRey');
    assert.equal(PRODUCT_IDENTITY.masterBrand, 'SunRey');
    assert.equal(PRODUCT_IDENTITY.applicationName, 'SunRey');
    assert.equal(PRODUCT_IDENTITY.aiAgentName, 'SunRey AI Agent');
  });

  it('blockchain display name is canonical', () => {
    assert.equal(currentBlockchainName(), 'SunRey Blockchain');
    assert.equal(PRODUCT_IDENTITY.technicalChainName, 'SunRey Chain');
  });

  it('SunRey Coin display name is canonical and distinct from protocol id', () => {
    assert.equal(currentNativeAssetDisplayNames().sunReyCoin, 'SunRey Coin');
    assert.equal(currentNativeAssetProtocolIds().sunReyCoin, 'SUNREY_COIN');
    assert.equal(PROTOCOL_NATIVE_ASSET_IDS.sunReyCoin, 'SUNREY_COIN');
    assert.notEqual(PRODUCT_IDENTITY.sunReyCoinDisplayName, PRODUCT_IDENTITY.sunReyCoinProtocolId);
  });

  it('MoonRey Coin display name is canonical and distinct from protocol id', () => {
    assert.equal(currentNativeAssetDisplayNames().moonReyCoin, 'MoonRey Coin');
    assert.equal(currentNativeAssetProtocolIds().moonReyCoin, 'MOONREY_COIN');
    assert.notEqual(PRODUCT_IDENTITY.moonReyCoinDisplayName, PRODUCT_IDENTITY.moonReyCoinProtocolId);
  });

  it('SunRey Exchange name is canonical', () => {
    assert.equal(currentExchangeName(), 'SunRey Exchange');
  });

  it('ticker remains NOT_ASSIGNED', () => {
    assert.equal(TICKER_STATUS, 'NOT_ASSIGNED');
    assert.equal(PRODUCT_IDENTITY.tickerStatus, 'NOT_ASSIGNED');
  });

  it('legacy Solstice is classified as legacy, not current branding', () => {
    assert.equal(LEGACY_PRODUCT_IDENTITY.current, false);
    assert.equal(LEGACY_PRODUCT_IDENTITY.status, 'LEGACY');
    assert.deepEqual([...LEGACY_PRODUCT_IDENTITY.names], ['SOLSTICE', 'Solstice', 'solstice']);
    assert.equal(isLegacyProductName('Solstice'), true);
    assert.equal(isLegacyProductName('SunRey'), false);
  });

  it('public legacy occurrence is MUST_MIGRATE', () => {
    const result = classifyLegacyOccurrence({
      path: 'README.md',
      lineText: 'Solstice digital banking simulation',
      token: 'Solstice',
    });
    assert.equal(result.classification, 'PUBLIC_PRODUCT_NAME');
    assert.equal(result.recommendedAction, 'MUST_MIGRATE');
  });

  it('env legacy occurrence is MIGRATE_WITH_ALIAS', () => {
    const result = classifyLegacyOccurrence({
      path: 'packages/persistence/src/env.ts',
      lineText: 'const portRaw = env.SOLSTICE_PG_PORT ?? String(LOCAL_SIMULATION_PERSISTENCE_ENV.port);',
      token: 'SOLSTICE_PG_PORT',
    });
    assert.equal(result.classification, 'ENVIRONMENT_VARIABLE');
    assert.equal(result.recommendedAction, 'MIGRATE_WITH_ALIAS');
    const inventoried = findLegacyEnvironmentVariable('SOLSTICE_PG_PORT');
    assert.ok(inventoried);
    assert.equal(inventoried.canonicalName, 'SUNREY_PG_PORT');
    assert.equal(inventoried.legacyAliasRequired, true);
    assert.equal(inventoried.safeRemovalDate, ENV_REMOVAL_DATE);
    assert.equal(ENV_REMOVAL_DATE, 'NOT_SELECTED');
  });

  it('historical migration is PRESERVE_IMMUTABLE', () => {
    const result = classifyLegacyOccurrence({
      path: 'db/customer/migrations/V001__customer.sql',
      lineText: 'CREATE DATABASE solstice_customer;',
      token: 'solstice_customer',
    });
    assert.equal(result.classification, 'MIGRATION_IDENTIFIER');
    assert.equal(result.recommendedAction, 'PRESERVE_IMMUTABLE');
  });

  it('hash-domain legacy is preserved', () => {
    const result = classifyLegacyOccurrence({
      path: 'packages/permissions/src/verified-seal.ts',
      lineText: "export const VERIFIED_EXECUTION_AUTHORITY = Symbol('solstice.VerifiedExecutionAuthority');",
      token: 'solstice.VerifiedExecutionAuthority',
    });
    assert.equal(result.classification, 'HASH_DOMAIN');
    assert.equal(result.recommendedAction, 'PRESERVE_IMMUTABLE');
  });

  it('repo name is historical and not treated as current branding', () => {
    const result = classifyLegacyOccurrence({
      path: 'package.json',
      lineText: '  "name": "solstice",',
      token: 'solstice',
    });
    assert.equal(result.classification, 'REPOSITORY_NAME');
    assert.equal(result.recommendedAction, 'HISTORICAL_ONLY');
    const allow = matchNamingAllowlist('package.json', 'solstice', '  "name": "solstice",');
    assert.equal(allow.allowlisted, true);
  });

  it('allowlist is deterministic', () => {
    assert.equal(allowlistFingerprint(), allowlistFingerprint());
    assert.equal(NAMING_ALLOWLIST.length > 0, true);
    assert.equal(
      NAMING_ALLOWLIST.some((entry) => entry.pathPattern === 'README.md'),
      false,
      'active public README copy must not be allowlisted',
    );
  });

  it('new public Solstice branding remains forbidden', () => {
    assert.equal(NEW_PUBLIC_SOLSTICE_BRANDING_FORBIDDEN, true);
  });
});
