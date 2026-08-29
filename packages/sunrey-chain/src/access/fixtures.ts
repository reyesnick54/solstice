import { FrozenClock } from '../../../config/src/clock.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { EvidenceVault } from '../../../evidence/src/vault.ts';
import { DomainEventLog } from '../../../events/src/events.ts';
import { createSimulationKeyProvider } from '../../../security/src/simulation.ts';
import type { ProductiveEconomicObject } from '../productive/objects.ts';
import type { ActorDescriptor } from '../protocol/actor.ts';
import { SunReyChainService } from '../service.ts';
import {
  createInMemoryActorRegistryPort,
  createInMemoryProductiveObjectPort,
  createInMemorySettlementEvidencePort,
  type AccessChainPorts,
} from './ports.ts';
import { AccessRightsChainService } from './service.ts';
import { ACCESS_CAPABILITY_REFS } from './taxonomy.ts';
import type { AccessReferenceSet, AccessSubjectScope } from './types.ts';

export const ACCESS_FIXTURE_NOW = asUtcInstant('2026-08-29T09:00:00.000Z');
export const ACCESS_FIXTURE_BLOCK_HEIGHT = 4200;
/** 2026-08-29T09:00:00Z */
export const ACCESS_FIXTURE_BLOCK_TIME = 1787043600n;
export const ACCESS_FIXTURE_RIGHT_EXPIRY = ACCESS_FIXTURE_BLOCK_TIME + 2_592_000n;

export const FIXTURE_PRODUCTIVE_OBJECT_ID = 'peo_transit_fleet_north';
export const FIXTURE_INACTIVE_OBJECT_ID = 'peo_retired_depot';

export const FIXTURE_OPERATOR_ACTOR = 'act_fleet_operator';
export const FIXTURE_TRAVELLER_ACTOR = 'act_traveller_agent';
export const FIXTURE_ATTESTOR_ACTOR = 'act_delivery_attestor';
export const FIXTURE_TREASURY_ACTOR = 'act_settlement_recorder';
export const FIXTURE_OUTSIDER_ACTOR = 'act_unrelated_marketplace';
export const FIXTURE_REVOKED_ACTOR = 'act_suspended_operator';

export const FIXTURE_SETTLEMENT = Object.freeze({
  journalId: 'jrn_access_delivery_0001',
  transferId: 'trf_access_delivery_0001',
  assetCommitment: 'asset_commitment_access_delivery_0001',
});

function productiveObject(input: {
  readonly objectId: string;
  readonly status: ProductiveEconomicObject['status'];
  readonly expirationHeight: number | null;
}): ProductiveEconomicObject {
  return {
    schemaVersion: 1,
    objectId: input.objectId,
    category: 'LOGISTICS_TRANSPORTATION',
    owner: 'leg_northern_transit_authority',
    controller: 'leg_northern_transit_authority',
    operator: FIXTURE_OPERATOR_ACTOR,
    geography: { geographyId: 'grid_ne_01', jurisdiction: 'GB-NE' },
    rightsReference: 'rights_registry:northern_transit',
    oracleFeedReferences: ['feed_transit_capacity_v1'],
    unitSchema: 'seat_hour',
    capacityMetadata: { schedule: 'fixed', measurement: 'seat_hour' },
    provenance: 'registry:northern_transit',
    status: input.status,
    activationHeight: 1,
    expirationHeight: input.expirationHeight,
    validFromUnixSeconds: 1_700_000_000n,
    validUntilUnixSeconds: null,
  };
}

function actor(input: {
  readonly actorId: string;
  readonly capabilityRefs: readonly string[];
  readonly revoked?: boolean;
}): ActorDescriptor {
  return {
    schemaVersion: 1,
    actorId: input.actorId,
    actorType: 'ENTERPRISE',
    ownerControllerId: 'leg_northern_transit_authority',
    credentialRefs: [`cred_${input.actorId}`],
    capabilityRefs: input.capabilityRefs,
    modelFirmwareRef: '',
    jurisdiction: 'GB',
    revocationState: input.revoked === true ? 'REVOKED' : 'ACTIVE',
    identitySystemRef: 'packages/identity',
  };
}

