import { FrozenClock } from '../../../config/src/clock.ts';
import { asCustomerId, type Customer } from '../../../domain/src/customer.ts';
import { asJurisdiction, asResidency } from '../../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { EvidenceVault } from '../../../evidence/src/vault.ts';
import { DomainEventLog } from '../../../events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../../identity/src/simulation.ts';
import { ComplianceKernel } from '../../../kernel/src/kernel.ts';
import { AuthorityIssuer } from '../../../permissions/src/execution-authority.ts';
import { SUITE_SUNREY_ED25519_V1 } from '../../../security/src/crypto-suite.ts';
import { createDevelopmentHsmSimulator } from '../../../security/src/hsm-simulator.ts';
import { createSimulationKeyProvider } from '../../../security/src/simulation.ts';
import { SimulationNativeCustodyChain } from '../../../sunrey-chain/src/native-custody/simulation.ts';
import { SIMULATION_DIGITAL_CUSTODY_GB, SIMULATION_SOLSTICE_UK } from '../../../sunrey-coin/src/simulation-catalog.ts';
import { SimulationDestinationRiskProvider, SimulationTravelRuleNetwork } from '../simulation.ts';
import { GB_SIMULATION_TRAVEL_RULE_PACK } from '../travel-rule.ts';
import { InstitutionalCustodyService } from './service.ts';
import { HsmBackedSigningProvider, OfflineColdSigningProvider } from './signing.ts';

export const INSTITUTIONAL_NOW = asUtcInstant('2026-08-16T16:00:00.000Z');
const GB = asJurisdiction('GB');

export function institutionalCustomer(id: string): Customer {
  return Object.freeze({
    id: asCustomerId(id),
    legalEntityId: SIMULATION_SOLSTICE_UK.id,
    jurisdiction: GB,
    residency: asResidency('GB'),
    status: 'ACTIVE',
    verification: {
      kycState: 'VERIFIED' as const,
      kycRecordVersion: 1,
      refreshBy: asUtcInstant('2027-08-16T16:00:00.000Z'),
    },
    createdAt: INSTITUTIONAL_NOW,
    version: 1,
  });
}

export function createInstitutionalHarness(options?: {
  readonly unknownNext?: boolean;
  readonly offlineCold?: boolean;
}) {
  const clock = new FrozenClock(INSTITUTIONAL_NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);
  const issuer = new AuthorityIssuer('institutional-custody');
  const kernel = new ComplianceKernel(issuer, evidence, clock);
  const identity = new SimulatedIdentityAdapter({ clock, keys, events });
  const customers = new Map<string, Customer>();
  const chain = new SimulationNativeCustodyChain();
  if (options?.unknownNext) {
    chain.forceNextUnknown();
  }
  const hsm = createDevelopmentHsmSimulator();
  const remote = new HsmBackedSigningProvider('REMOTE_SIGNER', hsm);
  const signer = options?.offlineCold ? new OfflineColdSigningProvider(remote) : remote;
  const custody = new InstitutionalCustodyService({
    kernel,
    issuer,
    evidence,
    events,
    clock,
    identity: identity.service,
    catalog: {
      customers: { get: (id) => customers.get(id) },
      products: {
        get: (id) => (id === SIMULATION_DIGITAL_CUSTODY_GB.id ? SIMULATION_DIGITAL_CUSTODY_GB : undefined),
      },
      legalEntities: { get: (id) => (id === SIMULATION_SOLSTICE_UK.id ? SIMULATION_SOLSTICE_UK : undefined) },
    },
    chain,
    signer,
    destinationRisk: new SimulationDestinationRiskProvider(),
    travelNetwork: new SimulationTravelRuleNetwork(),
    pack: GB_SIMULATION_TRAVEL_RULE_PACK,
  });
  return { clock, events, evidence, identity, customers, chain, hsm, signer, custody, keys };
}

export function provisionInstitutionalActor(
  h: ReturnType<typeof createInstitutionalHarness>,
  actorId: string,
  identityId: string,
  customerId: string,
) {
  const customer = institutionalCustomer(customerId);
  h.customers.set(customer.id, customer);
  const result = h.identity.provisionSimulatedActor({
    actorId,
    jurisdiction: GB,
    identityId,
    customerId: customer.id,
    capabilities: ['CUSTODY_OPERATE_REQUEST', 'ADD_WITHDRAWAL_DESTINATION', 'SUNREY_COIN_VIEW'] as never,
    stepUp: true,
  });
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return { customer, actor: result.value };
}

export function createColdSigner(h: ReturnType<typeof createInstitutionalHarness>) {
  return new OfflineColdSigningProvider(new HsmBackedSigningProvider('HSM', h.hsm));
}

export const INSTITUTIONAL_SUITE = SUITE_SUNREY_ED25519_V1;
