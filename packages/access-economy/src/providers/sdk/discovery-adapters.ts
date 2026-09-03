/**
 * ACCESS Wave 2 — Discovery-only provider adapters.
 *
 * Simulation fixtures for travel, mobility, experiences, hotels,
 * transportation, and AI/compute discovery. No fulfillment or settlement.
 */

import type { AccessCapacityCategory } from '../../taxonomy.ts';
import type { AccessProviderId, AccessProviderOutcome } from '../types.ts';
import type { AccessProvider, AccessProviderRuntimeContext } from './contract.ts';
import { ACCESS_PROVIDER_DESCRIPTORS } from './descriptors.ts';
import { createHealthSnapshot } from './health.ts';
import type { AccessInventoryProvider, AccessInventorySearchRequest, AccessInventorySearchResult } from './interfaces.ts';
import type { AccessOpportunity, AccessProduct } from './domain-types.ts';
import { buildProviderCostMetadata } from './cost-model.ts';

const SIMULATION_NOW = '2026-08-31T09:00:00.000Z';

function ok<T>(value: T): AccessProviderOutcome<T> {
  return Object.freeze({ ok: true, value });
}

function fail(code: string, message: string): AccessProviderOutcome<never> {
  return Object.freeze({ ok: false, code, message });
}

type DiscoveryFixture = {
  readonly productId: string;
  readonly category: AccessCapacityCategory;
  readonly title: string;
  readonly description: string;
  readonly geography: string;
  readonly unit: import('../types.ts').CanonicalCapacityUnit;
  readonly keywords: readonly string[];
};

const FIXTURES: Readonly<Record<AccessProviderId, readonly DiscoveryFixture[]>> = Object.freeze({
  gbfs_mobility: Object.freeze([
    {
      productId: 'gbfs_bike_miami',
      category: 'VEHICLE_HOURS',
      title: 'Citi Bike — Miami Beach',
      description: 'GBFS bicycle share discovery fixture',
      geography: 'Miami, FL',
      unit: 'VEHICLE_HOUR',
      keywords: Object.freeze(['bike', 'gbfs', 'miami']),
    },
    {
      productId: 'gbfs_scooter_miami',
      category: 'TRANSPORTATION',
      title: 'E-Scooter — Miami',
      description: 'GBFS scooter discovery fixture',
      geography: 'Miami, FL',
      unit: 'VEHICLE_HOUR',
      keywords: Object.freeze(['scooter', 'gbfs', 'miami']),
    },
  ]),
  travel_discovery: Object.freeze([
    {
      productId: 'travel_mia_jfk',
      category: 'TRAVEL',
      title: 'MIA → JFK Economy',
      description: 'Air travel discovery fixture',
      geography: 'Miami, FL',
      unit: 'PASSENGER_SEGMENT',
      keywords: Object.freeze(['flight', 'miami', 'jfk', 'travel']),
    },
  ]),
  experiences_discovery: Object.freeze([
    {
      productId: 'exp_everglades_tour',
      category: 'EXPERIENCES',
      title: 'Everglades Airboat Tour',
      description: 'Experiences discovery fixture',
      geography: 'Miami, FL',
      unit: 'EXPERIENCE_SLOT',
      keywords: Object.freeze(['everglades', 'tour', 'experience']),
    },
  ]),
  hotels_discovery: Object.freeze([
    {
      productId: 'hotel_fontainebleau',
      category: 'HOUSING_ROOM_NIGHTS',
      title: 'Fontainebleau Miami Beach',
      description: 'Hotels discovery fixture',
      geography: 'Miami, FL',
      unit: 'ROOM_NIGHT',
      keywords: Object.freeze(['hotel', 'fontainebleau', 'miami']),
    },
  ]),
  transportation_discovery: Object.freeze([
    {
      productId: 'transit_metromover',
      category: 'TRANSPORTATION',
      title: 'Miami Metromover',
      description: 'Transit discovery fixture',
      geography: 'Miami, FL',
      unit: 'PASSENGER_SEGMENT',
      keywords: Object.freeze(['transit', 'metromover', 'miami']),
    },
    {
      productId: 'robotaxi_miami_pilot',
      category: 'VEHICLE_HOURS',
      title: 'Robotaxi Pilot — Miami',
      description: 'Future robotaxi operator discovery fixture',
      geography: 'Miami, FL',
      unit: 'VEHICLE_HOUR',
      keywords: Object.freeze(['robotaxi', 'autonomous', 'miami']),
    },
  ]),
  compute_discovery: Object.freeze([
    {
      productId: 'gpu_a100_hour',
      category: 'COMPUTE',
      title: 'NVIDIA A100 GPU Hour',
      description: 'GPU datacenter discovery fixture',
      geography: 'GLOBAL',
      unit: 'GPU_HOUR',
      keywords: Object.freeze(['gpu', 'compute', 'a100', 'ai']),
    },
    {
      productId: 'robot_hour_warehouse',
      category: 'ROBOTICS',
      title: 'Warehouse Robot Hour',
      description: 'Robotics fleet discovery fixture',
      geography: 'GLOBAL',
      unit: 'ROBOT_HOUR',
      keywords: Object.freeze(['robot', 'robotics', 'warehouse']),
    },
  ]),
  // Commercial providers are bridged separately; empty fixtures here.
  expedia: Object.freeze([]),
  turo: Object.freeze([]),
  doordash: Object.freeze([]),
  amazon: Object.freeze([]),
  airbnb: Object.freeze([]),
}) as Readonly<Record<AccessProviderId, readonly DiscoveryFixture[]>>;

