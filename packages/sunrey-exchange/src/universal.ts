import type { Jurisdiction } from '../../domain/src/jurisdiction.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import { AssetQuantity } from '../../money/src/asset-quantity.ts';
import { observeFamilyMarket } from './family-surveillance.ts';
import { familyMarketData } from './family-market-data.ts';
import { enforceMarketAccess, type AccountAccessProfile } from './access.ts';
import { appendAuctionOrder, auctionAcceptsAt, clearAuction, openAuction } from './auction.ts';
import { openExchangeDispute } from './disputes.ts';
import { evaluateEligibility, filterEligibleCounterparties } from './eligibility.ts';
import {
  capacityInstrument,
  computeInstrument,
  digitalAssetInstrument,
  evaluateListingGovernance,
  informationRightInstrument,
  InstrumentRegistry,
} from './instruments.ts';
import {
  GPU_COMPUTE_MARKET_ID,
  INFORMATION_RIGHT_MARKET_ID,
  MANUFACTURING_CAPACITY_MARKET_ID,
  MOONREY_COIN_ASSET_ID,
  asInstrumentId,
  newContractId,
  newOrderId,
  type ContractId,
  type ExchangeAccountId,
  type ExchangeMarketId,
  type InstrumentId,
  type OrderId,
} from './ids.ts';
import { comparePrice, exchangePrice, type ExchangePrice } from './price.ts';
import type {
  CleanRoomPort,
  ConsentPort,
  MachineCapabilityPort,
  OracleFactRecord,
  OraclePort,
  ProductiveGraphPort,
} from './ports.ts';
import { applyRiskUsage, DEFAULT_RISK_LIMITS, emptyRiskUsage, evaluateRiskLimits } from './risk-limits.ts';
import { oracleAllowsSettlement, openEscrow, recordDelivery, settlePartialDelivery } from './settlement-extended.ts';
import { ExchangeStore } from './store.ts';
import { ContractTemplateRegistry } from './templates.ts';
import type { ExchangeFailure, ExchangeOutcome } from './types.ts';
import type {
  AuctionBook,
  AuctionClearing,
  ComputeContract,
  EligibilityContext,
  ExchangeInstrument,
  FamilyMarketData,
  InformationRightContract,
  ListingGovernanceCheck,
  PartialSettlement,
  ProductiveCapacityContract,
  UniversalOrder,
} from './types-universal.ts';
import type { ExchangeCounterpartyClass, MarketAccessPolicy, MarketFamily } from './taxonomy.ts';
import { SimulationNativeDvpAdapter } from './native-settlement.ts';
import { SUNREY_COIN_ASSET_ID } from '../../sunrey-coin/src/ids.ts';
import type { UtcInstant } from '../../domain/src/time.ts';

export type PlaceUniversalOrderInput = {
  readonly accountId: ExchangeAccountId;
  readonly marketId: ExchangeMarketId;
  readonly instrumentId: InstrumentId | string;
  readonly side: 'BUY' | 'SELL';
  readonly orderType: 'LIMIT' | 'IOC' | 'FOK' | 'POST_ONLY' | 'MARKET';
  readonly quantity: bigint;
  readonly limitPrice?: ExchangePrice;
  readonly protectionPrice?: ExchangePrice;
  readonly purpose?: string;
  readonly recipientClass?: string;
  readonly consentRef?: string;
  readonly geography?: string;
  readonly machineId?: string;
  readonly capabilities?: readonly string[];
  readonly jurisdiction: Jurisdiction;
  readonly actorClass: ExchangeCounterpartyClass;
  readonly access: MarketAccessPolicy;
  readonly verifiedAccount: boolean;
  readonly clientIdempotencyKey: string;
};

export class UniversalExchangeEngine {
  readonly instruments = new InstrumentRegistry();
  readonly native = new SimulationNativeDvpAdapter();
  private sequence = 0;
  private readonly store: ExchangeStore;
  private readonly consent: ConsentPort;
  private readonly cleanRoom: CleanRoomPort;
  private readonly oracle: OraclePort;
  private readonly productive: ProductiveGraphPort;
  private readonly machines: MachineCapabilityPort;
  private readonly now: () => UtcInstant;

  constructor(
    store: ExchangeStore,
    consent: ConsentPort,
    cleanRoom: CleanRoomPort,
    oracle: OraclePort,
    productive: ProductiveGraphPort,
    machines: MachineCapabilityPort,
    now: () => UtcInstant,
  ) {
    this.store = store;
    this.consent = consent;
    this.cleanRoom = cleanRoom;
    this.oracle = oracle;
    this.productive = productive;
    this.machines = machines;
    this.now = now;
    this.seedCanonicalInstruments();
  }

  private seedCanonicalInstruments(): void {
    const sunrey = digitalAssetInstrument({
      instrumentId: 'instrument:sunrey-coin-native',
      nativeAssetId: SUNREY_COIN_ASSET_ID,
      issuer: 'sunrey-chain',
      settlementAssets: [SUNREY_COIN_ASSET_ID, MOONREY_COIN_ASSET_ID],
    });
    const moonrey = digitalAssetInstrument({
      instrumentId: 'instrument:moonrey-coin-native',
      nativeAssetId: MOONREY_COIN_ASSET_ID,
      issuer: 'sunrey-chain',
      settlementAssets: [SUNREY_COIN_ASSET_ID, MOONREY_COIN_ASSET_ID],
    });
    const gpu = computeInstrument({
      instrumentId: 'instrument:gpu-second',
      provider: 'gpu-provider-sim',
      serviceClass: 'GPU_COMPUTE',
      capacity: 1_000n,
      unit: 'GPU_SECOND',
      settlementAsset: MOONREY_COIN_ASSET_ID,
    });
    const factory = capacityInstrument({
      instrumentId: 'instrument:manufacturing-capacity',
      provider: 'automated-factory-sim',
      productiveObject: 'object:factory-line-1',
      category: 'MANUFACTURING',
      quantity: 1_000n,
      unit: 'MANUFACTURED_UNIT',
      settlementAsset: MOONREY_COIN_ASSET_ID,
      location: 'GB-SIM',
    });
    const right = informationRightInstrument({
      instrumentId: 'instrument:cohort-aggregate-right',
      issuer: 'cohort-steward',
      cohortRef: 'cohort:consent-qualified-sim',
      templateId: 'grocery_average',
      purpose: 'AGGREGATED_RESEARCH',
      recipientClass: 'EXTERNAL_RESEARCH_PARTNER',
      consentPolicyRef: 'consent:cohort-aggregate-v1',
      settlementAsset: MOONREY_COIN_ASSET_ID,
    });
    for (const instrument of [sunrey, moonrey, gpu, factory, right]) {
      this.instruments.put(instrument);
      this.store.instruments.set(instrument.instrumentId, instrument);
    }
    this.store.auctions.set(
      MANUFACTURING_CAPACITY_MARKET_ID,
      openAuction({
        auctionId: 'auction:manufacturing-v1',
        marketId: MANUFACTURING_CAPACITY_MARKET_ID,
        instrumentId: factory.instrumentId,
        openHeight: 100n,
        closeHeight: 200n,
      }),
    );
  }

