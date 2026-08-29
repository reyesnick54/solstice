/**
 * Canonical Access engine orchestration for the Consumer BFF adapter.
 *
 * Wires ACCESS-01 domain registration with ACCESS-06 scarcity intelligence.
 * Reservation, exchange clearing, and chain commitment remain in their
 * canonical owners; this runtime does not execute them.
 */

import { FrozenClock } from '../../config/src/clock.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { AccessFabric } from '../../access-economy/src/service.ts';
import {
  accessRegistryIntentIdFor,
  capacityRefFor,
} from '../../access-economy/src/registry-ids.ts';
import { AccessFabricService } from '../../sunrey-access/src/service.ts';
import { asAccessResourceId } from '../../sunrey-access/src/ids.ts';
import type { AccessCategory } from './taxonomy.ts';

const SIMULATION_NOW = asUtcInstant('2026-08-23T12:00:00.000Z');

export type CanonicalRuntimeCategory =
  | 'MOBILITY'
  | 'EXPERIENCES'
  | 'FOOD'
  | 'ENERGY'
  | 'COMPUTE'
  | 'ROBOTICS';

export function toCanonicalRuntimeCategory(category: AccessCategory): CanonicalRuntimeCategory {
  switch (category) {
    case 'MOBILITY':
    case 'TRAVEL':
      return 'MOBILITY';
    case 'STAY_HOUSING':
    case 'EXPERIENCES':
      return 'EXPERIENCES';
    case 'FOOD':
    case 'GOODS':
      return 'FOOD';
    case 'ENERGY':
      return 'ENERGY';
    case 'COMPUTE_AI':
      return 'COMPUTE';
    case 'ROBOTS_SERVICES':
      return 'ROBOTICS';
  }
}

export type CanonicalAccessRuntimeSnapshot = Readonly<{
  readonly domainIntents: number;
  readonly domainRights: number;
  readonly lastScarcityState: string | null;
}>;

export class CanonicalAccessRuntime {
  private readonly domain = new AccessFabric();
  private readonly scarcity = new AccessFabricService({ clock: new FrozenClock(SIMULATION_NOW) });
  private lastScarcityState: string | null = null;

  registerConsumerIntent(input: {
    readonly customerId: string;
    readonly summary: string;
    readonly category: CanonicalRuntimeCategory;
    readonly location?: string | null;
  }): { readonly domainIntentId: string; readonly scarcityState: string | null } {
    const capacityCategory =
      input.category === 'MOBILITY'
        ? 'VEHICLE_HOURS'
        : input.category === 'FOOD'
          ? 'FOOD'
          : input.category === 'ENERGY'
            ? 'ENERGY'
            : input.category === 'COMPUTE'
              ? 'COMPUTE'
              : input.category === 'ROBOTICS'
                ? 'ROBOTICS'
                : 'EXPERIENCES';

    const intentId = accessRegistryIntentIdFor(`${input.customerId}-${Date.now()}`);
    this.domain.proposeIntent({
      id: intentId,
      kind: 'REQUEST',
      subjectRef: input.customerId,
      capacityRef: capacityRefFor(`${input.category}-${input.location ?? 'global'}`),
      category: capacityCategory,
      bounds: [{ kind: 'TIME', notBefore: SIMULATION_NOW, notAfter: asUtcInstant('2026-09-15T00:00:00.000Z') }],
      purposeRef: 'consumer_access_request',
      proposedAt: SIMULATION_NOW,
    });

    const capacity = this.scarcity.buildCapacity({
      resourceId: asAccessResourceId(`sim-${input.category}-${input.location ?? 'global'}`),
      availableUnits: input.summary.toLowerCase().includes('mustang') ? 120n : 12n,
      totalUnits: input.summary.toLowerCase().includes('mustang') ? 200n : 20n,
      evidenceRefs: ['simulation-fixture'],
      locationCode: input.location ?? 'SIMULATION',
      qualityTier: input.summary.toLowerCase().includes('premium') ? 'PREMIUM' : 'STANDARD',
    });

    const allocation = this.scarcity.quoteAndAllocate({
      request: {
        requestId: `req_${intentId}`,
        subjectRef: input.customerId,
        resourceId: capacity.resourceId,
        requestedUnits: 1n,
        jurisdiction: 'SIMULATION',
        productCode: `ACCESS_${input.category}`,
      },
      capacity,
    });

    this.lastScarcityState = allocation.ok ? allocation.value.quote.scarcity.band : 'REFUSED';
    return { domainIntentId: intentId, scarcityState: this.lastScarcityState };
  }

  snapshot(): CanonicalAccessRuntimeSnapshot {
    const view = this.domain.snapshot();
    return Object.freeze({
      domainIntents: view.intents.length,
      domainRights: view.rights.length,
      lastScarcityState: this.lastScarcityState,
    });
  }
}

export function createCanonicalAccessRuntime(): CanonicalAccessRuntime {
  return new CanonicalAccessRuntime();
}