function matchFixture(fixture: DiscoveryFixture, request: AccessInventorySearchRequest): boolean {
  if (fixture.category !== request.category) {
    return false;
  }
  const haystack = `${request.query} ${request.geography ?? ''}`.toLowerCase();
  return fixture.keywords.some((keyword) => haystack.includes(keyword));
}

function fixtureToProduct(providerId: AccessProviderId, fixture: DiscoveryFixture): AccessProduct {
  return Object.freeze({
    productId: fixture.productId,
    providerId,
    category: fixture.category,
    canonicalUnit: fixture.unit,
    title: fixture.title,
    description: fixture.description,
    location: fixture.geography,
    serviceClass: 'STANDARD',
    rightKind: 'ACCESS_RIGHT',
    geography: fixture.geography,
    metadata: Object.freeze({ discoveryOnly: 'true' }),
  });
}

function fixtureToOpportunity(providerId: AccessProviderId, fixture: DiscoveryFixture): AccessOpportunity {
  return Object.freeze({
    opportunityId: `opp_${fixture.productId}`,
    providerId,
    product: fixtureToProduct(providerId, fixture),
    availableQuantity: 10n,
    earliestStart: '2026-09-01T00:00:00.000Z',
    latestEnd: '2026-12-31T23:59:59.000Z',
    cost: buildProviderCostMetadata({ currency: 'USD', retailPriceMinorUnits: 5000n }),
    simulationOnly: true,
    discoveredAt: SIMULATION_NOW,
  });
}

export class DiscoveryAccessProvider implements AccessInventoryProvider {
  readonly id: AccessProviderId;
  readonly descriptor;
  private healthy = true;
  private simulateDown = false;
  private simulate429 = false;

  constructor(providerId: DiscoveryAccessProviderId) {
    this.id = providerId;
    this.descriptor = ACCESS_PROVIDER_DESCRIPTORS[providerId]!;
  }

  async initialize(_context: AccessProviderRuntimeContext): Promise<void> {
    // no-op
  }

  async healthCheck() {
    return createHealthSnapshot({
      providerId: this.id,
      capabilities: this.descriptor.capabilities,
      health: this.simulateDown ? 'UNHEALTHY' : this.simulate429 ? 'DEGRADED' : this.healthy ? 'HEALTHY' : 'UNHEALTHY',
      lastSuccessAt: this.healthy && !this.simulateDown ? SIMULATION_NOW : null,
      lastFailureAt: this.simulateDown || this.simulate429 ? SIMULATION_NOW : null,
      latencyMs: this.simulate429 ? 5000 : 25,
      activationState: this.descriptor.activationState,
      credentialStatus: this.descriptor.credentialStatus,
      contractStatus: this.descriptor.commercialStatus,
      message: this.simulateDown ? 'provider down' : this.simulate429 ? 'rate limited' : 'discovery provider healthy',
      checkedAt: SIMULATION_NOW,
    });
  }

  getCapabilities() {
    return this.descriptor.capabilities;
  }

  async shutdown(): Promise<void> {
    // no-op
  }

  search(request: AccessInventorySearchRequest): AccessProviderOutcome<AccessInventorySearchResult> {
    if (this.simulateDown) {
      return fail('PROVIDER_DOWN', `${this.id} discovery provider unavailable`);
    }
    if (this.simulate429) {
      return fail('RATE_LIMITED', `${this.id} returned 429`);
    }
    const fixtures = FIXTURES[this.id] ?? [];
    const matched = fixtures.filter((fixture) => matchFixture(fixture, request)).slice(0, request.limit);
    if (matched.length === 0) {
      return fail('NO_MATCH', 'no discovery items matched search');
    }
    return ok(
      Object.freeze({
        requestId: request.requestId,
        opportunities: Object.freeze(matched.map((fixture) => fixtureToOpportunity(this.id, fixture))),
        simulationOnly: true,
      }),
    );
  }

  getAvailability(request: import('./interfaces.ts').AccessAvailabilityRequest): AccessProviderOutcome<import('./interfaces.ts').AccessAvailabilityResult> {
    const fixtures = FIXTURES[this.id] ?? [];
    const found = fixtures.find((fixture) => fixture.productId === request.productId);
    if (!found) {
      return fail('NOT_FOUND', 'product not found');
    }
    return ok(
      Object.freeze({
        requestId: request.requestId,
        providerId: this.id,
        available: request.quantity <= 10n,
        availableQuantity: 10n,
        reason: 'discovery availability fixture',
        simulationOnly: true,
      }),
    );
  }

  /** Test hook — simulate provider down. */
  setSimulateDown(value: boolean): void {
    this.simulateDown = value;
    this.healthy = !value;
  }

  /** Test hook — simulate 429 rate limit. */
  setSimulate429(value: boolean): void {
    this.simulate429 = value;
  }
}

export type DiscoveryAccessProviderId = Extract<
  AccessProviderId,
  'gbfs_mobility' | 'travel_discovery' | 'experiences_discovery' | 'hotels_discovery' | 'transportation_discovery' | 'compute_discovery'
>;

export function createDiscoveryProvider(providerId: DiscoveryAccessProviderId): DiscoveryAccessProvider {
  return new DiscoveryAccessProvider(providerId);
}

export function createAllDiscoveryProviders(): readonly DiscoveryAccessProvider[] {
  return Object.freeze([
    createDiscoveryProvider('gbfs_mobility'),
    createDiscoveryProvider('travel_discovery'),
    createDiscoveryProvider('experiences_discovery'),
    createDiscoveryProvider('hotels_discovery'),
    createDiscoveryProvider('transportation_discovery'),
    createDiscoveryProvider('compute_discovery'),
  ]);
}
