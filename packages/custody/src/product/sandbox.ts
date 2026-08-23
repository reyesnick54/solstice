/**
 * Deterministic wallet sandbox. Simulation only.
 * Phase G Prompts 1–4 (Exchange / chain productization) attach via ports.
 */

import { FrozenClock } from '../../../config/src/clock.ts';
import type { Customer, CustomerId } from '../../../domain/src/customer.ts';
import { asCustomerId } from '../../../domain/src/customer.ts';
import { asJurisdiction, asResidency } from '../../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { EvidenceVault } from '../../../evidence/src/vault.ts';
import { DomainEventLog } from '../../../events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../../identity/src/simulation.ts';
import type { VerifiedActorContext } from '../../../identity/src/index.ts';
import { ComplianceKernel } from '../../../kernel/src/kernel.ts';
import { createBlockchainAnalyticsA } from '../../../kernel/src/compliance/provider-candidate/blockchain-analytics.ts';
import { AuthorityIssuer } from '../../../permissions/src/execution-authority.ts';
import { createSimulationKeyProvider } from '../../../security/src/simulation.ts';
import { SIMULATION_DIGITAL_CUSTODY_GB, SIMULATION_SOLSTICE_UK } from '../../../sunrey-coin/src/simulation-catalog.ts';
import { InMemoryCustomerAssetPort } from '../asset-adapter.ts';
import { KeyProviderTravelRuleProtection } from '../protection.ts';
import { CustodyService } from '../service.ts';
import {
  SIMULATION_COUNTERPARTY_VASP,
  SimulationCustodyProvider,
  SimulationDestinationRiskProvider,
} from '../simulation.ts';
import { GB_SIMULATION_TRAVEL_RULE_PACK } from '../travel-rule.ts';
import type { TravelRuleNetworkPort } from '../ports.ts';
import { WalletProductService, type WalletActorInput } from './service.ts';
import type { WalletProductOutcome } from './types.ts';

const NOW = asUtcInstant('2026-08-23T09:00:00.000Z');
const GB = asJurisdiction('GB');
const CAPS = [
  'CUSTODY_OPERATE_REQUEST',
  'ADD_WITHDRAWAL_DESTINATION',
  'POST_WITHDRAWAL_REQUEST',
  'SUNREY_COIN_VIEW',
  'EXCHANGE_VIEW',
] as const;

export const WALLET_SANDBOX_SCENARIOS = [
  'native_sunrey_deposit',
  'native_sunrey_withdrawal',
  'moonrey_transfer',
  'pending_confirmation',
  'invalid_destination',
  'high_risk_destination',
  'travel_rule_required',
  'custody_outage',
  'chain_outage',
  'failed_broadcast',
  'successful_finalization',
] as const;
export type WalletSandboxScenario = (typeof WALLET_SANDBOX_SCENARIOS)[number];

class ProductTravelRuleNetwork implements TravelRuleNetworkPort {
  readonly mode = 'SIMULATION_ONLY' as const;
  discoverCounterparty(address: string) {
    if (address.includes('vasp') || address.includes('trvl')) {
      return SIMULATION_COUNTERPARTY_VASP;
    }
    return null;
  }
  submit(): { readonly acknowledged: boolean } {
    return { acknowledged: true };
  }
}

function customer(id: string): Customer {
  return Object.freeze({
    id: asCustomerId(id),
    legalEntityId: SIMULATION_SOLSTICE_UK.id,
    jurisdiction: GB,
    residency: asResidency('GB'),
    status: 'ACTIVE',
    verification: {
      kycState: 'VERIFIED' as const,
      kycRecordVersion: 1,
      refreshBy: asUtcInstant('2027-08-23T09:00:00.000Z'),
    },
    createdAt: NOW,
    version: 1,
  });
}

export type WalletProductSandbox = {
  readonly product: WalletProductService;
  readonly custody: CustodyService;
  readonly assets: InMemoryCustomerAssetPort;
  readonly provider: SimulationCustodyProvider;
  readonly identity: SimulatedIdentityAdapter;
  readonly customers: Map<string, Customer>;
  actor(ownerId: string): WalletActorInput;
};

