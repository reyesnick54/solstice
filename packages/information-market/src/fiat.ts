import { randomUUID } from 'node:crypto';

import type { Clock } from '../../config/src/clock.ts';
import { asAccountId, openAccount, type Account } from '../../domain/src/account.ts';
import { asCustomerId, type Customer } from '../../domain/src/customer.ts';
import { asCurrencyCode } from '../../domain/src/currency.ts';
import { asJurisdiction } from '../../domain/src/jurisdiction.ts';
import { asLegalEntityId, freezeLegalEntity } from '../../domain/src/legal-entity.ts';
import { asProductId, freezeProduct, type Product } from '../../domain/src/product.ts';
import { isOk } from '../../domain/src/result.ts';
import type { IdentityService } from '../../identity/src/service.ts';
import { actionTypesFromCapabilities } from '../../identity/src/capability.ts';
import { ComplianceKernel } from '../../kernel/src/kernel.ts';
import type { KernelFacts } from '../../kernel/src/proofs.ts';
import { Ledger } from '../../ledger/src/journal.ts';
import { SIMULATED_FUNDING_TO_DEMAND_DEPOSIT, SIMULATION_FUNDING_SOURCE_ID } from '../../ledger/src/types.ts';
import { asIntentId } from '../../permissions/src/action-intent.ts';
import { ACTION_TYPES } from '../../permissions/src/action-types.ts';
import { AuthorityIssuer } from '../../permissions/src/execution-authority.ts';
import { validateIntentStructure } from '../../permissions/src/structural.ts';
import { EvidenceVault } from '../../evidence/src/vault.ts';
import { DomainEventLog } from '../../events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../identity/src/simulation.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
import type { FiatCompensationPort } from './types.ts';

export const SIMULATION_SOLSTICE_UK = freezeLegalEntity({
  id: asLegalEntityId('le_solstice_uk_ltd'),
  name: 'Solstice UK Ltd (simulation)',
  jurisdiction: asJurisdiction('GB'),
  status: 'ACTIVE',
});

export const SIMULATION_DEMAND_USD_GB = freezeProduct({
  id: asProductId('prod_demand_usd_gb'),
  name: 'Simulated GBP-entity USD demand deposit',
  accountClass: 'DEMAND_DEPOSIT',
  currency: asCurrencyCode('USD'),
  legalEntityId: SIMULATION_SOLSTICE_UK.id,
  jurisdiction: asJurisdiction('GB'),
  status: 'ACTIVE',
});

export type SimulationFiatPortOptions = {
  readonly kernel: ComplianceKernel;
  readonly issuer: AuthorityIssuer;
  readonly ledger: Ledger;
  readonly identity: IdentityService;
  readonly clock: Clock;
  readonly customers: Map<string, Customer>;
};

