/**
 * Sandbox fixtures for productive asset identity collision tests.
 */

import { commitCoordinates } from './commitment.ts';
import { ProductiveAssetIdentityRegistry } from './registry.ts';

export const FIXTURE_NOW_UTC = '2026-09-02T12:00:00.000Z' as const;

export function createCollisionFixtureBundle(): {
  readonly registry: ProductiveAssetIdentityRegistry;
  readonly plant: ReturnType<ProductiveAssetIdentityRegistry['register']>;
  readonly retiredPlant: ReturnType<ProductiveAssetIdentityRegistry['register']>;
} {
  const registry = new ProductiveAssetIdentityRegistry();

  const plant = registry.register({
    assetClass: 'POWER_PLANT',
    productiveCategory: 'ENERGY',
    economyCategory: 'ENERGY',
    displayName: 'Riverside Combined Cycle',
    jurisdiction: 'US-CA',
    geography: {
      jurisdiction: 'US-CA',
      region: 'Riverside County',
      locality: 'Riverside',
      coordinatesCommitment: commitCoordinates(33.9533, -117.3962),
      precision: 'COORDINATES',
    },
    commissionedAtUtc: '2010-06-01T00:00:00.000Z',
    lifecycle: 'ACTIVE',
    technologyMetadata: { technology: 'combined-cycle-gas', fuelType: 'natural-gas' },
    capacityMetadata: { nameplateMw: '500' },
    parties: [
      { role: 'OWNER', partyRef: 'owner:riverside-energy-holdings', sourceSystem: 'fixture', authorized: true },
      { role: 'OPERATOR', partyRef: 'operator:gridserve-west', sourceSystem: 'fixture', authorized: true },
      { role: 'DATA_PROVIDER', partyRef: 'provider:eia', sourceSystem: 'eia', authorized: true },
    ],
    verificationStatus: 'VERIFIED',
    sourceReferences: ['fixture:power-plant:riverside'],
    createdAtUtc: FIXTURE_NOW_UTC,
  });

  registry.registerAlias({
    productiveAssetId: plant.productiveAssetId,
    aliasKind: 'EIA_PLANT_ID',
    aliasValue: '123',
    sourceSystem: 'eia',
    providerId: 'eia',
    registeredAtUtc: FIXTURE_NOW_UTC,
  });
  registry.registerAlias({
    productiveAssetId: plant.productiveAssetId,
    aliasKind: 'OPERATOR_ASSET_ID',
    aliasValue: 'ABC',
    sourceSystem: 'gridserve-west',
    providerId: 'grid-operator-api',
    registeredAtUtc: FIXTURE_NOW_UTC,
  });
  registry.registerAlias({
    productiveAssetId: plant.productiveAssetId,
    aliasKind: 'SATELLITE_GEOMETRY',
    aliasValue: 'geom-xyz-riverside',
    sourceSystem: 'satellite-provider',
    providerId: 'satellite-facility',
    registeredAtUtc: FIXTURE_NOW_UTC,
  });

  const springfieldIl = registry.register({
    assetClass: 'FACTORY',
    productiveCategory: 'MANUFACTURING',
    economyCategory: 'MANUFACTURING',
    displayName: 'Springfield Manufacturing',
    jurisdiction: 'US-IL',
    geography: {
      jurisdiction: 'US-IL',
      region: 'Sangamon County',
      locality: 'Springfield',
      coordinatesCommitment: commitCoordinates(39.7817, -89.6501),
      precision: 'LOCALITY',
    },
    lifecycle: 'ACTIVE',
    createdAtUtc: FIXTURE_NOW_UTC,
  });
  registry.registerAlias({
    productiveAssetId: springfieldIl.productiveAssetId,
    aliasKind: 'DISPLAY_NAME',
    aliasValue: 'Springfield Manufacturing|US-IL',
    sourceSystem: 'fixture',
    registeredAtUtc: FIXTURE_NOW_UTC,
  });

  registry.register({
    assetClass: 'FACTORY',
    productiveCategory: 'MANUFACTURING',
    economyCategory: 'MANUFACTURING',
    displayName: 'Springfield Manufacturing',
    jurisdiction: 'US-MA',
    geography: {
      jurisdiction: 'US-MA',
      region: 'Hampden County',
      locality: 'Springfield',
      coordinatesCommitment: commitCoordinates(42.1015, -72.5898),
      precision: 'LOCALITY',
    },
    lifecycle: 'ACTIVE',
    createdAtUtc: FIXTURE_NOW_UTC,
  });

  const dataCenter = registry.register({
    assetClass: 'DATA_CENTER',
    productiveCategory: 'COMPUTE',
    economyCategory: 'COMPUTE',
    displayName: 'Lab East DC',
    jurisdiction: 'US-VA',
    geography: {
      jurisdiction: 'US-VA',
      region: 'Loudoun',
      locality: 'Ashburn',
      coordinatesCommitment: null,
      precision: 'REGION',
    },
    lifecycle: 'ACTIVE',
    rollupBehavior: 'AGGREGATES_CHILDREN',
    createdAtUtc: FIXTURE_NOW_UTC,
  });

  const cluster = registry.register({
    assetClass: 'COMPUTE_CLUSTER',
    productiveCategory: 'COMPUTE',
    economyCategory: 'COMPUTE',
    displayName: 'Lab East Cluster A',
    jurisdiction: 'US-VA',
    geography: dataCenter.geography,
    lifecycle: 'ACTIVE',
    parentAssetId: dataCenter.productiveAssetId,
    rollupBehavior: 'ROLLS_UP_TO_PARENT',
    createdAtUtc: FIXTURE_NOW_UTC,
  });

  registry.register({
    assetClass: 'ACCELERATOR_POOL',
    productiveCategory: 'AI_COMPUTE',
    economyCategory: 'AI_COMPUTE',
    displayName: 'Accelerator Pool 1',
    jurisdiction: 'US-VA',
    geography: dataCenter.geography,
    lifecycle: 'ACTIVE',
    parentAssetId: cluster.productiveAssetId,
    rollupBehavior: 'ROLLS_UP_TO_PARENT',
    createdAtUtc: FIXTURE_NOW_UTC,
  });

  const factory = registry.register({
    assetClass: 'FACTORY',
    productiveCategory: 'MANUFACTURING',
    economyCategory: 'MANUFACTURING',
    displayName: 'Acme Plant 7',
    jurisdiction: 'US-TX',
    geography: {
      jurisdiction: 'US-TX',
      region: 'Travis County',
      locality: 'Austin',
      coordinatesCommitment: null,
      precision: 'REGION',
    },
    lifecycle: 'ACTIVE',
    rollupBehavior: 'AGGREGATES_CHILDREN',
    createdAtUtc: FIXTURE_NOW_UTC,
  });

  registry.register({
    assetClass: 'PRODUCTION_LINE',
    productiveCategory: 'MANUFACTURING',
    economyCategory: 'MANUFACTURING',
    displayName: 'Line A',
    jurisdiction: 'US-TX',
    geography: factory.geography,
    lifecycle: 'ACTIVE',
    parentAssetId: factory.productiveAssetId,
    rollupBehavior: 'ROLLS_UP_TO_PARENT',
    createdAtUtc: FIXTURE_NOW_UTC,
  });

  const farm = registry.register({
    assetClass: 'FARM',
    productiveCategory: 'FOOD_AGRICULTURE',
    economyCategory: 'AGRICULTURE_FOOD',
    displayName: 'Delta Farm',
    jurisdiction: 'US-IA',
    geography: {
      jurisdiction: 'US-IA',
      region: 'Polk County',
      locality: null,
      coordinatesCommitment: null,
      precision: 'REGION',
    },
    lifecycle: 'ACTIVE',
    rollupBehavior: 'AGGREGATES_CHILDREN',
    createdAtUtc: FIXTURE_NOW_UTC,
  });

  registry.register({
    assetClass: 'FIELD',
    productiveCategory: 'FOOD_AGRICULTURE',
    economyCategory: 'AGRICULTURE_FOOD',
    displayName: 'North Field',
    jurisdiction: 'US-IA',
    geography: farm.geography,
    lifecycle: 'ACTIVE',
    parentAssetId: farm.productiveAssetId,
    rollupBehavior: 'ROLLS_UP_TO_PARENT',
    createdAtUtc: FIXTURE_NOW_UTC,
  });

  registry.register({
    assetClass: 'FIELD',
    productiveCategory: 'FOOD_AGRICULTURE',
    economyCategory: 'AGRICULTURE_FOOD',
    displayName: 'South Field',
    jurisdiction: 'US-IA',
    geography: farm.geography,
    lifecycle: 'ACTIVE',
    parentAssetId: farm.productiveAssetId,
    rollupBehavior: 'ROLLS_UP_TO_PARENT',
    createdAtUtc: FIXTURE_NOW_UTC,
  });

  const retiredPlant = registry.register({
    assetClass: 'POWER_PLANT',
    productiveCategory: 'ENERGY',
    economyCategory: 'ENERGY',
    displayName: 'Old Harbor Steam',
    jurisdiction: 'US-ME',
    geography: {
      jurisdiction: 'US-ME',
      region: 'Cumberland County',
      locality: 'Portland',
      coordinatesCommitment: null,
      precision: 'LOCALITY',
    },
    commissionedAtUtc: '1975-01-01T00:00:00.000Z',
    retiredAtUtc: '2020-12-31T23:59:59.000Z',
    lifecycle: 'RETIRED',
    createdAtUtc: FIXTURE_NOW_UTC,
  });

  registry.setParties(
    plant.productiveAssetId,
    [
      { role: 'OWNER', partyRef: 'owner:new-holdings', sourceSystem: 'fixture', authorized: true },
      { role: 'OPERATOR', partyRef: 'operator:gridserve-west', sourceSystem: 'fixture', authorized: true },
      { role: 'DATA_PROVIDER', partyRef: 'provider:utility-api', sourceSystem: 'utility-api', authorized: true },
    ],
    FIXTURE_NOW_UTC,
  );

  return { registry, plant, retiredPlant };
}

export function createCollisionFixtureRegistry(): ProductiveAssetIdentityRegistry {
  return createCollisionFixtureBundle().registry;
}
