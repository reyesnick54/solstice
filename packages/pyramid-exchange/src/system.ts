import {
  asAccountId,
  asActionIntentId,
  asActorId,
  asCurrencyCode,
  asCustomerId,
  asIdempotencyKey,
  asUtcInstant,
  createAccount,
  createProspect,
  err,
  ok,
  type AccountId,
  type Actor,
  type CustomerId,
  type Result,
  type UtcInstant,
  Money,
  notStartedVerification,
} from '@solstice/domain';
import {
  asJurisdiction,
  asLegalEntityId,
  asResidency,
} from '@solstice/domain';
import {
  ComplianceKernel,
  freezeIntent,
  type KernelAuthorization,
  type KernelDecision,
} from '@solstice/kernel';
import { LIVE_EXCHANGE_ENABLED } from '@solstice/flags';
import { commitJournal, JournalStore, LedgerBooks, type Journal } from '@solstice/ledger';
import { SimulatedPyrCustody } from './custody.ts';
import { ComplianceGateway, type GatewayClearance, type GatewayRefusal, type OrderRequest } from './gateway.ts';
import { KillSwitchBoard, type KillSwitchId } from './kill-switch.ts';
import { MarketDataService } from './market-data.ts';
import { MatchingEngine, type MatchResult } from './matching.ts';
import { ReconciliationEngine, type ReconciliationHalt, type ReconciliationOk } from './reconciliation.ts';
import { JurisdictionalAssetRegistry } from './registry.ts';
import { runManipulationReplay, type ReplayResult } from './replay.ts';
import { SurveillanceDesk, runAllDetectors, type SurveillanceAlert } from './surveillance.ts';
import { convertFiatToPyr, FIAT_BRIDGE_CLASS } from './fiat.ts';
import { submitDigitalAssetTransfer } from './travel-rule.ts';
import {
  feeQuoteMinor,
  notionalQuoteMinor,
  PYR_USD,
  type AssetCapability,
  type EligibleCustomer,
  type Fill,
  type Order,
} from './types.ts';

export type PlaceResult = {
  readonly gateway: GatewayClearance;
  readonly match: MatchResult;
  readonly journals: readonly Journal[];
  readonly fills: readonly Fill[];
};

export class PyramidExchangeSystem {
  readonly kernel: ComplianceKernel;
  readonly registry = new JurisdictionalAssetRegistry();
  readonly kills = new KillSwitchBoard();
  readonly books = new LedgerBooks(new JournalStore());
  readonly engine: MatchingEngine;
  readonly marketData: MarketDataService;
  readonly gateway: ComplianceGateway;
  readonly custody: SimulatedPyrCustody;
  readonly recon: ReconciliationEngine;
  readonly surveillance = new SurveillanceDesk();
  readonly now: UtcInstant;
  readonly seed: string;
  readonly operator: Actor = { type: 'OPERATOR', id: asActorId('exchange_operator') };
  readonly systemActor: Actor = { type: 'SYSTEM', id: asActorId('exchange_system') };
  #seq = 0;
  readonly #traderIds: CustomerId[] = [];

  constructor(seed = 'pyramid-exchange-sim-v1', now = asUtcInstant('2026-08-14T12:00:00.000Z')) {
    if (LIVE_EXCHANGE_ENABLED !== false) {
      throw new Error('LIVE_EXCHANGE_ENABLED must stay false');
    }
    this.seed = seed;
    this.now = now;
    this.kernel = new ComplianceKernel(undefined, { exchangeRegistry: this.registry });
    this.engine = new MatchingEngine(seed);
    this.marketData = new MarketDataService(this.engine);
    this.gateway = new ComplianceGateway(this.kernel, this.registry, this.kills);
    this.custody = new SimulatedPyrCustody(this.books, (customerId, asset) => this.accountId(customerId, asset));
    this.recon = new ReconciliationEngine({
      engine: this.engine,
      custody: this.custody,
      kills: this.kills,
      vault: this.kernel.vault,
      customers: () => this.#traderIds,
    });
  }

  nextId(prefix: string): string {
    this.#seq += 1;
    return `${prefix}_${this.#seq.toString().padStart(4, '0')}`;
  }

  accountId(customerId: CustomerId | 'HOUSE', asset: string): AccountId {
    if (customerId === 'HOUSE') {
      if (asset === 'USD' || asset === 'EUR' || asset === 'GBP') {
        return asAccountId(`house_${asset}_nostro`);
      }
      if (asset === 'FEE') return asAccountId('house_fee_USD');
      return asAccountId(`house_${asset}_digital`);
    }
    return asAccountId(`${customerId}_${asset}`);
  }