  listInstrument(instrument: ExchangeInstrument, actorKind: 'HUMAN_OPERATOR' | 'AGENT' | 'AI'): ListingGovernanceCheck {
    if (actorKind !== 'HUMAN_OPERATOR') {
      return Object.freeze({
        schemaValid: true,
        familyPolicyOk: true,
        rightsOk: true,
        oracleOk: true,
        legalResearchStatus: instrument.legalReviewState,
        operationalReady: instrument.operationalReady,
        aiApproved: false,
        accepted: false,
        reasonCodes: ['AI_CANNOT_APPROVE_LISTING'],
      });
    }
    const check = this.instruments.put(instrument);
    if (check.accepted) {
      this.store.instruments.set(instrument.instrumentId, instrument);
    }
    return check;
  }

  setAccessProfile(profile: AccountAccessProfile): void {
    this.store.accessProfiles.set(profile.accountId, profile);
  }

  setHeight(height: bigint): void {
    this.store.height = height;
  }

  templates() {
    return ContractTemplateRegistry.all();
  }

  instrument(id: string): ExchangeInstrument | undefined {
    return this.instruments.get(id) ?? this.store.instruments.get(id);
  }

  placeOrder(input: PlaceUniversalOrderInput): ExchangeOutcome<UniversalOrder> {
    const existing = [...this.store.universalOrders.values()].find(
      (order) => order.clientIdempotencyKey === input.clientIdempotencyKey,
    );
    if (existing) {
      return { outcome: 'OK', value: existing };
    }
    const instrument = this.instrument(String(input.instrumentId));
    if (!instrument || instrument.status !== 'SIMULATION_LISTED') {
      return { outcome: 'REJECTED', code: 'ASSET_SUSPENDED', message: 'instrument is not SIMULATION_LISTED' };
    }
    const listing = evaluateListingGovernance(instrument);
    if (!listing.accepted) {
      return { outcome: 'REJECTED', code: 'LISTING_GOVERNANCE_DENIED', message: listing.reasonCodes.join(',') };
    }
    const access = enforceMarketAccess(
      this.store.accessProfiles.get(input.accountId) ?? {
        accountId: input.accountId,
        access: input.access,
        actorClass: input.actorClass,
        verified: input.verifiedAccount,
        machineId: input.machineId ?? null,
        families: [instrument.marketFamily],
      },
      instrument.eligibilityPolicy.access,
      instrument.marketFamily,
    );
    if (!access.allowed) {
      this.store.deniedAccess.push(input.accountId);
      return { outcome: 'REJECTED', code: access.code, message: 'market access policy denied' };
    }
    if (input.machineId && instrument.eligibilityPolicy.requiredCapabilities.length > 0) {
      const missing = instrument.eligibilityPolicy.requiredCapabilities.some(
        (cap) => !input.capabilities?.includes(cap) && !this.machines.hasCapability(input.machineId!, cap),
      );
      if (missing) {
        return { outcome: 'REJECTED', code: 'CAPABILITY_MISSING', message: 'machine capability not granted' };
      }
    }
    if (input.orderType === 'MARKET' && !input.protectionPrice && !input.limitPrice) {
      return { outcome: 'REJECTED', code: 'MARKET_ORDER_UNSAFE', message: 'MARKET requires explicit slippage protection' };
    }
    if (input.orderType !== 'MARKET' && !input.limitPrice) {
      return { outcome: 'REJECTED', code: 'INVALID_PRICE', message: 'governed order requires a limit price' };
    }
    if (input.quantity <= 0n) {
      return { outcome: 'REJECTED', code: 'INVALID_QUANTITY', message: 'quantity must be positive' };
    }

    const consentState = this.consentState(instrument, input);
    const ctx = this.contextFrom(input, consentState);
    const eligibility = evaluateEligibility(instrument, ctx);
    if (!eligibility.eligible) {
      this.recordEligibilityReject(eligibility.reasonCodes, input);
      return {
        outcome: 'REJECTED',
        code: eligibility.reasonCodes[0] ?? 'IDENTITY_INELIGIBLE',
        message: eligibility.reasonCodes.join(','),
      };
    }

    const usage = this.store.riskUsage.get(input.accountId) ?? emptyRiskUsage(input.accountId);
    const notional = input.limitPrice ? input.quantity * input.limitPrice.priceUnits : input.quantity;
    const risk = evaluateRiskLimits(usage, {
      openOrdersDelta: 1n,
      notionalDelta: notional,
      escrowDelta: input.side === 'BUY' ? notional : 0n,
      capacityDelta: instrument.marketFamily === 'PRODUCTIVE_CAPACITY' ? input.quantity : 0n,
      providerId: instrument.issuerOrProvider,
      instrumentId: instrument.instrumentId,
    });
    if (!risk.allowed) {
      return { outcome: 'REJECTED', code: risk.code, message: 'cross-market risk limit breached' };
    }

    if (instrument.marketFamily === 'HUMAN_INFORMATION_RIGHT' && input.side === 'SELL') {
      const listed = this.consent.check({
        consentRef: input.consentRef ??
          (instrument.extension.kind === 'HUMAN_INFORMATION_RIGHT'
            ? instrument.extension.consentPolicyRef
            : ''),
        subjectOrCohortRef: instrument.underlyingReference,
        purpose: input.purpose ?? '',
        recipientClass: input.recipientClass ?? '',
        operation: 'LIST',
      });
      if (!listed.active || listed.revoked) {
        return { outcome: 'REJECTED', code: listed.reasonCode, message: 'consent required before information-right list' };
      }
    }

    const order: UniversalOrder = Object.freeze({
      orderId: newOrderId(),
      exchangeAccountId: input.accountId,
      marketId: input.marketId,
      instrumentId: asInstrumentId(String(input.instrumentId)),
      family: instrument.marketFamily,
      side: input.side,
      orderType: input.orderType,
      quantity: input.quantity,
      remaining: input.quantity,
      limitPrice: input.limitPrice ?? input.protectionPrice ?? null,
      purpose: input.purpose ?? null,
      recipientClass: input.recipientClass ?? null,
      actorClass: input.actorClass,
      capabilities: input.capabilities ?? [],
      jurisdiction: input.jurisdiction,
      geography: input.geography ?? null,
      machineId: input.machineId ?? null,
      consentRef: input.consentRef ?? null,
      clientIdempotencyKey: input.clientIdempotencyKey,
      sequence: (this.sequence += 1),
      status: 'OPEN',
    });
    this.store.universalOrders.set(order.orderId, order);
    this.store.riskUsage.set(input.accountId, applyRiskUsage(usage, {
      openOrdersDelta: 1n,
      notionalDelta: notional,
      escrowDelta: input.side === 'BUY' ? notional : 0n,
      capacityDelta: instrument.marketFamily === 'PRODUCTIVE_CAPACITY' ? input.quantity : 0n,
      providerId: instrument.issuerOrProvider,
      instrumentId: instrument.instrumentId,
    }));

    if (instrument.marketFamily === 'PRODUCTIVE_CAPACITY') {
      const auction = this.store.auctions.get(input.marketId);
      if (auction) {
        if (!auctionAcceptsAt(auction, this.store.height)) {
          this.store.universalOrders.set(order.orderId, { ...order, status: 'REJECTED' });
          return { outcome: 'REJECTED', code: 'AUCTION_CLOSED', message: 'auction is not accepting orders at this height' };
        }
        this.store.auctions.set(input.marketId, appendAuctionOrder(auction, order, this.store.height));
        return { outcome: 'OK', value: order };
      }
    }

    const matched = this.stageMatch(order, instrument, ctx);
    return { outcome: 'OK', value: this.store.universalOrders.get(order.orderId) ?? matched };
  }