export function createSimulationFiatPort(options: SimulationFiatPortOptions): FiatCompensationPort {
  const products = new Map<string, Product>([[SIMULATION_DEMAND_USD_GB.id, SIMULATION_DEMAND_USD_GB]]);
  const accounts = new Map<string, Account>();
  const catalog = {
    products: {
      get: (id: string) => products.get(id),
      list: () => [...products.values()],
    },
    legalEntities: { get: (id: string) => (id === SIMULATION_SOLSTICE_UK.id ? SIMULATION_SOLSTICE_UK : undefined) },
    accounts: { get: (id: string) => accounts.get(id) },
  };

  function authorize(actorId: string, actionType: typeof ACTION_TYPES.OPEN_ACCOUNT | typeof ACTION_TYPES.POST_DEPOSIT, payload: Record<string, unknown>, customerId: string) {
    const resolved = options.identity.resolveActorContext(actorId);
    const customer = options.customers.get(customerId);
    const intent = {
      id: asIntentId(`intent_${randomUUID()}`),
      actionType,
      payload,
      idempotencyKey: `im.fiat.${actionType}.${randomUUID()}`,
      actorId,
      requestedAt: options.clock.now(),
      purpose: actionType === ACTION_TYPES.OPEN_ACCOUNT ? ('CUSTOMER_ONBOARDING' as const) : ('CUSTOMER_FUNDING' as const),
    };
    const facts: KernelFacts = {
      actor: {
        id: actorId,
        capabilities: resolved.ok ? actionTypesFromCapabilities(resolved.value.authorizedCapabilities) : [],
      },
      identity: options.identity.identityFactsFor(actorId),
      ...(customer ? { customer } : {}),
      legalEntity: SIMULATION_SOLSTICE_UK,
      product: SIMULATION_DEMAND_USD_GB,
      jurisdiction: SIMULATION_DEMAND_USD_GB.jurisdiction,
    };
    const decision = options.kernel.submit(intent, facts);
    if (decision.status !== 'ALLOW' || !decision.executionAuthority) {
      return { outcome: 'REJECTED' as const, code: decision.status, message: `kernel ${decision.status}`, intent };
    }
    const structural = validateIntentStructure(intent as never, catalog);
    if (!isOk(structural)) {
      return { outcome: 'REJECTED' as const, code: structural.error.code, message: structural.error.message, intent };
    }
    const verified = options.issuer.verify(
      decision.executionAuthority,
      {
        actionType: intent.actionType,
        accountId: String(payload.accountId ?? intent.id),
        intentId: intent.id,
      },
      options.clock,
    );
    if (!isOk(verified)) {
      return { outcome: 'REJECTED' as const, code: verified.error.code, message: verified.error.message, intent };
    }
    return { outcome: 'ALLOWED' as const, authority: verified.value, intent };
  }

  return {
    creditParticipant(input) {
      const accountId = asAccountId(input.participantAccountId);
      if (!options.ledger.accounts.has(accountId)) {
        const opened = authorize(
          input.actorId,
          ACTION_TYPES.OPEN_ACCOUNT,
          {
            accountId,
            ownerId: asCustomerId(input.customerId),
            accountClass: 'DEMAND_DEPOSIT',
            productId: SIMULATION_DEMAND_USD_GB.id,
            legalEntityId: SIMULATION_SOLSTICE_UK.id,
            jurisdiction: SIMULATION_DEMAND_USD_GB.jurisdiction,
            currency: SIMULATION_DEMAND_USD_GB.currency,
          },
          input.customerId,
        );
        if (opened.outcome !== 'ALLOWED') {
          return { outcome: 'REJECTED', code: opened.code, message: opened.message };
        }
        const executionAuthority = opened.authority;
        const account = openAccount(executionAuthority, {
          id: accountId,
          ownerId: asCustomerId(input.customerId),
          accountClass: 'DEMAND_DEPOSIT',
          productId: SIMULATION_DEMAND_USD_GB.id,
          legalEntityId: SIMULATION_SOLSTICE_UK.id,
          jurisdiction: SIMULATION_DEMAND_USD_GB.jurisdiction,
          currency: SIMULATION_DEMAND_USD_GB.currency,
          openedAt: options.clock.now(),
        });
        if (!account.ok) {
          return { outcome: 'REJECTED', code: account.error.code, message: account.error.message };
        }
        options.ledger.accounts.registerOpenedAccount(account.value);
        accounts.set(account.value.id, account.value);
      }
      const gated = authorize(
        input.actorId,
        ACTION_TYPES.POST_DEPOSIT,
        { accountId, amount: input.amount },
        input.customerId,
      );
      if (gated.outcome !== 'ALLOWED') {
        return { outcome: 'REJECTED', code: gated.code, message: gated.message };
      }
      const journal = options.ledger.postJournal({
        idempotencyKey: gated.intent.idempotencyKey,
        executionAuthority: gated.authority,
        actionType: gated.intent.actionType,
        classBridge: SIMULATED_FUNDING_TO_DEMAND_DEPOSIT,
        memo: `information-market fiat compensation ${input.contributionId}`,
        postings: [
          { accountId: SIMULATION_FUNDING_SOURCE_ID, direction: 'DEBIT', amount: input.amount },
          { accountId, direction: 'CREDIT', amount: input.amount },
        ],
      });
      return { outcome: 'OK', intentId: gated.intent.id, journalId: journal.id };
    },
  };
}

export function createSandboxSimulationFiatPort(clock: Clock): FiatCompensationPort {
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);
  const issuer = new AuthorityIssuer('information-market-sandbox');
  const kernel = new ComplianceKernel(issuer, evidence, clock);
  const identity = new SimulatedIdentityAdapter({ clock, keys, events });
  const ledger = new Ledger(issuer, clock);
  const customers = new Map<string, Customer>();
  return createSimulationFiatPort({
    kernel,
    issuer,
    ledger,
    identity: identity.service,
    clock,
    customers,
  });
}