  bootstrapHouse(): void {
    for (const currency of ['USD', 'EUR', 'GBP', 'PYR'] as const) {
      const className = currency === 'PYR' ? 'digital_assets' : 'house_nostro';
      this.#open(this.accountId('HOUSE', currency), 'HOUSE', currency, className);
    }
    this.#open(this.accountId('HOUSE', 'FEE'), 'HOUSE', 'USD', 'house_fee');
  }

  registerTrader(input: {
    readonly customerId: string;
    readonly name: string;
    readonly jurisdiction: string;
    readonly usd?: bigint;
    readonly pyr?: bigint;
    readonly perOrderLimit?: bigint;
  }): EligibleCustomer {
    const customerId = asCustomerId(input.customerId);
    const created = this.kernel.evaluate(
      freezeIntent({
        id: asActionIntentId(this.nextId('int')),
        kind: 'CREATE_CUSTOMER',
        actor: this.systemActor,
        payload: {
          id: customerId,
          legalEntityId: asLegalEntityId('le_exchange'),
          jurisdiction: asJurisdiction(input.jurisdiction),
          residency: asResidency(input.jurisdiction),
          verification: notStartedVerification(asUtcInstant('2027-01-01T00:00:00.000Z')),
          createdAt: this.now,
        },
        idempotencyKey: asIdempotencyKey(`cust_${customerId}`),
        occurredAt: this.now,
        sourceJurisdiction: input.jurisdiction,
      }),
    );
    if (created.ok && created.value.outcome === 'AUTHORIZED') {
      this.books.putCustomer(
        created.value.authorization,
        createProspect({
          id: customerId,
          legalEntityId: asLegalEntityId('le_exchange'),
          jurisdiction: asJurisdiction(input.jurisdiction),
          residency: asResidency(input.jurisdiction),
          verification: notStartedVerification(asUtcInstant('2027-01-01T00:00:00.000Z')),
          createdAt: this.now,
        }),
      );
    }
    this.#open(this.accountId(customerId, 'USD'), customerId, 'USD', 'deposits');
    this.#open(this.accountId(customerId, 'PYR'), customerId, 'PYR', 'digital_assets');
    if (input.usd && input.usd > 0n) {
      this.#seed(this.accountId(customerId, 'USD'), Money.of(input.usd, 'USD'));
    }
    if (input.pyr && input.pyr > 0n) {
      this.#seed(this.accountId(customerId, 'PYR'), Money.of(input.pyr, 'PYR'));
    }
    const eligible: EligibleCustomer = Object.freeze({
      customerId,
      name: input.name,
      jurisdiction: input.jurisdiction,
      eligible: true,
      perOrderLimit: input.perOrderLimit ?? 1_000_000n,
    });
    this.gateway.registerCustomer(eligible);
    this.#traderIds.push(customerId);
    return eligible;
  }

  approveListing(input: {
    readonly jurisdiction: string;
    readonly capabilities: readonly AssetCapability[];
    readonly reason: string;
  }) {
    const intent = freezeIntent({
      id: asActionIntentId(this.nextId('int')),
      kind: 'APPROVE_LISTING',
      actor: this.operator,
      payload: {
        assetId: 'PYR',
        pair: PYR_USD.symbol,
        jurisdiction: input.jurisdiction,
        approvalReason: input.reason,
        legalReviewState: 'DRAFT',
        capabilities: input.capabilities,
      },
      idempotencyKey: asIdempotencyKey(`list_${input.jurisdiction}_${this.#seq}`),
      occurredAt: this.now,
      sourceJurisdiction: input.jurisdiction,
    });
    const evaluated = this.kernel.evaluate(intent);
    if (!evaluated.ok || evaluated.value.outcome !== 'AUTHORIZED') {
      throw new Error('listing approval was not authorized');
    }
    return this.registry.recordListingApproval(evaluated.value.authorization, {
      jurisdiction: input.jurisdiction,
      pair: PYR_USD,
      reason: input.reason,
      approvedBy: this.operator.id,
      approvedAt: this.now,
      evidenceId: String(evaluated.value.evidence.id),
      legalReviewState: 'DRAFT',
      capabilities: input.capabilities,
    });
  }