  private stageMatch(incoming: UniversalOrder, instrument: ExchangeInstrument, ctx: EligibilityContext): UniversalOrder {
    const resting = [...this.store.universalOrders.values()].filter(
      (order) =>
        order.marketId === incoming.marketId &&
        order.orderId !== incoming.orderId &&
        (order.status === 'OPEN' || order.status === 'PARTIALLY_FILLED'),
    );
    const filtered = filterEligibleCounterparties(instrument, incoming, ctx, resting, (order) =>
      this.contextFromOrder(order),
    );
    if (filtered.eligible.length === 0 && incoming.orderType === 'FOK') {
      const rejected = { ...incoming, status: 'REJECTED' as const };
      this.store.universalOrders.set(incoming.orderId, rejected);
      return rejected;
    }
    const opposite = filtered.eligible
      .filter((order) => order.limitPrice)
      .sort((a, b) => {
        const priceCmp =
          incoming.side === 'BUY'
            ? comparePrice(a.limitPrice!, b.limitPrice!)
            : comparePrice(b.limitPrice!, a.limitPrice!);
        return priceCmp !== 0 ? priceCmp : a.sequence - b.sequence;
      });

    if (incoming.orderType === 'POST_ONLY' && opposite.some((maker) => this.pricesCross(incoming, maker))) {
      const rejected = { ...incoming, status: 'REJECTED' as const };
      this.store.universalOrders.set(incoming.orderId, rejected);
      return rejected;
    }

    let remaining = incoming.remaining;
    let taker = incoming;
    const planned: { maker: UniversalOrder; quantity: bigint; price: ExchangePrice }[] = [];
    for (const maker of opposite) {
      if (remaining <= 0n) {
        break;
      }
      if (!this.pricesCross(taker, maker)) {
        break;
      }
      const fill = remaining < maker.remaining ? remaining : maker.remaining;
      planned.push({ maker, quantity: fill, price: maker.limitPrice! });
      remaining -= fill;
    }
    if ((incoming.orderType === 'FOK' || incoming.orderType === 'MARKET') && remaining > 0n && incoming.orderType === 'FOK') {
      const rejected = { ...incoming, status: 'REJECTED' as const };
      this.store.universalOrders.set(incoming.orderId, rejected);
      return rejected;
    }
    for (const fill of planned) {
      this.executeFill(taker, fill.maker, fill.quantity, fill.price, instrument);
      taker = this.store.universalOrders.get(incoming.orderId) ?? taker;
    }
    const latest = this.store.universalOrders.get(incoming.orderId) ?? taker;
    if ((incoming.orderType === 'IOC' || incoming.orderType === 'MARKET') && latest.status !== 'FILLED') {
      const cancelled = { ...latest, status: 'CANCELLED' as const };
      this.store.universalOrders.set(latest.orderId, cancelled);
      return cancelled;
    }
    return latest;
  }

  private pricesCross(taker: UniversalOrder, maker: UniversalOrder): boolean {
    if (!taker.limitPrice || !maker.limitPrice) {
      return taker.orderType === 'MARKET';
    }
    return taker.side === 'BUY'
      ? comparePrice(taker.limitPrice, maker.limitPrice) >= 0
      : comparePrice(maker.limitPrice, taker.limitPrice) >= 0;
  }

  private executeFill(
    taker: UniversalOrder,
    maker: UniversalOrder,
    quantity: bigint,
    price: ExchangePrice,
    instrument: ExchangeInstrument,
  ): void {
    if (instrument.marketFamily === 'HUMAN_INFORMATION_RIGHT') {
      const buyer = taker.side === 'BUY' ? taker : maker;
      const check = this.consent.check({
        consentRef: (taker.consentRef ?? maker.consentRef) ??
          (instrument.extension.kind === 'HUMAN_INFORMATION_RIGHT' ? instrument.extension.consentPolicyRef : ''),
        subjectOrCohortRef: instrument.underlyingReference,
        purpose: buyer.purpose ?? '',
        recipientClass: buyer.recipientClass ?? '',
        operation: 'MATCH',
      });
      if (!check.active || !check.purposeMatch || check.revoked) {
        this.store.consentMismatches.push(buyer.orderId);
        return;
      }
    }
    const apply = (order: UniversalOrder): UniversalOrder => {
      const nextRemaining = order.remaining - quantity;
      const next = Object.freeze({
        ...order,
        remaining: nextRemaining,
        status: nextRemaining === 0n ? ('FILLED' as const) : ('PARTIALLY_FILLED' as const),
      });
      this.store.universalOrders.set(order.orderId, next);
      return next;
    };
    apply(taker);
    apply(maker);
    if (instrument.marketFamily === 'INTELLIGENCE_COMPUTE') {
      this.openComputeFromFill(taker, maker, quantity, price, instrument);
    }
    if (instrument.marketFamily === 'HUMAN_INFORMATION_RIGHT') {
      this.openInformationFromFill(taker, maker, price, instrument);
    }
    this.refreshFamilyData(taker.marketId, instrument.marketFamily);
  }

