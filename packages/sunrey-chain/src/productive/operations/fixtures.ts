/**
 * Wave 5 — Productive operations test fixtures.
 */

import { fixtureObject } from '../fixtures.ts';
import { ProductiveOperationsPlatform } from './platform.ts';

export function energyOperationsFixture(): ProductiveOperationsPlatform {
  const platform = new ProductiveOperationsPlatform();
  platform.registerDomainProvider('ENERGY', 'provider.energy.a');
  platform.registerDomainProvider('ENERGY', 'provider.energy.b');
  platform.registerDomainProvider('COMPUTE', 'provider.compute.a');
  platform.reputation.upsert({
    providerId: 'provider.energy.a',
    sourceClass: 'UTILITY_METER',
    domain: 'ENERGY',
    acceptedObservations: 100,
    rejectedObservations: 2,
    independenceScore: 85,
  });
  platform.reputation.upsert({
    providerId: 'provider.energy.b',
    sourceClass: 'INDEPENDENT_AUDITOR',
    domain: 'ENERGY',
    acceptedObservations: 80,
    rejectedObservations: 1,
    independenceScore: 90,
  });
  return platform;
}

export function retiredFacilityObject() {
  return fixtureObject({
    objectId: 'obj.retired.solar',
    category: 'ENERGY',
    unitSchema: 'kWh',
  });
}

export function activeFacilityObject() {
  return fixtureObject({
    objectId: 'obj.active.solar',
    category: 'ENERGY',
    unitSchema: 'kWh',
  });
}

export function manufacturingFacilityObject() {
  return fixtureObject({
    objectId: 'obj.factory.alpha',
    category: 'MANUFACTURING',
    unitSchema: 'units',
  });
}

export function computeClusterObject() {
  return fixtureObject({
    objectId: 'obj.gpu.cluster',
    category: 'AI_COMPUTE',
    unitSchema: 'GPU_HOUR',
  });
}

export function waterFacilityObject() {
  return fixtureObject({
    objectId: 'obj.water.plant',
    category: 'WATER',
    unitSchema: 'm3',
  });
}
