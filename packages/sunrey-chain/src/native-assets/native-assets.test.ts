import assert from 'node:assert/strict';
import { test } from 'node:test';

import { NATIVE_ASSET_TICKER_STATUS } from '../protocol/assets.ts';
import { nativeAssetAuthorityBoundary } from './authority.ts';
import { assertMigrationNotExecuted, developmentMigrationFixture } from './migration.ts';

test('application supply is not imported and tickers stay unassigned', () => {
  const boundary = nativeAssetAuthorityBoundary();
  assert.equal(boundary.application, 'CURRENT_APPLICATION_AUTHORITY');
  assert.equal(boundary.nativeChain, 'NATIVE_BLOCKCHAIN_AUTHORITY');
  assert.equal(boundary.applicationSupplyImported, false);
  assert.equal(boundary.productionMigrationPerformed, false);
  assert.equal(NATIVE_ASSET_TICKER_STATUS, 'NOT_ASSIGNED');
});

test('migration fixture is schema-valid and not executed', () => {
  const manifest = developmentMigrationFixture();
  assertMigrationNotExecuted(manifest);
  assert.equal(manifest.sourceSupplyScaled, '0');
  assert.equal(manifest.destinationSupplyScaled, '0');
  assert.equal(manifest.merkleCommitment.length, 64);
});