  nativeDigitalTrade(input: {
    readonly seller: string;
    readonly buyer: string;
    readonly base: AssetQuantity;
    readonly quote: AssetQuantity;
  }): Result<{ settled: true }, ExchangeFailure> {
    const settled = this.native.atomicDeliveryVersusPayment({
      assetSender: input.seller,
      assetRecipient: input.buyer,
      assetAmount: input.base,
      contraSender: input.buyer,
      contraRecipient: input.seller,
      contraAmount: input.quote,
    });
    if (!settled.ok) {
      return err({ code: settled.error.code, message: settled.error.message });
    }
    return ok({ settled: true });
  }

  listComputeCapacity(input: {
    readonly providerAccountId: ExchangeAccountId;
    readonly quantity: bigint;
    readonly unitPrice: ExchangePrice;
    readonly jurisdiction: Jurisdiction;
  }): ExchangeOutcome<UniversalOrder> {
    return this.placeOrder({
      accountId: input.providerAccountId,
      marketId: GPU_COMPUTE_MARKET_ID,
      instrumentId: 'instrument:gpu-second',
      side: 'SELL',
      orderType: 'LIMIT',
      quantity: input.quantity,
      limitPrice: input.unitPrice,
      jurisdiction: input.jurisdiction,
      actorClass: 'MACHINE',
      access: 'MACHINE_ALLOWED',
      verifiedAccount: true,
      machineId: 'gpu-provider-sim',
      capabilities: ['SELL_COMPUTE'],
      clientIdempotencyKey: `compute-list-${input.providerAccountId}`,
    });
  }

  buyCompute(input: {
    readonly buyerAccountId: ExchangeAccountId;
    readonly quantity: bigint;
    readonly unitPrice: ExchangePrice;
    readonly jurisdiction: Jurisdiction;
    readonly machineId: string;
  }): ExchangeOutcome<UniversalOrder> {
    if (!this.machines.hasCapability(input.machineId, 'PURCHASE_COMPUTE')) {
      return { outcome: 'REJECTED', code: 'CAPABILITY_MISSING', message: 'machine cannot purchase compute' };
    }
    const notional = input.quantity * input.unitPrice.priceUnits;
    this.native.seed(input.buyerAccountId, AssetQuantity.fromScaledUnits(notional, MOONREY_COIN_ASSET_ID));
    return this.placeOrder({
      accountId: input.buyerAccountId,
      marketId: GPU_COMPUTE_MARKET_ID,
      instrumentId: 'instrument:gpu-second',
      side: 'BUY',
      orderType: 'LIMIT',
      quantity: input.quantity,
      limitPrice: input.unitPrice,
      jurisdiction: input.jurisdiction,
      actorClass: 'MACHINE',
      access: 'MACHINE_ALLOWED',
      verifiedAccount: true,
      machineId: input.machineId,
      capabilities: ['PURCHASE_COMPUTE'],
      clientIdempotencyKey: `compute-buy-${input.buyerAccountId}`,
    });
  }

  private openComputeFromFill(
    taker: UniversalOrder,
    maker: UniversalOrder,
    quantity: bigint,
    price: ExchangePrice,
    instrument: ExchangeInstrument,
  ): void {
    const buyer = taker.side === 'BUY' ? taker : maker;
    const provider = taker.side === 'SELL' ? taker : maker;
    const escrow = openEscrow({
      ownerAccountId: buyer.exchangeAccountId,
      assetId: MOONREY_COIN_ASSET_ID,
      amount: quantity * price.priceUnits,
    });
    this.store.escrows.set(escrow.escrowId, escrow);
    const contract: ComputeContract = Object.freeze({
      contractId: newContractId(),
      instrumentId: instrument.instrumentId,
      marketId: buyer.marketId,
      provider: provider.exchangeAccountId,
      buyer: buyer.exchangeAccountId,
      serviceClass: instrument.extension.kind === 'INTELLIGENCE_COMPUTE' ? instrument.extension.hardwareOrServiceClass : 'GPU_COMPUTE',
      unit: instrument.unit,
      ordered: quantity,
      delivered: 0n,
      remaining: quantity,
      unitPrice: price,
      settlementAsset: MOONREY_COIN_ASSET_ID,
      escrowId: escrow.escrowId,
      deliveryWindow:
        instrument.extension.kind === 'INTELLIGENCE_COMPUTE'
          ? instrument.extension.deliveryWindow
          : { startHeight: 0n, endHeight: 0n, startAt: null, endAt: null },
      oraclePolicy: instrument.oraclePolicy,
      partialPolicy: instrument.deliveryPolicy.partial,
      status: 'MATCHED',
    });
    this.store.computeContracts.set(contract.contractId, contract);
  }

