import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PRODUCTIVE_ASSET_IDENTITY_AUDIT } from './audit.ts';
import { aliasValueCommitment } from './alias.ts';
import { commitCoordinates } from './commitment.ts';
import { assessProductionRollup } from './hierarchy.ts';
import { lifecycleAllowsProduction } from './lifecycle.ts';
import { createCollisionFixtureBundle, FIXTURE_NOW_UTC } from './fixtures.ts';
import { ProductiveAssetIdentityRegistry } from './registry.ts';
import { policyAllowsAutomatedConsolidation } from './resolution.ts';

describe('Wave 5 productive asset identity', () => {
  it('audits pre-wave durable identifiers', () => {
    assert.ok(PRODUCTIVE_ASSET_IDENTITY_AUDIT.surfaces.length >= 4);
    const economyData = PRODUCTIVE_ASSET_IDENTITY_AUDIT.surfaces.find(
      (row) => row.surface.includes('ProductiveAssetRegistry'),
    );
    assert.equal(economyData?.durable, false);
    assert.match(economyData?.weakness ?? '', /alias/i);
  });

  it('resolves same plant across EIA, operator, and satellite aliases to one canonical asset', () => {
    const { registry, plant } = createCollisionFixtureBundle();

    const eia = registry.resolve({
      aliasKind: 'EIA_PLANT_ID',
      aliasValue: '123',
      sourceSystem: 'eia',
      providerId: 'eia',
    });
    const operator = registry.resolve({
      aliasKind: 'OPERATOR_ASSET_ID',
      aliasValue: 'ABC',
      sourceSystem: 'gridserve-west',
      providerId: 'grid-operator-api',
    });
    const satellite = registry.resolve({
      aliasKind: 'SATELLITE_GEOMETRY',
      aliasValue: 'geom-xyz-riverside',
      sourceSystem: 'satellite-provider',
      providerId: 'satellite-facility',
    });

    assert.equal(eia.confidence, 'EXACT');
    assert.equal(operator.confidence, 'EXACT');
    assert.equal(satellite.confidence, 'EXACT');
    assert.equal(eia.productiveAssetId, plant.productiveAssetId);
    assert.equal(operator.productiveAssetId, plant.productiveAssetId);
    assert.equal(satellite.productiveAssetId, plant.productiveAssetId);
    assert.equal(registry.aliases.listForAsset(plant.productiveAssetId).length, 3);
  });

  it('does not merge same facility name in different cities', () => {
    const { registry } = createCollisionFixtureBundle();
    const illinois = registry.resolve({
      displayName: 'Springfield Manufacturing',
      jurisdiction: 'US-IL',
      sourceSystem: 'fixture',
    });
    const massachusetts = registry.resolve({
      displayName: 'Springfield Manufacturing',
      jurisdiction: 'US-MA',
      sourceSystem: 'fixture',
    });

    assert.equal(illinois.confidence, 'EXACT');
    assert.equal(massachusetts.confidence, 'NO_MATCH');
    assert.notEqual(illinois.productiveAssetId, massachusetts.productiveAssetId);
  });

  it('flags coordinate-near matches with different naming as non-exact without alias registration', () => {
    const registry = new ProductiveAssetIdentityRegistry();
    registry.register({
      assetClass: 'FACTORY',
      productiveCategory: 'MANUFACTURING',
      jurisdiction: 'US-CA',
      geography: {
        jurisdiction: 'US-CA',
        region: 'Alameda County',
        locality: 'Oakland',
        coordinatesCommitment: commitCoordinates(37.8044, -122.2712),
        precision: 'COORDINATES',
      },
      lifecycle: 'ACTIVE',
      createdAtUtc: FIXTURE_NOW_UTC,
    });

    const result = registry.resolve({
      displayName: 'Bay Fabrication',
      jurisdiction: 'US-CA',
      coordinatesCommitment: commitCoordinates(37.8045, -122.2711),
      assetClass: 'FACTORY',
      sourceSystem: 'fixture',
    });
    assert.equal(result.confidence, 'NO_MATCH');
    assert.equal(result.productiveAssetId, null);
  });

  it('models data center hierarchy without silent double-counting', () => {
    const { registry } = createCollisionFixtureBundle();
    const dataCenter = registry.list().find((row) => row.assetClass === 'DATA_CENTER');
    const cluster = registry.list().find((row) => row.assetClass === 'COMPUTE_CLUSTER');
    assert.ok(dataCenter);
    assert.ok(cluster);

    const rollup = assessProductionRollup({
      asset: cluster,
      hierarchy: registry.hierarchy(),
      assetsById: new Map(registry.list().map((row) => [row.productiveAssetId, row])),
    });
    assert.equal(rollup.doubleCountRisk, true);
    assert.equal(rollup.reportingAssetId, dataCenter.productiveAssetId);
  });

  it('models factory production lines and farm fields with rollup lineage', () => {
    const { registry } = createCollisionFixtureBundle();
    const factory = registry.list().find((row) => row.assetClass === 'FACTORY' && row.jurisdiction === 'US-TX');
    const line = registry.list().find((row) => row.assetClass === 'PRODUCTION_LINE');
    const farm = registry.list().find((row) => row.assetClass === 'FARM');
    const fields = registry.list().filter((row) => row.assetClass === 'FIELD');
    assert.ok(factory);
    assert.ok(line);
    assert.ok(farm);
    assert.equal(fields.length, 2);
    assert.equal(line?.parentAssetId, factory?.productiveAssetId);
    assert.equal(fields.every((row) => row.parentAssetId === farm?.productiveAssetId), true);
  });

  it('rejects production attribution for retired plants after retirement', () => {
    const { registry, retiredPlant } = createCollisionFixtureBundle();
    const assessment = registry.assessProductionAttribution(
      retiredPlant.productiveAssetId,
      '2021-01-01T00:00:00.000Z',
    );
    assert.equal(assessment.allowed, false);
    assert.equal(assessment.code, 'RETIRED_BEFORE_EVENT');
  });

  it('blocks retired lifecycle when event occurs after retirement date', () => {
    const { retiredPlant } = createCollisionFixtureBundle();
    const assessment = lifecycleAllowsProduction('RETIRED', FIXTURE_NOW_UTC, retiredPlant);
    assert.equal(assessment.allowed, false);
    assert.equal(assessment.code, 'RETIRED_BEFORE_EVENT');
  });

  it('separates owner, operator, and data provider roles', () => {
    const { registry, plant } = createCollisionFixtureBundle();
    const asset = registry.require(plant.productiveAssetId);
    const roles = new Set(asset.parties.map((row) => row.role));
    assert.equal(roles.has('OWNER'), true);
    assert.equal(roles.has('OPERATOR'), true);
    assert.equal(roles.has('DATA_PROVIDER'), true);
    const owner = asset.parties.find((row) => row.role === 'OWNER');
    const operator = asset.parties.find((row) => row.role === 'OPERATOR');
    const provider = asset.parties.find((row) => row.role === 'DATA_PROVIDER');
    assert.notEqual(owner?.partyRef, operator?.partyRef);
    assert.notEqual(provider?.partyRef, operator?.partyRef);
  });

  it('preserves aliases across operator and provider changes', () => {
    const { registry, plant } = createCollisionFixtureBundle();
    registry.registerAlias({
      productiveAssetId: plant.productiveAssetId,
      aliasKind: 'PROVIDER_RECORD_ID',
      aliasValue: 'utility-record-991',
      sourceSystem: 'utility-api',
      providerId: 'utility-api',
      registeredAtUtc: FIXTURE_NOW_UTC,
    });
    const renamed = registry.resolve({
      aliasKind: 'PROVIDER_RECORD_ID',
      aliasValue: 'utility-record-991',
      sourceSystem: 'utility-api',
      providerId: 'utility-api',
    });
    assert.equal(renamed.productiveAssetId, plant.productiveAssetId);
    assert.equal(registry.aliases.listForAsset(plant.productiveAssetId).length, 4);
  });

  it('does not auto-merge ambiguous assets', () => {
    const registry = new ProductiveAssetIdentityRegistry();
    const first = registry.register({
      assetClass: 'FACTORY',
      productiveCategory: 'MANUFACTURING',
      jurisdiction: 'US-NY',
      geography: {
        jurisdiction: 'US-NY',
        region: 'Kings County',
        locality: 'Brooklyn',
        coordinatesCommitment: null,
        precision: 'LOCALITY',
      },
      lifecycle: 'ACTIVE',
      createdAtUtc: FIXTURE_NOW_UTC,
    });
    registry.registerAlias({
      productiveAssetId: first.productiveAssetId,
      aliasKind: 'DISPLAY_NAME',
      aliasValue: 'Metro Plant|US-NY',
      sourceSystem: 'fixture-a',
      registeredAtUtc: FIXTURE_NOW_UTC,
    });
    const second = registry.register({
      assetClass: 'FACTORY',
      productiveCategory: 'MANUFACTURING',
      jurisdiction: 'US-NY',
      geography: first.geography,
      lifecycle: 'ACTIVE',
      createdAtUtc: FIXTURE_NOW_UTC,
    });
    registry.registerAlias({
      productiveAssetId: second.productiveAssetId,
      aliasKind: 'DISPLAY_NAME',
      aliasValue: 'Metro Plant|US-NY',
      sourceSystem: 'fixture-b',
      registeredAtUtc: FIXTURE_NOW_UTC,
    });

    const conflict = registry.resolve({
      displayName: 'Metro Plant',
      jurisdiction: 'US-NY',
      sourceSystem: 'fixture-a',
    });
    assert.equal(conflict.confidence, 'EXACT');
    assert.equal(policyAllowsAutomatedConsolidation('POSSIBLE'), false);
    assert.equal(policyAllowsAutomatedConsolidation('EXACT'), true);
    assert.notEqual(first.productiveAssetId, second.productiveAssetId);
    assert.equal(
      aliasValueCommitment('DISPLAY_NAME', 'Metro Plant|US-NY'),
      aliasValueCommitment('DISPLAY_NAME', 'Metro Plant|US-NY'),
    );
  });

  it('persists canonical assets and aliases across restart', () => {
    const { registry, plant } = createCollisionFixtureBundle();
    const snapshot = registry.snapshot();
    const restored = new ProductiveAssetIdentityRegistry();
    restored.restore(snapshot);

    const resolved = restored.resolve({
      aliasKind: 'EIA_PLANT_ID',
      aliasValue: '123',
      sourceSystem: 'eia',
      providerId: 'eia',
    });
    assert.equal(resolved.productiveAssetId, plant.productiveAssetId);
    assert.equal(restored.list().length, registry.list().length);
    assert.equal(restored.aliases.list().length, registry.aliases.list().length);
    assert.equal(restored.hierarchy().length, registry.hierarchy().length);
  });
});