export function createWalletProductFromKernel(input: {
  readonly clock: FrozenClock | { now(): string };
  readonly kernel: ComplianceKernel;
  readonly issuer: AuthorityIssuer;
  readonly evidence: EvidenceVault;
  readonly events: DomainEventLog;
  readonly identity: SimulatedIdentityAdapter['service'] | ConstructorParameters<typeof CustodyService>[0]['identity'];
  readonly keyProvider: ReturnType<typeof createSimulationKeyProvider> | ConstructorParameters<typeof KeyProviderTravelRuleProtection>[0];
  readonly customers: { get(id: Customer['id'] | string): Customer | undefined };
  readonly chainAvailable?: boolean;
  readonly custodyAvailable?: boolean;
  readonly exchangeMismatch?: boolean;
}): { readonly product: WalletProductService; readonly assets: InMemoryCustomerAssetPort; readonly provider: SimulationCustodyProvider; readonly custody: CustodyService } {
  const assets = new InMemoryCustomerAssetPort();
  const provider = new SimulationCustodyProvider();
  const custody = new CustodyService({
    kernel: input.kernel,
    issuer: input.issuer,
    evidence: input.evidence,
    events: input.events,
    clock: input.clock as never,
    identity: input.identity,
    catalog: {
      customers: { get: (id) => input.customers.get(id) },
      products: {
        get: (id) => (String(id) === String(SIMULATION_DIGITAL_CUSTODY_GB.id) ? SIMULATION_DIGITAL_CUSTODY_GB : undefined),
      },
      legalEntities: { get: (id) => (String(id) === String(SIMULATION_SOLSTICE_UK.id) ? SIMULATION_SOLSTICE_UK : undefined) },
    },
    assets,
    provider,
    destinationRisk: new SimulationDestinationRiskProvider(),
    travelNetwork: new ProductTravelRuleNetwork(),
    protection: new KeyProviderTravelRuleProtection(input.keyProvider),
    pack: GB_SIMULATION_TRAVEL_RULE_PACK,
  });
  const product = new WalletProductService({
    clock: input.clock as never,
    custody,
    assets,
    analytics: createBlockchainAnalyticsA(),
    destinationRisk: new SimulationDestinationRiskProvider(),
    travelNetwork: new ProductTravelRuleNetwork(),
    pack: GB_SIMULATION_TRAVEL_RULE_PACK,
    registerProviderAddress: (address, custodyAccountId, customerId) => {
      provider.mapCustomerAddress(address, custodyAccountId, customerId);
    },
    hsmReady: false,
    chainAvailable: input.chainAvailable !== false,
    custodyAvailable: input.custodyAvailable !== false,
    exchangePositions: (ownerId, assetId) => {
      const available = assets.position(ownerId, assetId).available.scaledUnits;
      return input.exchangeMismatch === true ? available + 1n : available;
    },
  });
  return { product, assets, provider, custody };
}

export function createWalletProductSandbox(options: {
  readonly chainAvailable?: boolean;
  readonly custodyAvailable?: boolean;
  readonly exchangeMismatch?: boolean;
} = {}): WalletProductSandbox {
  const clock = new FrozenClock(NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);
  const issuer = new AuthorityIssuer('wallet-product-sandbox');
  const kernel = new ComplianceKernel(issuer, evidence, clock);
  const identity = new SimulatedIdentityAdapter({ clock, keys, events });
  const customers = new Map<string, Customer>();
  const wired = createWalletProductFromKernel({
    clock,
    kernel,
    issuer,
    evidence,
    events,
    identity: identity.service,
    keyProvider: keys,
    customers: { get: (id) => customers.get(id) },
    ...(options.chainAvailable !== undefined ? { chainAvailable: options.chainAvailable } : {}),
    ...(options.custodyAvailable !== undefined ? { custodyAvailable: options.custodyAvailable } : {}),
    ...(options.exchangeMismatch !== undefined ? { exchangeMismatch: options.exchangeMismatch } : {}),
  });
  return {
    product: wired.product,
    custody: wired.custody,
    assets: wired.assets,
    provider: wired.provider,
    identity,
    customers,
    actor(ownerId: string): WalletActorInput {
      const existing = identity.service.resolveActorContext(`actor_${ownerId}`);
      if (existing.ok) {
        return {
          actorId: existing.value.actorId,
          customerId: ownerId,
          verified: existing.value,
          stepUpSatisfied: true,
          originatedFromAgent: false,
        };
      }
      throw new Error(`sandbox actor missing for ${ownerId}`);
    },
  };
}

export function provisionSandboxOwner(sandbox: WalletProductSandbox, ownerId: string): VerifiedActorContext {
  const cust = customer(ownerId);
  sandbox.customers.set(cust.id, cust);
  const result = sandbox.identity.provisionSimulatedActor({
    actorId: `actor_${ownerId}`,
    jurisdiction: GB,
    identityId: `idn_${ownerId}`,
    customerId: cust.id,
    capabilities: [...CAPS] as never,
    stepUp: true,
  });
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.value;
}