  settleComputeDelivery(input: {
    readonly contractId: ContractId | string;
    readonly delivered: bigint;
    readonly quality?: OracleFactRecord['quality'];
    readonly providerId?: string;
  }): ExchangeOutcome<PartialSettlement> {
    const contract = this.store.computeContracts.get(input.contractId);
    if (!contract || !contract.escrowId) {
      return { outcome: 'REJECTED', code: 'UNKNOWN_ORDER', message: 'compute contract not found' };
    }
    const fact: OracleFactRecord = {
      factId: `fact:${contract.contractId}`,
      contractId: contract.contractId,
      quantity: input.delivered,
      unit: contract.unit,
      quality: input.quality ?? 'FINALIZED',
      providerId: input.providerId ?? 'oracle-compute-sim',
      factType: 'COMPUTE_USAGE',
    };
    this.oracle.record(fact);
    const allowed = oracleAllowsSettlement(fact, contract.oraclePolicy);
    if (!allowed.ok) {
      this.store.disputes.push(
        openExchangeDispute({
          kind: 'ORACLE_CONFLICT',
          contractId: contract.contractId,
          caseRef: `case:${contract.contractId}`,
        }),
      );
      return { outcome: 'REJECTED', code: allowed.error.code, message: allowed.error.message };
    }
    const escrow = this.store.escrows.get(contract.escrowId);
    if (!escrow) {
      return { outcome: 'REJECTED', code: 'SETTLEMENT_FAILURE', message: 'escrow missing' };
    }
    const settled = settlePartialDelivery({
      contractId: contract.contractId,
      ordered: contract.ordered,
      delivered: input.delivered,
      unitPrice: contract.unitPrice.priceUnits,
      escrow,
      policy: contract.partialPolicy,
    });
    if (!settled.ok) {
      this.store.disputes.push(
        openExchangeDispute({
          kind: 'DELIVERY_MISMATCH',
          contractId: contract.contractId,
          caseRef: `case:${contract.contractId}`,
        }),
      );
      return { outcome: 'REJECTED', code: settled.error.code, message: settled.error.message };
    }
    this.store.escrows.set(settled.value.escrow.escrowId, settled.value.escrow);
    this.store.deliveries.push(
      recordDelivery({
        contractId: contract.contractId,
        fact,
        quantity: input.delivered,
        unit: contract.unit,
        at: this.now(),
      }),
    );
    this.store.computeContracts.set(contract.contractId, {
      ...contract,
      delivered: input.delivered,
      remaining: contract.ordered - input.delivered,
      status: 'SETTLED',
    });
    this.native.credit(contract.provider, MOONREY_COIN_ASSET_ID, settled.value.settlement.paid);
    return { outcome: 'OK', value: settled.value.settlement };
  }

  offerCapacity(input: {
    readonly providerAccountId: ExchangeAccountId;
    readonly quantity: bigint;
    readonly limitPrice: ExchangePrice;
    readonly jurisdiction: Jurisdiction;
  }): ExchangeOutcome<UniversalOrder> {
    return this.placeOrder({
      accountId: input.providerAccountId,
      marketId: MANUFACTURING_CAPACITY_MARKET_ID,
      instrumentId: 'instrument:manufacturing-capacity',
      side: 'SELL',
      orderType: 'LIMIT',
      quantity: input.quantity,
      limitPrice: input.limitPrice,
      jurisdiction: input.jurisdiction,
      actorClass: 'MACHINE',
      access: 'VERIFIED_ACCOUNT',
      verifiedAccount: true,
      geography: 'GB-SIM',
      machineId: 'factory-sim',
      clientIdempotencyKey: `capacity-offer-${input.providerAccountId}`,
    });
  }

  bidCapacity(input: {
    readonly buyerAccountId: ExchangeAccountId;
    readonly quantity: bigint;
    readonly limitPrice: ExchangePrice;
    readonly jurisdiction: Jurisdiction;
  }): ExchangeOutcome<UniversalOrder> {
    const notional = input.quantity * input.limitPrice.priceUnits;
    this.native.seed(input.buyerAccountId, AssetQuantity.fromScaledUnits(notional, MOONREY_COIN_ASSET_ID));
    return this.placeOrder({
      accountId: input.buyerAccountId,
      marketId: MANUFACTURING_CAPACITY_MARKET_ID,
      instrumentId: 'instrument:manufacturing-capacity',
      side: 'BUY',
      orderType: 'LIMIT',
      quantity: input.quantity,
      limitPrice: input.limitPrice,
      jurisdiction: input.jurisdiction,
      actorClass: 'INSTITUTION',
      access: 'VERIFIED_ACCOUNT',
      verifiedAccount: true,
      geography: 'GB-SIM',
      clientIdempotencyKey: `capacity-bid-${input.buyerAccountId}`,
    });
  }

  clearCapacityAuction(): ExchangeOutcome<{ clearing: AuctionClearing; contract: ProductiveCapacityContract }> {
    const auction = this.store.auctions.get(MANUFACTURING_CAPACITY_MARKET_ID);
    if (!auction) {
      return { outcome: 'REJECTED', code: 'UNKNOWN_ORDER', message: 'capacity auction not found' };
    }
    const clearing = clearAuction(auction);
    if (!clearing.clearingPrice || clearing.allocated.length === 0) {
      return { outcome: 'REJECTED', code: 'FOK_UNFILLED', message: 'auction did not clear' };
    }
    const first = clearing.allocated[0]!;
    const bid = this.store.universalOrders.get(first.bidOrderId);
    const offer = this.store.universalOrders.get(first.offerOrderId);
    const instrument = this.instrument('instrument:manufacturing-capacity');
    if (!bid || !offer || !instrument) {
      return { outcome: 'REJECTED', code: 'UNKNOWN_ORDER', message: 'auction orders missing' };
    }
    const quantity = clearing.allocated.reduce((sum, row) => sum + row.quantity, 0n);
    const escrow = openEscrow({
      ownerAccountId: bid.exchangeAccountId,
      assetId: MOONREY_COIN_ASSET_ID,
      amount: quantity * clearing.clearingPrice.priceUnits,
    });
    this.store.escrows.set(escrow.escrowId, escrow);
    const contract: ProductiveCapacityContract = Object.freeze({
      contractId: newContractId(),
      instrumentId: instrument.instrumentId,
      marketId: MANUFACTURING_CAPACITY_MARKET_ID,
      productiveObject: instrument.extension.kind === 'PRODUCTIVE_CAPACITY' ? instrument.extension.productiveObject : 'object:factory-line-1',
      capacityCategory: 'MANUFACTURING',
      quantity,
      remaining: quantity,
      delivered: 0n,
      unit: instrument.unit,
      deliveryWindow:
        instrument.extension.kind === 'PRODUCTIVE_CAPACITY'
          ? instrument.extension.deliveryWindow
          : { startHeight: 100n, endHeight: 200n, startAt: null, endAt: null },
      deliveryLocation: 'GB-SIM',
      rightsReference: 'rights:object:factory-line-1',
      provider: offer.exchangeAccountId,
      buyer: bid.exchangeAccountId,
      oraclePolicy: instrument.oraclePolicy,
      deliveryConditions: ['oracle_finalized_output'],
      settlementAsset: MOONREY_COIN_ASSET_ID,
      unitPrice: clearing.clearingPrice,
      escrowId: escrow.escrowId,
      failureTerms: 'dispute_then_release_unused',
      partialPolicy: 'PAY_VERIFIED_RELEASE_UNUSED',
      tokenizesTitle: false,
      status: 'MATCHED',
    });
    this.store.capacityContracts.set(contract.contractId, contract);
    this.store.auctions.set(MANUFACTURING_CAPACITY_MARKET_ID, { ...auction, state: 'CLEARED' });
    this.refreshFamilyData(MANUFACTURING_CAPACITY_MARKET_ID, 'PRODUCTIVE_CAPACITY', clearing.clearingPrice, quantity);
    return { outcome: 'OK', value: { clearing, contract } };
  }