export function accessFixturePorts(): AccessChainPorts {
  return {
    productiveObjects: createInMemoryProductiveObjectPort([
      productiveObject({
        objectId: FIXTURE_PRODUCTIVE_OBJECT_ID,
        status: 'ACTIVE',
        expirationHeight: null,
      }),
      productiveObject({
        objectId: FIXTURE_INACTIVE_OBJECT_ID,
        status: 'SUSPENDED',
        expirationHeight: 10,
      }),
    ]),
    actors: createInMemoryActorRegistryPort({
      actors: [
        actor({
          actorId: FIXTURE_OPERATOR_ACTOR,
          capabilityRefs: [
            ACCESS_CAPABILITY_REFS.ISSUE_RIGHT,
            ACCESS_CAPABILITY_REFS.REVOKE_RIGHT,
            ACCESS_CAPABILITY_REFS.CONFIRM_RESERVATION,
          ],
        }),
        actor({
          actorId: FIXTURE_TRAVELLER_ACTOR,
          capabilityRefs: [
            ACCESS_CAPABILITY_REFS.COMMIT_RESERVATION,
            ACCESS_CAPABILITY_REFS.COMMIT_USAGE,
          ],
        }),
        actor({
          actorId: FIXTURE_ATTESTOR_ACTOR,
          capabilityRefs: [ACCESS_CAPABILITY_REFS.ATTEST_DELIVERY],
        }),
        actor({
          actorId: FIXTURE_TREASURY_ACTOR,
          capabilityRefs: [ACCESS_CAPABILITY_REFS.REFERENCE_SETTLEMENT],
        }),
        actor({
          actorId: FIXTURE_OUTSIDER_ACTOR,
          capabilityRefs: [ACCESS_CAPABILITY_REFS.ISSUE_RIGHT],
        }),
        actor({
          actorId: FIXTURE_REVOKED_ACTOR,
          capabilityRefs: [ACCESS_CAPABILITY_REFS.ISSUE_RIGHT],
          revoked: true,
        }),
      ],
      rightsAuthorities: {
        [FIXTURE_PRODUCTIVE_OBJECT_ID]: [FIXTURE_OPERATOR_ACTOR, FIXTURE_REVOKED_ACTOR],
        [FIXTURE_INACTIVE_OBJECT_ID]: [FIXTURE_OPERATOR_ACTOR],
      },
    }),
    settlement: createInMemorySettlementEvidencePort([FIXTURE_SETTLEMENT]),
  };
}

export function createSimulationChain(clock = new FrozenClock(ACCESS_FIXTURE_NOW)): SunReyChainService {
  return new SunReyChainService({
    clock,
    keys: createSimulationKeyProvider({ clock: { now: () => clock.now() } }),
    evidence: new EvidenceVault(clock),
    events: new DomainEventLog(),
  });
}

export function provisionAccessChainFixture(clock = new FrozenClock(ACCESS_FIXTURE_NOW)) {
  const chain = createSimulationChain(clock);
  const ports = accessFixturePorts();
  const access = new AccessRightsChainService({ chain, clock, ports });
  return { chain, ports, access, clock };
}

export type AccessChainFixture = ReturnType<typeof provisionAccessChainFixture>;

export const FIXTURE_HOLDER: AccessSubjectScope = Object.freeze({
  rawSubjectId: 'sub_synthetic_traveller',
  recipientContext: 'sunrey-access-fabric',
  purpose: 'sunrey.access.right.hold',
  jurisdictionCell: 'GB-NE',
  keyVersion: 1,
});

export const FIXTURE_REFERENCES: AccessReferenceSet = Object.freeze({
  policyRef: 'policy:access.transit.v1',
  consentRef: 'consent:access.transit.v1',
  provenanceRef: 'provenance:northern_transit.v1',
  agreementRef: 'agreement:access.transit.v1',
});

export function accessRightRequest(overrides: Record<string, unknown> = {}) {
  return {
    rightId: 'arg_transit_seat_hours_0001',
    rightClass: 'ACCESS' as const,
    issuerActorRef: FIXTURE_OPERATOR_ACTOR,
    holder: FIXTURE_HOLDER,
    target: {
      productiveObjectId: FIXTURE_PRODUCTIVE_OBJECT_ID,
      capacityUnit: 'seat_hour',
      capacityQuantity: 40n,
      geographyRef: 'grid_ne_01',
    },
    scopeLabel: 'northern-regional-transit',
    purpose: 'sunrey.access.right.grant',
    permittedOperations: ['BOARD', 'OCCUPY_SEAT'],
    restrictionLabels: ['off-peak-only'],
    references: FIXTURE_REFERENCES,
    jurisdictionCell: 'GB-NE',
    validFromUnixSeconds: ACCESS_FIXTURE_BLOCK_TIME,
    expiresAtUnixSeconds: ACCESS_FIXTURE_RIGHT_EXPIRY,
    transferable: false,
    blockTimeUnixSeconds: ACCESS_FIXTURE_BLOCK_TIME,
    blockHeight: ACCESS_FIXTURE_BLOCK_HEIGHT,
    ...overrides,
  };
}

export function reservationRequest(overrides: Record<string, unknown> = {}) {
  return {
    reservationId: 'ars_transit_0001',
    rightId: 'arg_transit_seat_hours_0001',
    requestingActorRef: FIXTURE_TRAVELLER_ACTOR,
    quantity: 4n,
    startsAtUnixSeconds: ACCESS_FIXTURE_BLOCK_TIME + 3_600n,
    endsAtUnixSeconds: ACCESS_FIXTURE_BLOCK_TIME + 18_000n,
    holdExpiresAtUnixSeconds: ACCESS_FIXTURE_BLOCK_TIME + 1_800n,
    purpose: 'sunrey.access.reservation.hold',
    policyRef: 'policy:access.transit.v1',
    blockTimeUnixSeconds: ACCESS_FIXTURE_BLOCK_TIME,
    blockHeight: ACCESS_FIXTURE_BLOCK_HEIGHT,
    ...overrides,
  };
}

export function unwrapAccess<T>(
  result:
    | { readonly ok: true; readonly value: T }
    | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } },
): T {
  if (!result.ok) {
    throw new Error(`${result.error.code}: ${result.error.message}`);
  }
  return result.value;
}
