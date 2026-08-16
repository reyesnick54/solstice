import { FrozenClock } from '../../config/src/clock.ts';
import { asCustomerId, type Customer } from '../../domain/src/customer.ts';
import { asJurisdiction, asResidency } from '../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { EvidenceVault } from '../../evidence/src/vault.ts';
import { DomainEventLog } from '../../events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../identity/src/simulation.ts';
import { ComplianceKernel } from '../../kernel/src/kernel.ts';
import { AuthorityIssuer } from '../../permissions/src/execution-authority.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
import { SIMULATION_DIGITAL_CUSTODY_GB, SIMULATION_SOLSTICE_UK } from '../../sunrey-coin/src/simulation-catalog.ts';
import { InMemoryCoinPort, InMemoryFiatPort } from './adapters.ts';
import { SunReyExchangeService } from './service.ts';

const NOW = asUtcInstant('2026-08-16T08:40:00.000Z');
const GB = asJurisdiction('GB');
const clock = new FrozenClock(NOW);
const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
const events = new DomainEventLog();
const evidence = new EvidenceVault(clock);
const issuer = new AuthorityIssuer('listing-demo');
const kernel = new ComplianceKernel(issuer, evidence, clock);
const identity = new SimulatedIdentityAdapter({ clock, keys, events });
const customer: Customer = Object.freeze({
  id: asCustomerId('cust_listing_demo'),
  legalEntityId: SIMULATION_SOLSTICE_UK.id,
  jurisdiction: GB,
  residency: asResidency('GB'),
  status: 'ACTIVE',
  verification: {
    kycState: 'VERIFIED',
    kycRecordVersion: 1,
    refreshBy: asUtcInstant('2027-08-16T08:40:00.000Z'),
  },
  createdAt: NOW,
  version: 1,
});
const exchange = new SunReyExchangeService({
  kernel,
  issuer,
  evidence,
  events,
  clock,
  identity: identity.service,
  catalog: {
    customers: { get: (id) => (id === customer.id ? customer : undefined) },
    products: { get: (id) => (id === SIMULATION_DIGITAL_CUSTODY_GB.id ? SIMULATION_DIGITAL_CUSTODY_GB : undefined) },
    legalEntities: { get: (id) => (id === SIMULATION_SOLSTICE_UK.id ? SIMULATION_SOLSTICE_UK : undefined) },
  },
  coin: new InMemoryCoinPort(),
  fiat: new InMemoryFiatPort(),
});
const actor = identity.provisionSimulatedActor({
  actorId: 'actor_listing_demo',
  jurisdiction: GB,
  identityId: 'id_listing_demo',
  customerId: customer.id,
  capabilities: ['EXCHANGE_OPERATE_REQUEST', 'EXCHANGE_VIEW'] as never,
});
if (!actor.ok) {
  throw new Error(actor.error.message);
}
const decided = exchange.decideListing({
  actorId: actor.value.actorId,
  customerId: customer.id,
  listingId: 'listing:sunrey-coin',
  status: 'SIMULATION_LISTED',
  actorKind: 'HUMAN_OPERATOR',
});
if (decided.outcome !== 'OK' || decided.value.liveApproved !== false) {
  throw new Error('listing decision failed');
}
const ai = exchange.decideListing({
  actorId: actor.value.actorId,
  customerId: customer.id,
  listingId: 'listing:sunrey-coin',
  status: 'SUSPENDED',
  actorKind: 'AI',
});
if (ai.outcome !== 'REJECTED') {
  throw new Error('AI must not approve listings');
}
console.log('listing-governance demo: ok');
console.log(`  versioned decision v${decided.value.listingVersion} status=${decided.value.status}`);
console.log(`  RDT disposition ${decided.value.rdtDisposition}; legal ${decided.value.legalReviewState}`);
console.log('  no LIVE_APPROVED; AI cannot approve; simulation listing only');