  settleCapacityDelivery(input: {
    readonly contractId: ContractId | string;
    readonly delivered: bigint;
    readonly quality?: OracleFactRecord['quality'];
  }): ExchangeOutcome<PartialSettlement> {
    const contract = this.store.capacityContracts.get(input.contractId);
    if (!contract || !contract.escrowId) {
      return { outcome: 'REJECTED', code: 'UNKNOWN_ORDER', message: 'capacity contract not found' };
    }
    if (this.productive.hasReference(contract.productiveObject, contract.contractId)) {
      return { outcome: 'REJECTED', code: 'DOUBLE_COUNT_FORBIDDEN', message: 'productive graph already referenced this contract' };
    }
    const fact: OracleFactRecord = {
      factId: `fact:${contract.contractId}`,
      contractId: contract.contractId,
      quantity: input.delivered,
      unit: contract.unit,
      quality: input.quality ?? 'FINALIZED',
      providerId: 'oracle-capacity-sim',
      factType: 'MANUFACTURING_OUTPUT',
    };
    this.oracle.record(fact);
    const allowed = oracleAllowsSettlement(fact, contract.oraclePolicy);
    if (!allowed.ok) {
      this.store.disputes.push(
        openExchangeDispute({
          kind: 'ORACLE_CONFLICT',
          contractId: contract.contractId,
          caseRef: `case:${contract.contractId}`,
        }),
      );
      return { outcome: 'REJECTED', code: allowed.error.code, message: allowed.error.message };
    }
    const escrow = this.store.escrows.get(contract.escrowId);
    if (!escrow) {
      return { outcome: 'REJECTED', code: 'SETTLEMENT_FAILURE', message: 'escrow missing' };
    }
    const settled = settlePartialDelivery({
      contractId: contract.contractId,
      ordered: contract.quantity,
      delivered: input.delivered,
      unitPrice: contract.unitPrice.priceUnits,
      escrow,
      policy: contract.partialPolicy,
    });
    if (!settled.ok) {
      return { outcome: 'REJECTED', code: settled.error.code, message: settled.error.message };
    }
    const graph = this.productive.recordCapacityReference({
      objectId: contract.productiveObject,
      contractId: contract.contractId,
      quantity: input.delivered,
      unit: contract.unit,
      category: contract.capacityCategory,
    });
    if (!graph.ok) {
      return { outcome: 'REJECTED', code: graph.error.code, message: graph.error.message };
    }
    this.store.escrows.set(settled.value.escrow.escrowId, settled.value.escrow);
    this.store.capacityContracts.set(contract.contractId, {
      ...contract,
      delivered: input.delivered,
      remaining: contract.quantity - input.delivered,
      status: 'SETTLED',
    });
    this.native.credit(contract.provider, MOONREY_COIN_ASSET_ID, settled.value.settlement.paid);
    return { outcome: 'OK', value: settled.value.settlement };
  }

  listInformationRight(input: {
    readonly sellerAccountId: ExchangeAccountId;
    readonly consentRef: string;
    readonly purpose: string;
    readonly recipientClass: string;
    readonly unitPrice: ExchangePrice;
    readonly jurisdiction: Jurisdiction;
  }): ExchangeOutcome<UniversalOrder> {
    return this.placeOrder({
      accountId: input.sellerAccountId,
      marketId: INFORMATION_RIGHT_MARKET_ID,
      instrumentId: 'instrument:cohort-aggregate-right',
      side: 'SELL',
      orderType: 'LIMIT',
      quantity: 1n,
      limitPrice: input.unitPrice,
      purpose: input.purpose,
      recipientClass: input.recipientClass,
      consentRef: input.consentRef,
      jurisdiction: input.jurisdiction,
      actorClass: 'ELIGIBLE_COUNTERPARTY',
      access: 'ELIGIBLE_COUNTERPARTY',
      verifiedAccount: true,
      clientIdempotencyKey: `info-list-${input.sellerAccountId}`,
    });
  }

  buyInformationRight(input: {
    readonly buyerAccountId: ExchangeAccountId;
    readonly purpose: string;
    readonly recipientClass: string;
    readonly unitPrice: ExchangePrice;
    readonly jurisdiction: Jurisdiction;
  }): ExchangeOutcome<UniversalOrder> {
    this.native.seed(input.buyerAccountId, AssetQuantity.fromScaledUnits(input.unitPrice.priceUnits, MOONREY_COIN_ASSET_ID));
    return this.placeOrder({
      accountId: input.buyerAccountId,
      marketId: INFORMATION_RIGHT_MARKET_ID,
      instrumentId: 'instrument:cohort-aggregate-right',
      side: 'BUY',
      orderType: 'LIMIT',
      quantity: 1n,
      limitPrice: input.unitPrice,
      purpose: input.purpose,
      recipientClass: input.recipientClass,
      jurisdiction: input.jurisdiction,
      actorClass: 'INSTITUTION',
      access: 'ELIGIBLE_COUNTERPARTY',
      verifiedAccount: true,
      clientIdempotencyKey: `info-buy-${input.buyerAccountId}-${input.purpose}`,
      consentRef: 'consent:cohort-aggregate-v1',
    });
  }