export function runWalletSandboxScenario(
  scenario: WalletSandboxScenario,
): WalletProductOutcome<Record<string, unknown>> {
  const sandbox =
    scenario === 'custody_outage'
      ? createWalletProductSandbox({ custodyAvailable: false })
      : scenario === 'chain_outage'
        ? createWalletProductSandbox({ chainAvailable: false })
        : createWalletProductSandbox();
  const ownerId = `cust_${scenario}`;
  provisionSandboxOwner(sandbox, ownerId);
  const assetId = scenario === 'moonrey_transfer' ? 'MOONREY_COIN' : 'SUNREY_COIN';
  const wallet = sandbox.product.provisionWallet({
    walletId: `wal_${scenario}`,
    ownerId,
    assetId,
    custodyModel: 'SUNREY_NATIVE',
    seedMinorUnits: 5_000_000n,
  });
  if (!wallet.ok) {
    return wallet;
  }
  const actor = sandbox.actor(ownerId);
  const address = sandbox.product.depositAddress(ownerId, wallet.value.walletId);
  if (!address.ok) {
    return address;
  }

  switch (scenario) {
    case 'native_sunrey_deposit':
    case 'successful_finalization': {
      const deposit = sandbox.product.ingestDeposit({
        ownerId,
        walletId: wallet.value.walletId,
        amountMinorUnits: 1_000_000n,
        txRef: `tx_${scenario}`,
        confirmations: 6,
        nativeFinality: 'BFT_FINALIZED',
        actorId: actor.actorId,
      });
      if (!deposit.ok) {
        return deposit;
      }
      return {
        ok: true,
        value: { scenario, finality: deposit.value.finality, credited: deposit.value.finality === 'FINALIZED' },
      };
    }
    case 'pending_confirmation': {
      const deposit = sandbox.product.ingestDeposit({
        ownerId,
        walletId: wallet.value.walletId,
        amountMinorUnits: 1_000_000n,
        txRef: `tx_${scenario}`,
        confirmations: 0,
        nativeFinality: 'MEMPOOL',
        actorId: actor.actorId,
      });
      if (!deposit.ok) {
        return deposit;
      }
      return { ok: true, value: { scenario, finality: deposit.value.finality } };
    }
    case 'invalid_destination': {
      const quoted = sandbox.product.quoteWithdrawal(
        ownerId,
        wallet.value.walletId,
        { destination: 'bc1qwrongnetworkxxxxxxxx', amountMinorUnits: '100000', networkId: 'SUNREY_CHAIN' },
        actor,
      );
      return quoted.ok
        ? { ok: false, code: 'EXPECTED_INVALID', message: 'wrong-network address should fail' }
        : { ok: true, value: { scenario, refused: true, code: quoted.code } };
    }
    case 'high_risk_destination': {
      const quoted = sandbox.product.quoteWithdrawal(
        ownerId,
        wallet.value.walletId,
        { destination: 'sr1sanctioneddestxxxx', amountMinorUnits: '100000', networkId: 'SUNREY_CHAIN' },
        actor,
      );
      if (!quoted.ok) {
        return quoted;
      }
      const executed = sandbox.product.createWithdrawal(
        ownerId,
        wallet.value.walletId,
        { quoteId: quoted.value.quoteId, destination: 'sr1high-riskdestxxxx', amountMinorUnits: '100000' },
        actor,
      );
      return executed.ok
        ? { ok: false, code: 'EXPECTED_BLOCK', message: 'high-risk destination should fail before signing' }
        : { ok: true, value: { scenario, refused: true, code: executed.code } };
    }
    case 'travel_rule_required': {
      const quoted = sandbox.product.quoteWithdrawal(
        ownerId,
        wallet.value.walletId,
        { destination: 'sr1vaspcounterpartyxx', amountMinorUnits: '2000000', networkId: 'SUNREY_CHAIN' },
        actor,
      );
      if (!quoted.ok) {
        return quoted;
      }
      return {
        ok: true,
        value: {
          scenario,
          travelRule: quoted.value.travelRule,
          required: quoted.value.travelRuleRequired,
        },
      };
    }
    case 'custody_outage':
    case 'chain_outage': {
      const executed = sandbox.product.createWithdrawal(
        ownerId,
        wallet.value.walletId,
        { destination: address.value.address.replace(assetId === 'MOONREY_COIN' ? 'mr1' : 'sr1', assetId === 'MOONREY_COIN' ? 'mr1out' : 'sr1out'), amountMinorUnits: '100000' },
        actor,
      );
      return executed.ok
        ? { ok: false, code: 'EXPECTED_OUTAGE', message: 'outage should refuse execution' }
        : { ok: true, value: { scenario, refused: true, code: executed.code } };
    }
    case 'failed_broadcast': {
      const destination = assetId === 'MOONREY_COIN' ? 'mr1peerwalletxxxxxxxx' : 'sr1peerwalletxxxxxxxx';
      const executed = sandbox.product.createWithdrawal(
        ownerId,
        wallet.value.walletId,
        { destination, amountMinorUnits: '100000', forceFailedBroadcast: true },
        actor,
      );
      if (!executed.ok) {
        return executed;
      }
      return { ok: true, value: { scenario, finality: executed.value.finality } };
    }
    case 'native_sunrey_withdrawal':
    case 'moonrey_transfer': {
      const destination = assetId === 'MOONREY_COIN' ? 'mr1peerwalletxxxxxxxx' : 'sr1peerwalletxxxxxxxx';
      const executed = sandbox.product.createWithdrawal(
        ownerId,
        wallet.value.walletId,
        { destination, amountMinorUnits: '250000' },
        actor,
      );
      if (!executed.ok) {
        return executed;
      }
      return {
        ok: true,
        value: { scenario, finality: executed.value.finality, kind: assetId === 'MOONREY_COIN' ? 'TRANSFER' : 'WITHDRAWAL' },
      };
    }
    default:
      return { ok: false, code: 'UNKNOWN_SCENARIO', message: scenario };
  }
}

export { ProductTravelRuleNetwork };