  place(request: Omit<OrderRequest, 'occurredAt' | 'actor'> & { readonly actor?: Actor }): Result<PlaceResult, GatewayRefusal> {
    const submitted = this.gateway.submit({
      ...request,
      actor: request.actor ?? this.operator,
      occurredAt: this.now,
      sequence: request.sequence ?? this.#seq + 1,
    });
    if (!submitted.ok) {
      return submitted;
    }
    const match = this.engine.accept(submitted.value.cleared);
    this.marketData.recordFills(match.fills);
    const journals: Journal[] = [];
    if (submitted.value.decision.outcome === 'AUTHORIZED') {
      for (const fill of match.fills) {
        const posted = this.#postFill(submitted.value.decision.authorization, fill);
        if (posted) journals.push(posted);
      }
    }
    return ok({
      gateway: submitted.value,
      match,
      journals,
      fills: match.fills,
    });
  }

  scan(groups: Readonly<Record<string, string>> = {}): readonly SurveillanceAlert[] {
    const orders = ['']
      .flatMap(() => {
        const ids = new Set<string>();
        for (const fill of this.engine.listFills()) {
          ids.add(fill.buyOrderId);
          ids.add(fill.sellOrderId);
        }
        for (const resting of this.engine.listResting()) ids.add(resting.id);
        return [...ids].map((id) => this.engine.getOrder(id)).filter((row): row is Order => row !== undefined);
      });
    return runAllDetectors(orders, this.engine.listFills(), groups);
  }

  replay(): readonly ReplayResult[] {
    return runManipulationReplay(this.seed);
  }

  reconcile(): ReconciliationOk | ReconciliationHalt {
    const auth = this.#governanceAuth('TOGGLE_KILL_SWITCH');
    return this.recon.verify(auth, this.now);
  }

  toggleKillSwitch(id: KillSwitchId, engaged: boolean, reason: string, scope?: string) {
    const auth = this.#governanceAuth('TOGGLE_KILL_SWITCH');
    if (engaged) {
      return this.kills.engageKillSwitch(auth, { id, reason, engagedAt: this.now, ...(scope === undefined ? {} : { scope }) });
    }
    return this.kills.disengageKillSwitch(auth, id, scope);
  }

  transfer(input: Parameters<typeof submitDigitalAssetTransfer>[1]) {
    return submitDigitalAssetTransfer(this.kernel, input);
  }

  fiatConvert(customerId: CustomerId, jurisdiction: string, fiatAmount: Money) {
    if (!this.registry.isCapabilityEnabled(jurisdiction, 'FIAT_CONVERT') || this.kills.isEngaged('FIAT_GATEWAY')) {
      return convertFiatToPyr({
        journals: this.books.journals,
        authorization: this.#governanceAuth('TOGGLE_KILL_SWITCH'),
        registry: this.registry,
        kills: this.kills,
        customerId,
        jurisdiction,
        fiatAmount,
        customerFiatAccount: this.accountId(customerId, fiatAmount.currency),
        customerPyrAccount: this.accountId(customerId, 'PYR'),
        occurredAt: this.now,
        intentId: asActionIntentId(this.nextId('int')),
      });
    }
    const auth = this.#governanceAuth('FIAT_CONVERT');
    return convertFiatToPyr({
      journals: this.books.journals,
      authorization: auth,
      registry: this.registry,
      kills: this.kills,
      customerId,
      jurisdiction,
      fiatAmount,
      customerFiatAccount: this.accountId(customerId, fiatAmount.currency),
      customerPyrAccount: this.accountId(customerId, 'PYR'),
      occurredAt: this.now,
      intentId: asActionIntentId(this.nextId('int')),
    });
  }

  evidenceVerified(): { readonly ok: true } | { readonly ok: false; readonly atSeq: number } {
    return this.kernel.vault.verifyChain();
  }

