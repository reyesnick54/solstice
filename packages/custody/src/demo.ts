import { FrozenClock } from '../../config/src/clock.ts';
import { asCustomerId, type Customer } from '../../domain/src/customer.ts';
import { asJurisdiction, asResidency } from '../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { EvidenceVault } from '../../evidence/src/vault.ts';
import { DomainEventLog } from '../../events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../identity/src/simulation.ts';
import { ComplianceKernel } from '../../kernel/src/kernel.ts';
import { AssetQuantity } from '../../money/src/asset-quantity.ts';
import { AuthorityIssuer } from '../../permissions/src/execution-authority.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
import { SIMULATION_DIGITAL_CUSTODY_GB, SIMULATION_SOLSTICE_UK } from '../../sunrey-coin/src/simulation-catalog.ts';
import { SUNREY_COIN_ASSET_ID } from '../../sunrey-coin/src/ids.ts';
import { InMemoryCustomerAssetPort } from './asset-adapter.ts';
import { asCustodyAccountId } from './ids.ts';
import { KeyProviderTravelRuleProtection } from './protection.ts';
import { CustodyService } from './service.ts';
import {
  SimulationCustodyProvider,
  SimulationDestinationRiskProvider,
  SimulationTravelRuleNetwork,
  signSimulationNotice,
} from './simulation.ts';
import { GB_SIMULATION_TRAVEL_RULE_PACK } from './travel-rule.ts';

const NOW = asUtcInstant('2026-08-16T07:30:00.000Z');
const GB = asJurisdiction('GB');

function coins(whole: bigint): AssetQuantity {
  return AssetQuantity.fromScaledUnits(whole * 1_000_000n, SUNREY_COIN_ASSET_ID);
}

const clock = new FrozenClock(NOW);
const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
const events = new DomainEventLog();
const evidence = new EvidenceVault(clock);
const issuer = new AuthorityIssuer('custody-demo');
const kernel = new ComplianceKernel(issuer, evidence, clock);
const identity = new SimulatedIdentityAdapter({ clock, keys, events });
const customer: Customer = Object.freeze({
  id: asCustomerId('cust_demo_custody'),
  legalEntityId: SIMULATION_SOLSTICE_UK.id,
  jurisdiction: GB,
  residency: asResidency('GB'),
  status: 'ACTIVE',
  verification: {
    kycState: 'VERIFIED' as const,
    kycRecordVersion: 1,
    refreshBy: asUtcInstant('2027-08-16T07:30:00.000Z'),
  },
  createdAt: NOW,
  version: 1,
});
const assets = new InMemoryCustomerAssetPort();
const provider = new SimulationCustodyProvider();
const custody = new CustodyService({
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
  assets,
  provider,
  destinationRisk: new SimulationDestinationRiskProvider(),
  travelNetwork: new SimulationTravelRuleNetwork(),
  protection: new KeyProviderTravelRuleProtection(keys),
  pack: GB_SIMULATION_TRAVEL_RULE_PACK,
});

const actor = identity.provisionSimulatedActor({
  actorId: 'actor_custody_demo',
  jurisdiction: GB,
  identityId: 'id_custody_demo',
  customerId: customer.id,
  capabilities: ['CUSTODY_OPERATE_REQUEST', 'ADD_WITHDRAWAL_DESTINATION', 'SUNREY_COIN_VIEW'] as never,
  stepUp: true,
});
if (!actor.ok) {
  throw new Error(actor.error.message);
}

const custodyAccountId = asCustodyAccountId(customer.id);
provider.mapCustomerAddress('simaddr_demo_in', custodyAccountId, customer.id);
custody.registerAddress('simaddr_demo_in', customer.id, custodyAccountId);
const material = 'notice:demo1:simaddr_demo_in:5000000';
const ingested = custody.ingestExternalDeposit({
  material,
  signatureHex: signSimulationNotice(material),
  notice: {
    noticeId: 'demo1',
    providerId: 'SIMULATION_CUSTODY',
    signatureValid: true,
    assetId: SUNREY_COIN_ASSET_ID,
    quantity: coins(5n),
    destinationAddress: 'simaddr_demo_in',
    txRef: 'simtx_demo_in',
    confirmations: 6,
    receivedAt: NOW,
  },
});
if (ingested.outcome !== 'OK') {
  throw new Error('deposit notice failed');
}
const credited = custody.creditExternalDeposit({
  actorId: actor.value.actorId,
  depositId: ingested.value.depositId,
});
if (credited.outcome !== 'OK') {
  throw new Error('deposit credit failed');
}

const destination = custody.addDestination({
  actor: actor.value,
  customerId: customer.id,
  address: 'simaddr_vasp_clear',
  label: 'simulation counterparty',
});
if (destination.outcome !== 'OK') {
  throw new Error('destination failed');
}
const withdrawn = custody.initiateWithdrawal({
  actor: actor.value,
  customerId: customer.id,
  custodyAccountId,
  destinationId: destination.value.destinationId,
  quantity: coins(1n),
});
if (withdrawn.outcome !== 'OK' || withdrawn.value.state !== 'SETTLED') {
  throw new Error('happy-path withdrawal failed');
}

const risky = custody.addDestination({
  actor: actor.value,
  customerId: customer.id,
  address: 'simaddr_high-risk',
  label: 'blocked',
});
if (risky.outcome !== 'OK') {
  throw new Error('risky dest failed');
}
const blocked = custody.initiateWithdrawal({
  actor: actor.value,
  customerId: customer.id,
  custodyAccountId,
  destinationId: risky.value.destinationId,
  quantity: coins(1n),
});
if (blocked.outcome !== 'REJECTED') {
  throw new Error('high-risk destination must BLOCK');
}

const unknown = custody.initiateWithdrawal({
  actor: actor.value,
  customerId: customer.id,
  custodyAccountId,
  destinationId: destination.value.destinationId,
  quantity: coins(1n),
  timeoutAfterBroadcast: true,
});
if (unknown.outcome !== 'OK' || unknown.value.state !== 'SUBMISSION_UNKNOWN') {
  throw new Error('timeout must be SUBMISSION_UNKNOWN');
}
const recovered = custody.queryAndReconcileWithdrawal(unknown.value.withdrawalId);
if (recovered.outcome !== 'OK' || recovered.value.state !== 'MATCHED') {
  throw new Error('unknown withdrawal must query/reconcile without resubmit');
}

const recon = custody.reconcile();
if (recon.outcome !== 'MATCHED' || recon.autoCorrected !== false) {
  throw new Error('custody reconciliation must MATCHED without plug entries');
}

console.log('custody demo: ok');
console.log(`  deposit ${credited.value.depositId} credited via Kernel, not provider webhook`);
console.log(`  withdrawal ${withdrawn.value.withdrawalId} Travel Rule ${withdrawn.value.travelRule?.applicability}`);
console.log(`  high-risk destination BLOCK with no submission`);
console.log(`  timeout ${unknown.value.withdrawalId} → SUBMISSION_UNKNOWN → ${recovered.value.state}`);
console.log(`  reconciliation ${recon.outcome} autoCorrected=${recon.autoCorrected}`);
console.log('  simulation only; not Travel Rule compliant; not a licensed custodian');
