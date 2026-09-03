// @ts-nocheck
/**
 * ACCESS-17 — Deterministic simulation world for canonical access redemption.
 *
 * Wires canonical owners behind one orchestration surface. Simulation only.
 */

import { FrozenClock } from '../../config/src/clock.ts';
import { asJurisdiction } from '../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { EvidenceVault } from '../../evidence/src/vault.ts';
import { DomainEventLog } from '../../events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../identity/src/simulation.ts';
import { ComplianceKernel } from '../../kernel/src/kernel.ts';
import { AuthorityIssuer } from '../../permissions/src/execution-authority.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
import {
  CapacityReservationEngine,
  DEFAULT_CONFIRMATION_TTL_MS,
  DEFAULT_HOLD_TTL_MS,
  InMemoryCapacitySource,
  InMemorySettlementIntentPort,
  PermissiveSimulationPolicy,
} from '../../access-fabric/src/index.ts';
import { AccessFabric } from '../../access-economy/src/service.ts';
import { AccessFabricService } from '../../sunrey-access/src/service.ts';
import { createCapacityAccessSandbox } from '../../sunrey-exchange/src/access-fabric/sandbox.ts';
import {
  ACCESS_FIXTURE_BLOCK_HEIGHT,
  ACCESS_FIXTURE_BLOCK_TIME,
  FIXTURE_OPERATOR_ACTOR,
  FIXTURE_TRAVELLER_ACTOR,
  provisionAccessChainFixture,
} from '../../sunrey-chain/src/access/fixtures.ts';
import {
  AccessProviderGateway,
  createAccessProviderGateway,
} from '../../access-economy/src/providers/gateway.ts';
import { InMemoryFundingIntentPort } from '../../access-economy/src/providers/funding-router.ts';

export const CANONICAL_REDEMPTION_NOW = asUtcInstant('2026-08-23T12:00:00.000Z');

export type CanonicalRedemptionSimulationWorld = Readonly<{
  readonly clock: FrozenClock;
  readonly evidence: EvidenceVault;
  readonly events: DomainEventLog;
  readonly issuer: AuthorityIssuer;
  readonly kernel: ComplianceKernel;
  readonly identity: SimulatedIdentityAdapter;
  readonly domain: AccessFabric;
  readonly scarcity: AccessFabricService;
  readonly capacityEngine: CapacityReservationEngine;
  readonly exchange: ReturnType<typeof createCapacityAccessSandbox>;
  readonly chain: ReturnType<typeof provisionAccessChainFixture>;
  readonly gateway: AccessProviderGateway;
  readonly funding: InMemoryFundingIntentPort;
}>;

export function createCanonicalRedemptionSimulationWorld(
  now: typeof CANONICAL_REDEMPTION_NOW = CANONICAL_REDEMPTION_NOW,
): CanonicalRedemptionSimulationWorld {
  const clock = new FrozenClock(now);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);
  const issuer = new AuthorityIssuer('access-17-redemption');
  const kernel = new ComplianceKernel(issuer, evidence, clock);
  const identity = new SimulatedIdentityAdapter({ clock, keys, events });
  identity.provisionSimulatedActor({
    actorId: 'actor_access_consumer',
    jurisdiction: asJurisdiction('GB'),
    identityId: 'identity_access_consumer',
    customerId: 'customer_access_consumer',
    capabilities: ['EXCHANGE_VIEW', 'EXCHANGE_OPERATE_REQUEST'] as never,
  });
  const capacitySource = new InMemoryCapacitySource();
  const settlement = new InMemorySettlementIntentPort();
  const capacityEngine = new CapacityReservationEngine({
    kernel,
    issuer,
    evidence,
    events,
    clock,
    identity: identity.service,
    capacitySource,
    policy: new PermissiveSimulationPolicy(),
    settlement,
    holdTtlMs: DEFAULT_HOLD_TTL_MS,
    confirmationTtlMs: DEFAULT_CONFIRMATION_TTL_MS,
  });
  const domain = new AccessFabric();
  const scarcity = new AccessFabricService({ clock });
  const exchange = createCapacityAccessSandbox(now);
  const chain = provisionAccessChainFixture(clock);
  const gateway = createAccessProviderGateway();
  const funding = new InMemoryFundingIntentPort();

  exchange.seedFiat('acct_buyer_usd', 5_000_000n);
  exchange.seedFiat('acct_reservation_pending_usd', 0n);

  return Object.freeze({
    clock,
    evidence,
    events,
    issuer,
    kernel,
    identity,
    domain,
    scarcity,
    capacityEngine,
    exchange,
    chain,
    gateway,
    funding,
  });
}

export const CANONICAL_CHAIN_ACTORS = Object.freeze({
  operator: FIXTURE_OPERATOR_ACTOR,
  traveller: FIXTURE_TRAVELLER_ACTOR,
  blockHeight: ACCESS_FIXTURE_BLOCK_HEIGHT,
  blockTime: ACCESS_FIXTURE_BLOCK_TIME,
});