  private openInformationFromFill(
    taker: UniversalOrder,
    maker: UniversalOrder,
    price: ExchangePrice,
    instrument: ExchangeInstrument,
  ): void {
    const buyer = taker.side === 'BUY' ? taker : maker;
    const seller = taker.side === 'SELL' ? taker : maker;
    const escrow = openEscrow({
      ownerAccountId: buyer.exchangeAccountId,
      assetId: MOONREY_COIN_ASSET_ID,
      amount: price.priceUnits,
    });
    this.store.escrows.set(escrow.escrowId, escrow);
    const contract: InformationRightContract = Object.freeze({
      contractId: newContractId(),
      instrumentId: instrument.instrumentId,
      marketId: INFORMATION_RIGHT_MARKET_ID,
      rightId: instrument.extension.kind === 'HUMAN_INFORMATION_RIGHT' ? instrument.extension.rightId : asInstrumentId('right:missing') as never,
      seller: seller.exchangeAccountId,
      buyer: buyer.exchangeAccountId,
      purpose: buyer.purpose ?? '',
      templateId:
        instrument.extension.kind === 'HUMAN_INFORMATION_RIGHT'
          ? instrument.extension.permittedComputationTemplate
          : 'grocery_average',
      consentPolicyRef:
        instrument.extension.kind === 'HUMAN_INFORMATION_RIGHT'
          ? instrument.extension.consentPolicyRef
          : '',
      cleanRoomRequired: true,
      rawRows: false,
      settlementAsset: MOONREY_COIN_ASSET_ID,
      unitPrice: price,
      escrowId: escrow.escrowId,
      status: 'MATCHED',
      outputReceiptId: null,
    });
    this.store.informationContracts.set(contract.contractId, contract);
  }

  deliverInformationRight(input: {
    readonly contractId: ContractId | string;
    readonly requesterId: string;
  }): ExchangeOutcome<{
    readonly receiptId: string;
    readonly aggregate: Readonly<Record<string, string>>;
    readonly rawRows: false;
    readonly rawPayload: null;
  }> {
    const contract = this.store.informationContracts.get(input.contractId);
    if (!contract) {
      return { outcome: 'REJECTED', code: 'UNKNOWN_ORDER', message: 'information-right contract not found' };
    }
    const instrument = this.instrument(contract.instrumentId);
    const check = this.consent.check({
      consentRef: contract.consentPolicyRef,
      subjectOrCohortRef: instrument?.underlyingReference ?? '',
      purpose: contract.purpose,
      recipientClass: 'EXTERNAL_RESEARCH_PARTNER',
      operation: 'DELIVER',
    });
    if (check.revoked) {
      this.store.informationContracts.set(contract.contractId, { ...contract, status: 'BLOCKED' });
      this.store.disputes.push(
        openExchangeDispute({
          kind: 'CONSENT_REVOKED',
          contractId: contract.contractId,
          caseRef: `case:${contract.contractId}`,
        }),
      );
      return { outcome: 'REJECTED', code: 'CONSENT_REVOKED', message: 'consent revoked before use blocks delivery' };
    }
    if (!check.active || !check.purposeMatch) {
      this.store.disputes.push(
        openExchangeDispute({
          kind: 'RIGHTS_FAILURE',
          contractId: contract.contractId,
          caseRef: `case:${contract.contractId}`,
        }),
      );
      return { outcome: 'REJECTED', code: check.reasonCode, message: 'rights/purpose revalidation failed' };
    }
    const computed = this.cleanRoom.executeAggregate({
      templateId: contract.templateId,
      purpose: contract.purpose,
      cohortRef: instrument?.underlyingReference ?? '',
      requesterId: input.requesterId,
    });
    if (!computed.ok) {
      return { outcome: 'REJECTED', code: computed.error.code, message: computed.error.message };
    }
    if (computed.value.rawRows !== false || computed.value.rawPayload !== null) {
      return { outcome: 'REJECTED', code: 'RAW_INFORMATION_UNAVAILABLE', message: 'raw rows must never be returned' };
    }
    const escrow = contract.escrowId ? this.store.escrows.get(contract.escrowId) : undefined;
    if (escrow) {
      this.store.escrows.set(escrow.escrowId, {
        ...escrow,
        paid: escrow.locked,
        locked: 0n,
        state: 'SETTLED',
      });
      this.native.credit(contract.seller, MOONREY_COIN_ASSET_ID, escrow.locked);
    }
    this.store.informationContracts.set(contract.contractId, {
      ...contract,
      status: 'SETTLED',
      outputReceiptId: computed.value.receiptId,
    });
    return {
      outcome: 'OK',
      value: {
        receiptId: computed.value.receiptId,
        aggregate: computed.value.aggregate,
        rawRows: false,
        rawPayload: null,
      },
    };
  }

  familyData(marketId: ExchangeMarketId): FamilyMarketData | undefined {
    return this.store.familyMarketData.get(marketId);
  }

  surveillanceInputs(marketId: string, family: MarketFamily, now: UtcInstant) {
    return observeFamilyMarket(
      {
        marketId,
        family: family === 'INFORMATION_ASSET' ? 'INFORMATION_ASSET' : family,
        deniedAccessCount: this.store.deniedAccess.length,
        unauthorizedPurposeAttempts: this.store.unauthorizedPurpose,
        consentMismatches: this.store.consentMismatches,
        nonDeliveryCount: [...this.store.computeContracts.values()].filter((row) => row.status === 'DISPUTED').length,
        oracleProviderShares: { 'oracle-compute-sim': 1n },
      },
      now,
    );
  }