  #open(accountId: AccountId, owner: CustomerId | 'HOUSE', currency: string, accountClass: string): void {
    const intent = freezeIntent({
      id: asActionIntentId(this.nextId('int')),
      kind: 'OPEN_ACCOUNT',
      actor: this.systemActor,
      payload: {
        accountId,
        ownerCustomerId: owner,
        currency,
        accountClass,
      },
      idempotencyKey: asIdempotencyKey(`acct_${accountId}`),
      occurredAt: this.now,
      sourceJurisdiction: 'US',
    });
    const evaluated = this.kernel.evaluate(intent);
    if (!evaluated.ok || evaluated.value.outcome !== 'AUTHORIZED') {
      throw new Error(`openAccount ${accountId} refused`);
    }
    this.books.putAccount(
      evaluated.value.authorization,
      createAccount(
        {
          id: accountId,
          ownerCustomerId: owner,
          accountClass: accountClass as never,
          currency: asCurrencyCode(currency),
          openedAt: this.now,
        },
        evaluated.value.authorization,
      ),
    );
  }

  #seed(accountId: AccountId, amount: Money): void {
    const intent = freezeIntent({
      id: asActionIntentId(this.nextId('int')),
      kind: 'SEED_CREDIT',
      actor: this.systemActor,
      payload: { accountId, amount, memo: 'exchange simulation seed' },
      idempotencyKey: asIdempotencyKey(`seed_${accountId}_${amount.minorUnits}`),
      occurredAt: this.now,
      sourceJurisdiction: 'US',
    });
    const evaluated = this.kernel.evaluate(intent);
    if (!evaluated.ok || evaluated.value.outcome !== 'AUTHORIZED') {
      throw new Error('seed refused');
    }
    const house = this.accountId('HOUSE', amount.currency);
    const posted = commitJournal(this.books.journals, evaluated.value.authorization, {
      intentId: intent.id,
      memo: 'exchange simulation seed',
      postedAt: this.now,
      lines: [
        { accountId, direction: 'DEBIT', amount },
        { accountId: house, direction: 'CREDIT', amount },
      ],
    });
    if (!posted.ok) throw new Error('seed unbalanced');
  }

  #postFill(authorization: KernelAuthorization, fill: Fill): Journal | undefined {
    const notional = Money.of(notionalQuoteMinor(fill.quantity, fill.price), 'USD');
    const fee = Money.of(feeQuoteMinor(notional.minorUnits), 'USD');
    const pyr = Money.of(fill.quantity, 'PYR');
    const buyerUsd = this.accountId(fill.buyCustomerId, 'USD');
    const sellerUsd = this.accountId(fill.sellCustomerId, 'USD');
    const buyerPyr = this.accountId(fill.buyCustomerId, 'PYR');
    const sellerPyr = this.accountId(fill.sellCustomerId, 'PYR');
    const feeAccount = this.accountId('HOUSE', 'FEE');
    const posted = commitJournal(this.books.journals, authorization, {
      intentId: authorization.intentId,
      memo: `exchange fill ${fill.id} fee->house_fee`,
      postedAt: this.now,
      lines: [
        { accountId: buyerUsd, direction: 'CREDIT', amount: notional },
        { accountId: sellerUsd, direction: 'DEBIT', amount: notional },
        { accountId: buyerPyr, direction: 'DEBIT', amount: pyr },
        { accountId: sellerPyr, direction: 'CREDIT', amount: pyr },
        { accountId: buyerUsd, direction: 'CREDIT', amount: fee },
        { accountId: feeAccount, direction: 'DEBIT', amount: fee },
      ],
    });
    if (!posted.ok) {
      throw new Error(`fill journal unbalanced for ${fill.id}`);
    }
    return posted.value;
  }

  #governanceAuth(kind: 'TOGGLE_KILL_SWITCH' | 'FIAT_CONVERT' | 'RECORD_SURVEILLANCE_ENFORCEMENT'): KernelAuthorization {
    const intent = freezeIntent({
      id: asActionIntentId(this.nextId('int')),
      kind,
      actor: this.operator,
      payload:
        kind === 'TOGGLE_KILL_SWITCH'
          ? { switchId: 'EXCHANGE', engaged: true, reason: 'governance' }
          : kind === 'FIAT_CONVERT'
            ? {
                customerId: asCustomerId('cust_unused'),
                jurisdiction: 'GB',
                fiatAmount: Money.of(0n, 'USD'),
                direction: 'FIAT_TO_PYR' as const,
              }
            : { alertId: 'none', reasonCode: 'GOVERNANCE', action: 'NO_ACTION', decidedBy: this.operator.id },
      idempotencyKey: asIdempotencyKey(`gov_${kind}_${this.#seq}`),
      occurredAt: this.now,
      sourceJurisdiction: 'GB',
    });
    const evaluated = this.kernel.evaluate(intent);
    if (!evaluated.ok || evaluated.value.outcome !== 'AUTHORIZED') {
      throw new Error(`governance ${kind} refused`);
    }
    return evaluated.value.authorization;
  }
}

export { FIAT_BRIDGE_CLASS };
export type { KernelDecision };