  replicaSnapshot(): string {
    const payload = {
      instruments: this.instruments.list().map((row) => row.instrumentId).sort(),
      orders: [...this.store.universalOrders.values()]
        .sort((a, b) => a.sequence - b.sequence)
        .map((order) => ({
          remaining: order.remaining.toString(),
          status: order.status,
          seq: order.sequence,
          side: order.side,
          qty: order.quantity.toString(),
          price: order.limitPrice?.priceUnits.toString() ?? null,
        })),
      compute: [...this.store.computeContracts.values()]
        .map((row) => ({
          delivered: row.delivered.toString(),
          ordered: row.ordered.toString(),
          status: row.status,
        }))
        .sort((a, b) => a.ordered.localeCompare(b.ordered)),
      capacity: [...this.store.capacityContracts.values()]
        .map((row) => ({
          delivered: row.delivered.toString(),
          quantity: row.quantity.toString(),
          status: row.status,
        }))
        .sort((a, b) => a.quantity.localeCompare(b.quantity)),
      auctions: [...this.store.auctions.values()]
        .map((row) => ({
          id: row.auctionId,
          state: row.state,
          bids: row.bids.length,
          offers: row.offers.length,
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    };
    return JSON.stringify(payload);
  }

  computeContract(id: string): ComputeContract | undefined {
    return this.store.computeContracts.get(id);
  }
  capacityContract(id: string): ProductiveCapacityContract | undefined {
    return this.store.capacityContracts.get(id);
  }
  informationContract(id: string): InformationRightContract | undefined {
    return this.store.informationContracts.get(id);
  }
  latestComputeContract(): ComputeContract | undefined {
    return [...this.store.computeContracts.values()].at(-1);
  }
  latestCapacityContract(): ProductiveCapacityContract | undefined {
    return [...this.store.capacityContracts.values()].at(-1);
  }
  latestInformationContract(): InformationRightContract | undefined {
    return [...this.store.informationContracts.values()].at(-1);
  }
  auction(marketId: string): AuctionBook | undefined {
    return this.store.auctions.get(marketId);
  }
  disputes() {
    return [...this.store.disputes];
  }
  risk(accountId: ExchangeAccountId) {
    return this.store.riskUsage.get(accountId) ?? emptyRiskUsage(accountId);
  }
  limits() {
    return DEFAULT_RISK_LIMITS;
  }

  private consentState(instrument: ExchangeInstrument, input: PlaceUniversalOrderInput) {
    if (!instrument.rightsPolicy.requiresConsent) {
      return { active: false, revoked: false };
    }
    const ref =
      input.consentRef ??
      (instrument.extension.kind === 'HUMAN_INFORMATION_RIGHT' ? instrument.extension.consentPolicyRef : '');
    const check = this.consent.check({
      consentRef: ref,
      subjectOrCohortRef: instrument.underlyingReference,
      purpose: input.purpose ?? '',
      recipientClass: input.recipientClass ?? '',
      operation: input.side === 'SELL' ? 'LIST' : 'MATCH',
    });
    return check;
  }

  private contextFrom(
    input: PlaceUniversalOrderInput,
    consent: { active: boolean; revoked: boolean },
  ): EligibilityContext {
    return Object.freeze({
      actorClass: input.actorClass,
      capabilities: input.capabilities ?? [],
      jurisdiction: input.jurisdiction,
      geography: input.geography ?? null,
      machineId: input.machineId ?? null,
      purpose: input.purpose ?? null,
      recipientClass: input.recipientClass ?? null,
      consentActive: consent.active,
      consentRevoked: consent.revoked,
      verifiedAccount: input.verifiedAccount,
      access: input.access,
    });
  }

  private contextFromOrder(order: UniversalOrder): EligibilityContext {
    const consent = order.consentRef
      ? this.consent.check({
          consentRef: order.consentRef,
          subjectOrCohortRef: this.instrument(order.instrumentId)?.underlyingReference ?? '',
          purpose: order.purpose ?? '',
          recipientClass: order.recipientClass ?? '',
          operation: 'MATCH',
        })
      : { active: !this.instrument(order.instrumentId)?.rightsPolicy.requiresConsent, revoked: false };
    return Object.freeze({
      actorClass: order.actorClass,
      capabilities: order.capabilities,
      jurisdiction: order.jurisdiction,
      geography: order.geography,
      machineId: order.machineId,
      purpose: order.purpose,
      recipientClass: order.recipientClass,
      consentActive: consent.active,
      consentRevoked: consent.revoked,
      verifiedAccount: true,
      access: 'PUBLIC_DEVELOPMENT',
    });
  }

  private recordEligibilityReject(codes: readonly string[], input: PlaceUniversalOrderInput): void {
    if (codes.includes('PURPOSE_MISMATCH')) {
      this.store.unauthorizedPurpose.push(input.purpose ?? input.accountId);
    }
    if (codes.includes('CONSENT_MISSING') || codes.includes('CONSENT_REVOKED')) {
      this.store.consentMismatches.push(input.accountId);
    }
    if (codes.includes('MARKET_ACCESS_DENIED')) {
      this.store.deniedAccess.push(input.accountId);
    }
  }

  private refreshFamilyData(
    marketId: ExchangeMarketId,
    family: MarketFamily,
    clearingPrice?: ExchangePrice,
    available?: bigint,
  ): void {
    const open = [...this.store.universalOrders.values()].filter(
      (order) => order.marketId === marketId && (order.status === 'OPEN' || order.status === 'PARTIALLY_FILLED'),
    );
    const bids = open.filter((order) => order.side === 'BUY' && order.limitPrice).sort((a, b) => comparePrice(b.limitPrice!, a.limitPrice!));
    const asks = open.filter((order) => order.side === 'SELL' && order.limitPrice).sort((a, b) => comparePrice(a.limitPrice!, b.limitPrice!));
    const gpu = this.instrument('instrument:gpu-second');
    const capacity = this.instrument('instrument:manufacturing-capacity');
    this.store.familyMarketData.set(
      marketId,
      familyMarketData({
        marketId,
        family,
        mode: family === 'PRODUCTIVE_CAPACITY' ? 'BATCH_AUCTION' : 'CONTINUOUS',
        bestBid: bids[0]?.limitPrice ?? null,
        bestAsk: asks[0]?.limitPrice ?? null,
        lastTradePrice: asks[0]?.limitPrice ?? bids[0]?.limitPrice ?? clearingPrice ?? null,
        volume: 0n,
        availableQuantity: available ?? asks.reduce((sum, order) => sum + order.remaining, 0n),
        clearingPrice: clearingPrice ?? null,
        verifiedDelivery: [...this.store.capacityContracts.values()].reduce((sum, row) => sum + row.delivered, 0n),
        unitPrice: asks[0]?.limitPrice ?? null,
        availableCapacity: asks.reduce((sum, order) => sum + order.remaining, 0n),
        contractAvailability: asks.reduce((sum, order) => sum + order.remaining, 0n),
        purposeCategory: family === 'HUMAN_INFORMATION_RIGHT' ? 'AGGREGATED_RESEARCH' : null,
        authorizedOutputType: family === 'HUMAN_INFORMATION_RIGHT' ? 'AGGREGATE_ONLY' : null,
        deliveryWindow: gpu?.extension.kind === 'INTELLIGENCE_COMPUTE' ? gpu.extension.deliveryWindow : null,
        deliveryPeriod:
          capacity?.extension.kind === 'PRODUCTIVE_CAPACITY' ? capacity.extension.deliveryWindow : null,
      }),
    );
  }
}

export function moonreyPrice(priceUnits: bigint, baseAssetId = 'GPU_SECOND'): ExchangePrice {
  return exchangePrice({
    baseAssetId,
    quoteAssetId: MOONREY_COIN_ASSET_ID,
    quoteKind: 'ASSET',
    priceUnits,
    quoteScale: 0,
    basePrecision: 0,
  });
}

