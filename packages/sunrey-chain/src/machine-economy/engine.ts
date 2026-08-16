/**
 * Deterministic machine-economy engine.
 *
 * Machines transact only inside a controller-granted bounded mandate.
 * They cannot validate, govern, issue Execution Authority, or mint
 * MoonRey. Settlement is escrow + verified delivery + contract terms.
 */

import { commitCanonical } from '../hash.ts';
import { NATIVE_ASSET_IDS, type NativeAssetId } from '../protocol/assets.ts';
import {
  CLASSICAL_MACHINE_SUITE,
  createMachineKey,
  nextSuiteForMigration,
  seedFromLabel,
  signMachinePayload,
  suiteSupportsMachineLifecycle,
  verifyMachinePayload,
} from './keys.ts';
import { developmentPorts, type MachineEconomyPorts } from './ports.ts';
import {
  FORBIDDEN_MACHINE_AUTHORITIES,
  MACHINE_CAPABILITIES,
  MACHINE_ECONOMY_POLICY_VERSION,
  MACHINE_ECONOMY_SCHEMA_VERSION,
  MACHINE_TYPE_TO_ACTOR,
  MACHINE_TYPES,
  type ApprovalRule,
  type CapabilityManifest,
  type CounterpartyClass,
  type FactSource,
  type ForbiddenMachineAuthority,
  type IntegerQuantity,
  type MachineAction,
  type MachineActionIntent,
  type MachineAuditRecord,
  type MachineCommerceDispute,
  type MachineDeliveryProof,
  type MachineEconomicIdentity,
  type MachineEconomyMetrics,
  type MachineEscrow,
  type MachineKeyRecord,
  type MachinePurchaseOrder,
  type MachineRejection,
  type MachineResourceMandate,
  type MachineServiceOffer,
  type MachineSettlement,
  type MachineSpendingMandate,
  type MachineStatus,
  type MachineType,
  type MeteringSession,
  type RejectionCode,
  type ResourceUnit,
  type ServiceCategory,
  type VerifiedEconomicFact,
} from './types.ts';
import { UnitRegistry } from './units.ts';

const EPOCH_MS = 86_400_000;
const HIGH_VALUE_THRESHOLD = 10_000n;

export type RegisterMachineInput = {
  readonly machineId: string;
  readonly machineType: MachineType;
  readonly ownerActor: string;
  readonly controllerActor: string;
  readonly operatorActor?: string | null;
  readonly hardwareIdentityRef: string;
  readonly softwareModelRef: string;
  readonly firmwareHash: string;
  readonly modelHash: string;
  readonly jurisdiction: string;
  readonly approvedAssets?: readonly NativeAssetId[];
  readonly seedLabel?: string;
  readonly suiteId?: string;
  readonly expiresAtUtc?: string | null;
};

export type GrantCapabilitiesInput = {
  readonly machineId: string;
  readonly controllerActor: string;
  readonly capabilities: readonly (typeof MACHINE_CAPABILITIES)[number][];
};

export type SetSpendingMandateInput = Omit<MachineSpendingMandate, 'schemaVersion' | 'policyVersion'> & {
  readonly machineId: string;
  readonly controllerActor: string;
};

export type SetResourceMandateInput = Omit<MachineResourceMandate, 'schemaVersion'> & {
  readonly machineId: string;
  readonly controllerActor: string;
};

export type PurchaseInput = {
  readonly orderId: string;
  readonly buyerMachineId: string;
  readonly providerMachineId: string;
  readonly offerId: string;
  readonly quantity: IntegerQuantity;
  readonly maxPrice?: IntegerQuantity;
  readonly purpose: string;
  readonly deliveryFromUtc: string;
  readonly deliveryUntilUtc: string;
  readonly seedLabel: string;
  readonly nonce: string;
  readonly matchingMode?: 'DIRECT_BILATERAL' | 'EXCHANGE_ADAPTER';
  readonly meteringMethod?: 'ORACLE_NETWORK' | 'POLICY_PERMITTED_SELF_REPORT';
};

function utcNow(clockMs: number): string {
  return new Date(clockMs).toISOString();
}

function parseUtc(value: string): number {
  return Date.parse(value);
}

function capabilityFor(category: ServiceCategory, side: 'BUY' | 'SELL'): (typeof MACHINE_CAPABILITIES)[number] {
  switch (category) {
    case 'GPU_COMPUTE':
    case 'AI_INFERENCE':
      return side === 'BUY' ? 'PURCHASE_COMPUTE' : 'SELL_COMPUTE';
    case 'ENERGY':
      return side === 'BUY' ? 'PURCHASE_ENERGY' : 'SELL_ENERGY';
    case 'BATTERY_STORAGE':
    case 'WAREHOUSE_STORAGE':
      return side === 'BUY' ? 'PURCHASE_STORAGE' : 'SELL_STORAGE';
    case 'NETWORK_BANDWIDTH':
      return side === 'BUY' ? 'PURCHASE_BANDWIDTH' : 'SELL_BANDWIDTH';
    case 'MANUFACTURING_TIME':
      return side === 'BUY' ? 'PURCHASE_GOODS' : 'SELL_GOODS';
    case 'DELIVERY_SERVICE':
      return side === 'BUY' ? 'REQUEST_LOGISTICS' : 'PROVIDE_LOGISTICS';
    case 'ROBOT_LABOR':
      return side === 'BUY' ? 'PURCHASE_SERVICE' : 'PROVIDE_SERVICE';
    default: {
      const _never: never = category;
      return _never;
    }
  }
}

function resourceDimensionLimit(mandate: MachineResourceMandate, unit: ResourceUnit): IntegerQuantity {
  const record = UnitRegistry.get(unit);
  switch (record.dimension) {
    case 'COMPUTE':
      return mandate.maxCompute;
    case 'ENERGY':
      return mandate.maxEnergy;
    case 'BANDWIDTH':
      return mandate.maxBandwidth;
    case 'STORAGE':
      return mandate.maxStorage;
    case 'PRODUCTION':
      return mandate.maxProductionCommitment;
    case 'LOGISTICS':
    case 'SERVICE':
      return mandate.maxDeliveryObligation;
    default: {
      const _never: never = record.dimension;
      return _never;
    }
  }
}

export class MachineEconomyEngine {
  readonly ports: MachineEconomyPorts;
  private clockMs: number;
  private seq = 0;
  private readonly identities = new Map<string, MachineEconomicIdentity>();
  private readonly offers = new Map<string, MachineServiceOffer>();
  private readonly orders = new Map<string, MachinePurchaseOrder>();
  private readonly escrows = new Map<string, MachineEscrow>();
  private readonly sessions = new Map<string, MeteringSession>();
  private readonly proofs = new Map<string, MachineDeliveryProof>();
  private readonly settlements = new Map<string, MachineSettlement>();
  private readonly disputes = new Map<string, MachineCommerceDispute>();
  private readonly rejections: MachineRejection[] = [];
  private readonly audits: MachineAuditRecord[] = [];
  private readonly nonces = new Set<string>();
  private readonly epochSpend = new Map<string, IntegerQuantity>();
  private readonly outstanding = new Map<string, IntegerQuantity>();
  private readonly resourceUsed = new Map<string, IntegerQuantity>();
  private readonly seeds = new Map<string, string>();
  private transactions = 0;
  private mandateRejections = 0;
  private revocations = 0;
  private oracleConflicts = 0;
  private resourceVolume = 0n;
  private readonly settlementVolume: Record<NativeAssetId, bigint> = {
    SUNREY_COIN: 0n,
    MOONREY_COIN: 0n,
  };

  constructor(ports: MachineEconomyPorts = developmentPorts(), clockMs = Date.parse('2026-08-16T00:00:00.000Z')) {
    this.ports = ports;
    this.clockMs = clockMs;
  }

  nowUtc(): string {
    return utcNow(this.clockMs);
  }

  advanceClock(ms: number): void {
    this.clockMs += ms;
  }

  listIdentities(): readonly MachineEconomicIdentity[] {
    return [...this.identities.values()];
  }

  getIdentity(machineId: string): MachineEconomicIdentity | undefined {
    return this.identities.get(machineId);
  }

  listOffers(): readonly MachineServiceOffer[] {
    return [...this.offers.values()];
  }

  getOffer(offerId: string): MachineServiceOffer | undefined {
    return this.offers.get(offerId);
  }

  getOrder(orderId: string): MachinePurchaseOrder | undefined {
    return this.orders.get(orderId);
  }

  getEscrow(escrowId: string): MachineEscrow | undefined {
    return this.escrows.get(escrowId);
  }

  escrowForOrder(orderId: string): MachineEscrow | undefined {
    return [...this.escrows.values()].find((item) => item.orderId === orderId);
  }

  getSession(sessionId: string): MeteringSession | undefined {
    return this.sessions.get(sessionId);
  }

  sessionForOrder(orderId: string): MeteringSession | undefined {
    return [...this.sessions.values()].find((item) => item.orderId === orderId);
  }

  getProof(proofId: string): MachineDeliveryProof | undefined {
    return this.proofs.get(proofId);
  }

  getSettlement(settlementId: string): MachineSettlement | undefined {
    return this.settlements.get(settlementId);
  }

  settlementForOrder(orderId: string): MachineSettlement | undefined {
    return [...this.settlements.values()].find((item) => item.orderId === orderId);
  }

  listRejections(): readonly MachineRejection[] {
    return this.rejections;
  }

  listAudits(): readonly MachineAuditRecord[] {
    return this.audits;
  }

  creditDevelopmentUnits(ownerId: string, assetId: NativeAssetId, quantity: IntegerQuantity): void {
    this.ports.locks.credit(ownerId, assetId, quantity);
  }

  register(input: RegisterMachineInput): MachineEconomicIdentity | MachineRejection {
    if (!(MACHINE_TYPES as readonly string[]).includes(input.machineType)) {
      return this.reject(input.machineId, 'MACHINE_NOT_FOUND', 'unknown machine type', null);
    }
    const created = createMachineKey({
      keyId: `${input.machineId}_key_1`,
      seedLabel: input.seedLabel ?? input.machineId,
      suiteId: input.suiteId ?? CLASSICAL_MACHINE_SUITE,
      createdAtUtc: this.nowUtc(),
    });
    if (!suiteSupportsMachineLifecycle(created.record.suiteId)) {
      return this.reject(input.machineId, 'SIGNATURE_INVALID', 'unsupported machine CryptoSuite', null);
    }
    const identity: MachineEconomicIdentity = Object.freeze({
      schemaVersion: MACHINE_ECONOMY_SCHEMA_VERSION,
      machineId: input.machineId,
      actorId: `actor.${input.machineId}`,
      actorType: MACHINE_TYPE_TO_ACTOR[input.machineType],
      machineType: input.machineType,
      ownerActor: input.ownerActor,
      controllerActor: input.controllerActor,
      operatorActor: input.operatorActor ?? null,
      hardwareIdentityRef: input.hardwareIdentityRef,
      softwareModelRef: input.softwareModelRef,
      firmwareHash: input.firmwareHash,
      modelHash: input.modelHash,
      keys: [created.record],
      cryptoSuiteId: created.record.suiteId,
      capabilityManifest: Object.freeze({
        schemaVersion: MACHINE_ECONOMY_SCHEMA_VERSION,
        capabilities: [],
        grantedByController: input.controllerActor,
        grantedAtUtc: this.nowUtc(),
        policyVersion: MACHINE_ECONOMY_POLICY_VERSION,
      }),
      approvedAssets: input.approvedAssets ?? [...NATIVE_ASSET_IDS],
      spendingMandate: null,
      resourceMandate: null,
      jurisdiction: input.jurisdiction,
      policyRefs: ['sunrey.machine.policy.v1'],
      activatedAtUtc: this.nowUtc(),
      expiresAtUtc: input.expiresAtUtc ?? null,
      status: 'ACTIVE',
      revocationReason: null,
    });
    this.identities.set(identity.machineId, identity);
    this.seeds.set(identity.machineId, input.seedLabel ?? input.machineId);
    this.audit('REGISTER', identity.machineId, { machineType: identity.machineType, actorType: identity.actorType });
    return identity;
  }

  grantCapabilities(input: GrantCapabilitiesInput): CapabilityManifest | MachineRejection {
    const machine = this.identities.get(input.machineId);
    if (!machine) {
      return this.reject(input.machineId, 'MACHINE_NOT_FOUND', 'machine is not registered', null);
    }
    if (machine.controllerActor !== input.controllerActor) {
      return this.reject(input.machineId, 'FORBIDDEN_AUTHORITY', 'only the controller may grant capabilities', null);
    }
    if (machine.status === 'REVOKED') {
      return this.reject(input.machineId, 'MACHINE_NOT_ACTIVE', 'revoked machine cannot receive capabilities', null);
    }
    const unknown = input.capabilities.filter((cap) => !(MACHINE_CAPABILITIES as readonly string[]).includes(cap));
    if (unknown.length > 0) {
      return this.reject(input.machineId, 'CAPABILITY_MISSING', `unknown capability ${unknown[0]}`, null);
    }
    const manifest: CapabilityManifest = Object.freeze({
      schemaVersion: MACHINE_ECONOMY_SCHEMA_VERSION,
      capabilities: Object.freeze([...input.capabilities]),
      grantedByController: input.controllerActor,
      grantedAtUtc: this.nowUtc(),
      policyVersion: MACHINE_ECONOMY_POLICY_VERSION,
    });
    this.identities.set(input.machineId, Object.freeze({ ...machine, capabilityManifest: manifest }));
    this.audit('GRANT_CAPABILITY', input.machineId, { count: manifest.capabilities.length });
    return manifest;
  }

  setSpendingMandate(input: SetSpendingMandateInput): MachineSpendingMandate | MachineRejection {
    const machine = this.identities.get(input.machineId);
    if (!machine || machine.controllerActor !== input.controllerActor) {
      return this.reject(input.machineId, 'FORBIDDEN_AUTHORITY', 'controller approval required for spending mandate', null);
    }
    const mandate: MachineSpendingMandate = Object.freeze({
      schemaVersion: MACHINE_ECONOMY_SCHEMA_VERSION,
      mandateId: input.mandateId,
      allowedAssetIds: Object.freeze([...input.allowedAssetIds]),
      maxPerTransaction: input.maxPerTransaction,
      maxPerEpoch: input.maxPerEpoch,
      maxOutstandingCommitments: input.maxOutstandingCommitments,
      approvedCounterpartyClasses: Object.freeze([...input.approvedCounterpartyClasses]),
      approvedServiceCategories: Object.freeze([...input.approvedServiceCategories]),
      purposeConstraints: Object.freeze([...input.purposeConstraints]),
      expiresAtUtc: input.expiresAtUtc,
      controllerApprovalThreshold: input.controllerApprovalThreshold,
      policyVersion: MACHINE_ECONOMY_POLICY_VERSION,
    });
    this.identities.set(input.machineId, Object.freeze({ ...machine, spendingMandate: mandate }));
    this.audit('SET_SPENDING_MANDATE', input.machineId, { mandateId: mandate.mandateId });
    return mandate;
  }

  setResourceMandate(input: SetResourceMandateInput): MachineResourceMandate | MachineRejection {
    const machine = this.identities.get(input.machineId);
    if (!machine || machine.controllerActor !== input.controllerActor) {
      return this.reject(input.machineId, 'FORBIDDEN_AUTHORITY', 'controller approval required for resource mandate', null);
    }
    const mandate: MachineResourceMandate = Object.freeze({
      schemaVersion: MACHINE_ECONOMY_SCHEMA_VERSION,
      mandateId: input.mandateId,
      maxCompute: input.maxCompute,
      maxEnergy: input.maxEnergy,
      maxBandwidth: input.maxBandwidth,
      maxStorage: input.maxStorage,
      maxProductionCommitment: input.maxProductionCommitment,
      maxDeliveryObligation: input.maxDeliveryObligation,
      unitRefs: Object.freeze({ ...input.unitRefs }),
    });
    this.identities.set(input.machineId, Object.freeze({ ...machine, resourceMandate: mandate }));
    this.audit('SET_RESOURCE_MANDATE', input.machineId, { mandateId: mandate.mandateId });
    return mandate;
  }

  postOffer(offer: Omit<MachineServiceOffer, 'schemaVersion'>): MachineServiceOffer | MachineRejection {
    const provider = this.requireActive(offer.providerMachineId, null);
    if ('code' in provider) {
      return provider;
    }
    const needed = capabilityFor(offer.serviceCategory, 'SELL');
    if (!provider.capabilityManifest.capabilities.includes(needed)) {
      return this.reject(offer.providerMachineId, 'UNAUTHORIZED_SERVICE', `missing ${needed}`, null);
    }
    if (!UnitRegistry.known(offer.unit) || offer.capacity <= 0n || offer.pricePerUnit < 0n) {
      return this.reject(offer.providerMachineId, 'QUANTITY_INVALID', 'offer quantity or unit is invalid', null);
    }
    const recorded: MachineServiceOffer = Object.freeze({
      schemaVersion: MACHINE_ECONOMY_SCHEMA_VERSION,
      ...offer,
    });
    this.offers.set(recorded.offerId, recorded);
    this.audit('POST_OFFER', offer.providerMachineId, { offerId: recorded.offerId, category: recorded.serviceCategory });
    return recorded;
  }

  submitPurchase(input: PurchaseInput): MachinePurchaseOrder | MachineRejection {
    const buyer = this.requireActive(input.buyerMachineId, input.orderId);
    if ('code' in buyer) {
      return buyer;
    }
    const offer = this.offers.get(input.offerId);
    if (!offer || offer.providerMachineId !== input.providerMachineId) {
      return this.reject(input.buyerMachineId, 'OFFER_NOT_FOUND', 'service offer is not available', input.orderId);
    }
    const needed = capabilityFor(offer.serviceCategory, 'BUY');
    if (!buyer.capabilityManifest.capabilities.includes(needed)) {
      return this.reject(input.buyerMachineId, 'UNAUTHORIZED_SERVICE', `missing ${needed}`, input.orderId);
    }
    if (input.quantity <= 0n || input.quantity > offer.capacity) {
      return this.reject(input.buyerMachineId, 'QUANTITY_INVALID', 'purchase quantity is outside offer capacity', input.orderId);
    }
    const maxPrice = input.maxPrice ?? offer.pricePerUnit * input.quantity;
    if (maxPrice < offer.pricePerUnit * input.quantity) {
      return this.reject(input.buyerMachineId, 'SPENDING_LIMIT_EXCEEDED', 'max price below offer terms', input.orderId);
    }
    if (!buyer.approvedAssets.includes(offer.settlementAsset) || !offer.acceptedAssets.includes(offer.settlementAsset)) {
      return this.reject(input.buyerMachineId, 'UNSUPPORTED_ASSET', 'settlement asset is not approved', input.orderId);
    }
    const fee = this.ports.fees.feeFor(maxPrice);
    const accounted = maxPrice + fee;
    const mandateCheck = this.checkSpending(buyer, offer, accounted, maxPrice, input.purpose);
    if (mandateCheck) {
      return mandateCheck;
    }
    const resourceCheck = this.checkResource(buyer, offer.unit, input.quantity);
    if (resourceCheck) {
      return resourceCheck;
    }
    const matching = this.ports.matching.match(
      {
        offerId: offer.offerId,
        providerMachineId: offer.providerMachineId,
        matchingMode: input.matchingMode ?? 'DIRECT_BILATERAL',
      },
      [...this.offers.values()],
    );
    if (!matching.ok) {
      return this.reject(input.buyerMachineId, 'OFFER_NOT_FOUND', matching.reason, input.orderId);
    }
    const intent = this.signedIntent({
      machine: buyer,
      action: 'SUBMIT_PURCHASE',
      counterpartyId: offer.providerMachineId,
      resource: offer.serviceCategory,
      quantity: input.quantity,
      unit: offer.unit,
      assetId: offer.settlementAsset,
      maxPrice,
      purpose: input.purpose,
      mandateRef: buyer.spendingMandate?.mandateId ?? null,
      nonce: input.nonce,
      seedLabel: input.seedLabel,
    });
    if ('code' in intent) {
      return intent;
    }
    const order: MachinePurchaseOrder = Object.freeze({
      schemaVersion: MACHINE_ECONOMY_SCHEMA_VERSION,
      orderId: input.orderId,
      buyerMachineId: buyer.machineId,
      providerMachineId: offer.providerMachineId,
      offerId: offer.offerId,
      resource: offer.serviceCategory,
      quantity: input.quantity,
      unit: offer.unit,
      maxPrice,
      deliveryFromUtc: input.deliveryFromUtc,
      deliveryUntilUtc: input.deliveryUntilUtc,
      meteringMethod: input.meteringMethod ?? 'ORACLE_NETWORK',
      settlementAsset: offer.settlementAsset,
      escrowRequired: true,
      purpose: input.purpose,
      matchingMode: input.matchingMode ?? 'DIRECT_BILATERAL',
      protocolFee: fee,
    });
    this.orders.set(order.orderId, order);
    this.addEpochSpend(buyer.machineId, accounted);
    this.addOutstanding(buyer.machineId, maxPrice);
    this.addResourceUsed(buyer.machineId, offer.unit, input.quantity);
    this.transactions += 1;
    this.audit('SUBMIT_PURCHASE', buyer.machineId, { orderId: order.orderId, fee: fee.toString() });
    return order;
  }

  lockEscrow(orderId: string): MachineEscrow | MachineRejection {
    const order = this.orders.get(orderId);
    if (!order) {
      return this.reject('unknown', 'ESCROW_NOT_FOUND', 'purchase order is missing', orderId);
    }
    const buyer = this.requireActive(order.buyerMachineId, orderId);
    if ('code' in buyer) {
      return buyer;
    }
    try {
      const lock = this.ports.locks.lock(order.buyerMachineId, order.settlementAsset, order.maxPrice);
      const escrow: MachineEscrow = Object.freeze({
        escrowId: `escrow_${order.orderId}`,
        orderId: order.orderId,
        buyerMachineId: order.buyerMachineId,
        providerMachineId: order.providerMachineId,
        assetId: order.settlementAsset,
        locked: order.maxPrice,
        paid: 0n,
        releasedUnused: 0n,
        status: 'LOCKED',
        lockRef: lock.lockId,
      });
      this.escrows.set(escrow.escrowId, escrow);
      this.audit('LOCK_ESCROW', order.buyerMachineId, { escrowId: escrow.escrowId, locked: escrow.locked.toString() });
      return escrow;
    } catch {
      return this.reject(order.buyerMachineId, 'ESCROW_UNSAFE_STATE', 'native lock refused', orderId);
    }
  }

  startMetering(orderId: string, sessionId: string): MeteringSession | MachineRejection {
    const order = this.orders.get(orderId);
    const escrow = this.escrowForOrder(orderId);
    if (!order || !escrow || escrow.status !== 'LOCKED') {
      return this.reject(order?.buyerMachineId ?? 'unknown', 'ESCROW_UNSAFE_STATE', 'metering requires locked escrow', orderId);
    }
    const session: MeteringSession = Object.freeze({
      sessionId,
      orderId,
      buyerMachineId: order.buyerMachineId,
      providerMachineId: order.providerMachineId,
      resource: order.resource,
      unit: order.unit,
      maximumQuantity: order.quantity,
      startUtc: this.nowUtc(),
      endUtc: null,
      meterFeedIds: [`oracle.${sessionId}`],
      settlementAsset: order.settlementAsset,
      status: 'ACTIVE',
    });
    this.sessions.set(sessionId, session);
    this.audit('START_METERING', order.buyerMachineId, { sessionId });
    return session;
  }

  reportDelivery(input: {
    readonly sessionId: string;
    readonly factId: string;
    readonly quantity: IntegerQuantity;
    readonly source: FactSource;
    readonly finalized?: boolean;
    readonly conflicted?: boolean;
  }): VerifiedEconomicFact | MachineRejection {
    const session = this.sessions.get(input.sessionId);
    if (!session || session.status === 'CLOSED') {
      return this.reject('unknown', 'ESCROW_NOT_FOUND', 'metering session is not active', input.sessionId);
    }
    const fact: VerifiedEconomicFact = Object.freeze({
      factId: input.factId,
      sessionId: input.sessionId,
      resource: session.resource,
      quantity: input.quantity,
      unit: session.unit,
      source: input.source,
      finalized: input.finalized ?? true,
      conflicted: input.conflicted ?? false,
      oracleRefs: input.source === 'ORACLE_NETWORK' ? [`oracle.${input.sessionId}`] : [],
    });
    this.ports.oracles.record(fact);
    if (fact.conflicted) {
      this.oracleConflicts += 1;
      this.sessions.set(session.sessionId, Object.freeze({ ...session, status: 'CONFLICTED' }));
    }
    this.audit('REPORT_DELIVERY', session.buyerMachineId, { factId: fact.factId, source: fact.source });
    return fact;
  }

  finalizeDelivery(sessionId: string, proofId: string): MachineDeliveryProof | MachineRejection {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return this.reject('unknown', 'ESCROW_NOT_FOUND', 'metering session missing', sessionId);
    }
    const order = this.orders.get(session.orderId);
    if (!order) {
      return this.reject(session.buyerMachineId, 'ESCROW_NOT_FOUND', 'order missing for delivery', session.orderId);
    }
    if (this.ports.oracles.hasConflict(sessionId) || session.status === 'CONFLICTED') {
      return this.reject(session.buyerMachineId, 'ORACLE_CONFLICT', 'oracle conflict prevents ordinary settlement', session.orderId);
    }
    const facts = this.ports.oracles.factsFor(sessionId).filter((fact) => fact.finalized && !fact.conflicted);
    const highValue = order.maxPrice >= HIGH_VALUE_THRESHOLD;
    const oracleFacts = facts.filter((fact) => fact.source === 'ORACLE_NETWORK');
    const usable = highValue && order.meteringMethod !== 'POLICY_PERMITTED_SELF_REPORT' ? oracleFacts : facts;
    if (highValue && order.meteringMethod !== 'POLICY_PERMITTED_SELF_REPORT' && oracleFacts.length === 0) {
      return this.reject(session.buyerMachineId, 'SELF_REPORT_INSUFFICIENT', 'high-value settlement requires oracle facts', session.orderId);
    }
    const delivered = usable.reduce((sum, fact) => sum + fact.quantity, 0n);
    const bounded = delivered > session.maximumQuantity ? session.maximumQuantity : delivered;
    const proof: MachineDeliveryProof = Object.freeze({
      proofId,
      sessionId,
      orderId: session.orderId,
      factIds: usable.map((fact) => fact.factId),
      deliveredQuantity: bounded,
      unit: session.unit,
      finalized: true,
      highValue,
    });
    this.proofs.set(proofId, proof);
    this.sessions.set(sessionId, Object.freeze({ ...session, status: 'CLOSED', endUtc: this.nowUtc() }));
    this.resourceVolume += bounded;
    this.audit('FINALIZE_DELIVERY', session.buyerMachineId, {
      proofId,
      delivered: bounded.toString(),
    });
    return proof;
  }

  settle(orderId: string, settlementId: string): MachineSettlement | MachineRejection {
    const order = this.orders.get(orderId);
    const escrow = this.escrowForOrder(orderId);
    const proof = [...this.proofs.values()].find((item) => item.orderId === orderId);
    if (!order || !escrow || !proof || !proof.finalized) {
      return this.reject(order?.buyerMachineId ?? 'unknown', 'ESCROW_UNSAFE_STATE', 'settlement requires finalized delivery and escrow', orderId);
    }
    if (escrow.status === 'DISPUTED' || escrow.status === 'RECOVERY_HOLD') {
      return this.reject(order.buyerMachineId, 'ESCROW_UNSAFE_STATE', 'disputed escrow cannot settle ordinarily', orderId);
    }
    const unitPrice = order.quantity === 0n ? 0n : order.maxPrice / order.quantity;
    const payable = unitPrice * proof.deliveredQuantity;
    const unused = escrow.locked - payable;
    if (payable < 0n || unused < 0n || payable + unused !== escrow.locked) {
      return this.reject(order.buyerMachineId, 'QUANTITY_INVALID', 'settlement arithmetic is not exact', orderId);
    }
    if (payable > 0n) {
      this.ports.locks.transferLocked(escrow.lockRef, order.providerMachineId, payable);
    }
    if (unused > 0n) {
      this.ports.locks.release(escrow.lockRef, unused);
    }
    const nextEscrow: MachineEscrow = Object.freeze({
      ...escrow,
      paid: payable,
      releasedUnused: unused,
      status: unused > 0n && payable > 0n ? 'PARTIALLY_RELEASED' : payable > 0n ? 'SETTLED' : 'RELEASED_UNUSED',
    });
    this.escrows.set(escrow.escrowId, nextEscrow);
    this.addOutstanding(order.buyerMachineId, -escrow.locked);
    const eligible = this.ports.productive.markEligible(proof.proofId, proof.deliveredQuantity);
    const settlement: MachineSettlement = Object.freeze({
      settlementId,
      orderId,
      escrowId: escrow.escrowId,
      assetId: order.settlementAsset,
      paid: payable,
      unusedReleased: unused,
      protocolFee: order.protocolFee,
      converted: false,
      productiveEligible: eligible.eligible,
      moonreyIssued: false,
    });
    this.settlements.set(settlementId, settlement);
    this.settlementVolume[order.settlementAsset] += payable;
    this.audit('SETTLE', order.buyerMachineId, {
      settlementId,
      paid: payable.toString(),
      unused: unused.toString(),
    });
    return settlement;
  }

  openDispute(orderId: string, reason: MachineCommerceDispute['reason'], openedBy: string): MachineCommerceDispute | MachineRejection {
    const escrow = this.escrowForOrder(orderId);
    if (!escrow) {
      return this.reject(openedBy, 'ESCROW_NOT_FOUND', 'dispute requires an escrow', orderId);
    }
    const opener = this.identities.get(openedBy);
    if (opener && (opener.machineType === 'AI_AGENT' || opener.actorType === 'AI_AGENT')) {
      return this.reject(openedBy, 'FORBIDDEN_AUTHORITY', 'AI cannot resolve its own financial dispute with binding authority', orderId);
    }
    this.escrows.set(escrow.escrowId, Object.freeze({ ...escrow, status: 'DISPUTED' }));
    const dispute: MachineCommerceDispute = Object.freeze({
      disputeId: `disp_${orderId}`,
      orderId,
      escrowId: escrow.escrowId,
      reason,
      openedBy,
      aiBindingResolution: false,
      assetsPreserved: true,
      status: 'OPEN',
    });
    this.disputes.set(dispute.disputeId, dispute);
    this.audit('OPEN_DISPUTE', openedBy, { reason, orderId });
    return dispute;
  }

  refuseAuthority(machineId: string, authority: ForbiddenMachineAuthority): MachineRejection {
    if (!(FORBIDDEN_MACHINE_AUTHORITIES as readonly string[]).includes(authority)) {
      return this.reject(machineId, 'FORBIDDEN_AUTHORITY', 'unknown forbidden authority', null);
    }
    return this.reject(machineId, 'FORBIDDEN_AUTHORITY', `machine cannot ${authority}`, null);
  }

  revoke(machineId: string, controllerActor: string, reason: string): MachineEconomicIdentity | MachineRejection {
    const machine = this.identities.get(machineId);
    if (!machine || machine.controllerActor !== controllerActor) {
      return this.reject(machineId, 'FORBIDDEN_AUTHORITY', 'only the controller may revoke', null);
    }
    const keys = machine.keys.map((key) => (key.status === 'ACTIVE' ? { ...key, status: 'REVOKED' as const } : key));
    const next: MachineEconomicIdentity = Object.freeze({
      ...machine,
      status: 'REVOKED',
      revocationReason: reason,
      keys: Object.freeze(keys),
    });
    this.identities.set(machineId, next);
    this.revocations += 1;
    for (const escrow of this.escrows.values()) {
      if (
        (escrow.buyerMachineId === machineId || escrow.providerMachineId === machineId) &&
        (escrow.status === 'LOCKED' || escrow.status === 'PARTIALLY_RELEASED')
      ) {
        this.escrows.set(escrow.escrowId, Object.freeze({ ...escrow, status: 'RECOVERY_HOLD' }));
      }
    }
    this.audit('REVOKE', machineId, { reason });
    return next;
  }

  setStatus(machineId: string, controllerActor: string, status: Exclude<MachineStatus, 'REVOKED'>): MachineEconomicIdentity | MachineRejection {
    const machine = this.identities.get(machineId);
    if (!machine || machine.controllerActor !== controllerActor) {
      return this.reject(machineId, 'FORBIDDEN_AUTHORITY', 'only the controller may change status', null);
    }
    if (machine.status === 'REVOKED') {
      return this.reject(machineId, 'MACHINE_NOT_ACTIVE', 'revoked machine cannot be reactivated by status change', null);
    }
    const next = Object.freeze({ ...machine, status });
    this.identities.set(machineId, next);
    this.audit(status, machineId, { status });
    return next;
  }

  rotateKeys(machineId: string, controllerActor: string, nextSeedLabel: string, suiteId?: string): MachineKeyRecord | MachineRejection {
    const machine = this.identities.get(machineId);
    if (!machine || machine.controllerActor !== controllerActor) {
      return this.reject(machineId, 'FORBIDDEN_AUTHORITY', 'only the controller may rotate keys', null);
    }
    const current = machine.keys.find((key) => key.status === 'ACTIVE');
    const targetSuite = suiteId ?? (current ? nextSuiteForMigration(current.suiteId) : CLASSICAL_MACHINE_SUITE);
    if (!suiteSupportsMachineLifecycle(targetSuite)) {
      return this.reject(machineId, 'SIGNATURE_INVALID', 'rotation target suite is not permitted', null);
    }
    const created = createMachineKey({
      keyId: `${machineId}_key_${machine.keys.length + 1}`,
      seedLabel: nextSeedLabel,
      suiteId: targetSuite,
      version: (current?.version ?? 0) + 1,
      createdAtUtc: this.nowUtc(),
      rotatedFrom: current?.keyId ?? null,
    });
    const keys = machine.keys.map((key) => (key.status === 'ACTIVE' ? { ...key, status: 'ROTATED' as const } : key));
    this.identities.set(
      machineId,
      Object.freeze({
        ...machine,
        cryptoSuiteId: created.record.suiteId,
        keys: Object.freeze([...keys, created.record]),
      }),
    );
    this.seeds.set(machineId, nextSeedLabel);
    this.audit('ROTATE_KEYS', machineId, { keyId: created.record.keyId, suiteId: created.record.suiteId });
    return created.record;
  }

  recover(machineId: string, controllerActor: string, replacementSeedLabel: string, suiteId?: string): MachineEconomicIdentity | MachineRejection {
    const machine = this.identities.get(machineId);
    if (!machine || machine.controllerActor !== controllerActor) {
      return this.reject(machineId, 'FORBIDDEN_AUTHORITY', 'only the controller may recover', null);
    }
    const rotated = this.rotateKeys(machineId, controllerActor, replacementSeedLabel, suiteId ?? CLASSICAL_MACHINE_SUITE);
    if (isRejection(rotated)) {
      return rotated;
    }
    const current = this.identities.get(machineId);
    if (!current) {
      return this.reject(machineId, 'MACHINE_NOT_FOUND', 'machine missing after recovery', null);
    }
    const next = Object.freeze({
      ...current,
      status: 'ACTIVE' as const,
      revocationReason: null,
    });
    this.identities.set(machineId, next);
    this.audit('RECOVER', machineId, { replacementKey: rotated.keyId });
    return next;
  }

  resolveRecoveryEscrow(escrowId: string, controllerActor: string, action: 'RELEASE_TO_BUYER' | 'PRESERVE'): MachineEscrow | MachineRejection {
    const escrow = this.escrows.get(escrowId);
    if (!escrow) {
      return this.reject(controllerActor, 'ESCROW_NOT_FOUND', 'escrow missing', null);
    }
    const buyer = this.identities.get(escrow.buyerMachineId);
    if (!buyer || buyer.controllerActor !== controllerActor) {
      return this.reject(controllerActor, 'FORBIDDEN_AUTHORITY', 'controller recovery only', null);
    }
    if (escrow.status !== 'RECOVERY_HOLD' && escrow.status !== 'DISPUTED') {
      return this.reject(controllerActor, 'ESCROW_UNSAFE_STATE', 'escrow is not in a recovery state', null);
    }
    if (action === 'RELEASE_TO_BUYER' && escrow.locked - escrow.paid - escrow.releasedUnused > 0n) {
      const remaining = escrow.locked - escrow.paid - escrow.releasedUnused;
      this.ports.locks.release(escrow.lockRef, remaining);
      const next = Object.freeze({
        ...escrow,
        releasedUnused: escrow.releasedUnused + remaining,
        status: 'RELEASED_UNUSED' as const,
      });
      this.escrows.set(escrowId, next);
      return next;
    }
    return escrow;
  }

  stateRoot(): string {
    return commitCanonical({
      domain: 'sunrey.machine.state.v1',
      identities: [...this.identities.values()].map((item) => ({
        ...item,
        keys: item.keys.map((key) => ({ ...key })),
      })),
      offers: [...this.offers.values()],
      orders: [...this.orders.values()].map((item) => ({
        ...item,
        quantity: item.quantity.toString(),
        maxPrice: item.maxPrice.toString(),
        protocolFee: item.protocolFee.toString(),
      })),
      escrows: [...this.escrows.values()].map((item) => ({
        ...item,
        locked: item.locked.toString(),
        paid: item.paid.toString(),
        releasedUnused: item.releasedUnused.toString(),
      })),
      sessions: [...this.sessions.values()].map((item) => ({
        ...item,
        maximumQuantity: item.maximumQuantity.toString(),
      })),
      proofs: [...this.proofs.values()].map((item) => ({
        ...item,
        deliveredQuantity: item.deliveredQuantity.toString(),
      })),
      settlements: [...this.settlements.values()].map((item) => ({
        ...item,
        paid: item.paid.toString(),
        unusedReleased: item.unusedReleased.toString(),
        protocolFee: item.protocolFee.toString(),
      })),
      disputes: [...this.disputes.values()],
      rejections: this.rejections,
    });
  }

  metrics(): MachineEconomyMetrics {
    const locked = [...this.escrows.values()]
      .filter((item) => item.status === 'LOCKED' || item.status === 'RECOVERY_HOLD' || item.status === 'DISPUTED')
      .reduce((sum, item) => sum + (item.locked - item.paid - item.releasedUnused), 0n);
    return Object.freeze({
      active_machine_identities: [...this.identities.values()].filter((item) => item.status === 'ACTIVE').length,
      machine_transactions: this.transactions,
      machine_transaction_rejections: this.rejections.length,
      machine_escrow_locked: locked.toString(),
      machine_settlement_volume_by_asset: Object.freeze({
        SUNREY_COIN: this.settlementVolume.SUNREY_COIN.toString(),
        MOONREY_COIN: this.settlementVolume.MOONREY_COIN.toString(),
      }),
      machine_resource_volume: this.resourceVolume.toString(),
      machine_mandate_rejections: this.mandateRejections,
      machine_revocations: this.revocations,
      machine_disputes: this.disputes.size,
      machine_oracle_conflicts: this.oracleConflicts,
    });
  }

  snapshot(): {
    readonly identities: readonly MachineEconomicIdentity[];
    readonly offers: readonly MachineServiceOffer[];
    readonly orders: readonly MachinePurchaseOrder[];
    readonly escrows: readonly MachineEscrow[];
    readonly sessions: readonly MeteringSession[];
    readonly proofs: readonly MachineDeliveryProof[];
    readonly settlements: readonly MachineSettlement[];
    readonly disputes: readonly MachineCommerceDispute[];
    readonly rejections: readonly MachineRejection[];
    readonly metrics: MachineEconomyMetrics;
    readonly stateRoot: string;
  } {
    return {
      identities: this.listIdentities(),
      offers: this.listOffers(),
      orders: [...this.orders.values()],
      escrows: [...this.escrows.values()],
      sessions: [...this.sessions.values()],
      proofs: [...this.proofs.values()],
      settlements: [...this.settlements.values()],
      disputes: [...this.disputes.values()],
      rejections: this.rejections,
      metrics: this.metrics(),
      stateRoot: this.stateRoot(),
    };
  }

  private requireActive(machineId: string, intentId: string | null): MachineEconomicIdentity | MachineRejection {
    const machine = this.identities.get(machineId);
    if (!machine) {
      return this.reject(machineId, 'MACHINE_NOT_FOUND', 'machine is not registered', intentId);
    }
    if (machine.status !== 'ACTIVE') {
      return this.reject(machineId, 'MACHINE_NOT_ACTIVE', `machine is ${machine.status}`, intentId);
    }
    if (machine.expiresAtUtc && parseUtc(machine.expiresAtUtc) <= this.clockMs) {
      return this.reject(machineId, 'MACHINE_NOT_ACTIVE', 'machine identity has expired', intentId);
    }
    return machine;
  }

  private checkSpending(
    buyer: MachineEconomicIdentity,
    offer: MachineServiceOffer,
    accounted: IntegerQuantity,
    escrowAmount: IntegerQuantity,
    purpose: string,
  ): MachineRejection | null {
    const mandate = buyer.spendingMandate;
    if (!mandate) {
      this.mandateRejections += 1;
      return this.reject(buyer.machineId, 'SPENDING_LIMIT_EXCEEDED', 'no spending mandate', null);
    }
    if (parseUtc(mandate.expiresAtUtc) <= this.clockMs) {
      this.mandateRejections += 1;
      return this.reject(buyer.machineId, 'MANDATE_EXPIRED', 'spending mandate expired', null);
    }
    if (!mandate.allowedAssetIds.includes(offer.settlementAsset)) {
      this.mandateRejections += 1;
      return this.reject(buyer.machineId, 'UNSUPPORTED_ASSET', 'asset is outside spending mandate', null);
    }
    if (!mandate.approvedServiceCategories.includes(offer.serviceCategory)) {
      this.mandateRejections += 1;
      return this.reject(buyer.machineId, 'UNAUTHORIZED_SERVICE', 'service category is outside mandate', null);
    }
    if (mandate.purposeConstraints.length > 0 && !mandate.purposeConstraints.includes(purpose)) {
      this.mandateRejections += 1;
      return this.reject(buyer.machineId, 'MANDATE_PURPOSE_MISMATCH', 'purpose is outside mandate', null);
    }
    if (!mandate.approvedCounterpartyClasses.includes('MACHINE' as CounterpartyClass)) {
      this.mandateRejections += 1;
      return this.reject(buyer.machineId, 'COUNTERPARTY_CLASS_DENIED', 'counterparty class is not approved', null);
    }
    if (accounted > mandate.maxPerTransaction) {
      this.mandateRejections += 1;
      return this.reject(
        buyer.machineId,
        accounted - escrowAmount > 0n && escrowAmount <= mandate.maxPerTransaction
          ? 'FEE_BYPASS_REJECTED'
          : 'SPENDING_LIMIT_EXCEEDED',
        'purchase plus protocol fee exceeds per-transaction mandate',
        null,
      );
    }
    const spent = this.epochSpend.get(this.epochKey(buyer.machineId)) ?? 0n;
    if (spent + accounted > mandate.maxPerEpoch) {
      this.mandateRejections += 1;
      return this.reject(buyer.machineId, 'SPENDING_LIMIT_EXCEEDED', 'epoch spending mandate exceeded', null);
    }
    const open = this.outstanding.get(buyer.machineId) ?? 0n;
    if (open + escrowAmount > mandate.maxOutstandingCommitments) {
      this.mandateRejections += 1;
      return this.reject(buyer.machineId, 'SPENDING_LIMIT_EXCEEDED', 'outstanding commitment mandate exceeded', null);
    }
    const approval = this.approvalOutcome(mandate.controllerApprovalThreshold, accounted, mandate.maxPerTransaction);
    if (approval) {
      this.mandateRejections += 1;
      return approval;
    }
    return null;
  }

  private approvalOutcome(
    rule: ApprovalRule,
    accounted: IntegerQuantity,
    maxPerTransaction: IntegerQuantity,
  ): MachineRejection | null {
    if (rule === 'DENIED') {
      return this.reject('mandate', 'APPROVAL_DENIED', 'mandate approval rule is DENIED', null);
    }
    if (rule === 'CONTROLLER_CONFIRMATION_REQUIRED' && accounted > 0n) {
      return this.reject('mandate', 'CONTROLLER_CONFIRMATION_REQUIRED', 'controller confirmation is required', null);
    }
    if (rule === 'MULTI_PARTY_APPROVAL_REQUIRED') {
      return this.reject('mandate', 'MULTI_PARTY_APPROVAL_REQUIRED', 'multi-party approval is required', null);
    }
    if (rule === 'AUTO_WITHIN_MANDATE' && accounted <= maxPerTransaction) {
      return null;
    }
    return this.reject('mandate', 'APPROVAL_DENIED', 'approval rule refused the action', null);
  }

  private checkResource(buyer: MachineEconomicIdentity, unit: ResourceUnit, quantity: IntegerQuantity): MachineRejection | null {
    const mandate = buyer.resourceMandate;
    if (!mandate) {
      return null;
    }
    const limit = resourceDimensionLimit(mandate, unit);
    const used = this.resourceUsed.get(`${buyer.machineId}:${unit}`) ?? 0n;
    if (used + quantity > limit) {
      this.mandateRejections += 1;
      return this.reject(buyer.machineId, 'RESOURCE_LIMIT_EXCEEDED', `resource mandate exceeded for ${unit}`, null);
    }
    return null;
  }

  private signedIntent(input: {
    readonly machine: MachineEconomicIdentity;
    readonly action: MachineAction;
    readonly counterpartyId: string | null;
    readonly resource: ServiceCategory | null;
    readonly quantity: IntegerQuantity;
    readonly unit: ResourceUnit | null;
    readonly assetId: NativeAssetId | null;
    readonly maxPrice: IntegerQuantity;
    readonly purpose: string;
    readonly mandateRef: string | null;
    readonly nonce: string;
    readonly seedLabel: string;
  }): MachineActionIntent | MachineRejection {
    if (this.nonces.has(`${input.machine.machineId}:${input.nonce}`)) {
      return this.reject(input.machine.machineId, 'NONCE_REPLAY', 'nonce has already been used', null);
    }
    const activeKey = input.machine.keys.find((key) => key.status === 'ACTIVE');
    if (!activeKey) {
      return this.reject(input.machine.machineId, 'KEY_REVOKED', 'no active machine key', null);
    }
    const expectedSeed = this.seeds.get(input.machine.machineId);
    if (expectedSeed !== input.seedLabel) {
      return this.reject(input.machine.machineId, 'KEY_COMPROMISED', 'seed does not match the active machine key', null);
    }
    const payload = commitCanonical({
      machineId: input.machine.machineId,
      action: input.action,
      counterpartyId: input.counterpartyId,
      quantity: input.quantity.toString(),
      nonce: input.nonce,
      purpose: input.purpose,
    });
    const signatureHex = signMachinePayload(seedFromLabel(input.seedLabel), payload);
    if (!verifyMachinePayload(activeKey.publicKeyHex, payload, signatureHex)) {
      return this.reject(input.machine.machineId, 'SIGNATURE_INVALID', 'machine signature failed', null);
    }
    this.nonces.add(`${input.machine.machineId}:${input.nonce}`);
    const intent: MachineActionIntent = Object.freeze({
      schemaVersion: MACHINE_ECONOMY_SCHEMA_VERSION,
      intentId: `intent_${this.nextSeq()}`,
      machineId: input.machine.machineId,
      action: input.action,
      counterpartyId: input.counterpartyId,
      resource: input.resource,
      quantity: input.quantity,
      unit: input.unit,
      assetId: input.assetId,
      maxPrice: input.maxPrice,
      purpose: input.purpose,
      mandateRef: input.mandateRef,
      expiresAtUtc: utcNow(this.clockMs + EPOCH_MS),
      nonce: input.nonce,
      signatureHex,
      publicKeyHex: activeKey.publicKeyHex,
      keyId: activeKey.keyId,
    });
    return intent;
  }

  private epochKey(machineId: string): string {
    return `${machineId}:${Math.floor(this.clockMs / EPOCH_MS)}`;
  }

  private addEpochSpend(machineId: string, amount: IntegerQuantity): void {
    const key = this.epochKey(machineId);
    this.epochSpend.set(key, (this.epochSpend.get(key) ?? 0n) + amount);
  }

  private addOutstanding(machineId: string, amount: IntegerQuantity): void {
    this.outstanding.set(machineId, (this.outstanding.get(machineId) ?? 0n) + amount);
  }

  private addResourceUsed(machineId: string, unit: ResourceUnit, quantity: IntegerQuantity): void {
    const key = `${machineId}:${unit}`;
    this.resourceUsed.set(key, (this.resourceUsed.get(key) ?? 0n) + quantity);
  }

  private nextSeq(): number {
    this.seq += 1;
    return this.seq;
  }

  private reject(machineId: string, code: RejectionCode, reason: string, intentId: string | null): MachineRejection {
    const rejection: MachineRejection = Object.freeze({
      rejectionId: `rej_${this.nextSeq()}`,
      machineId,
      code,
      reason,
      atUtc: this.nowUtc(),
      intentId,
    });
    this.rejections.push(rejection);
    this.audit('REJECT', machineId, { code, reason });
    return rejection;
  }

  private audit(kind: string, machineId: string | null, payload: Readonly<Record<string, string | number | boolean | null>>): void {
    this.audits.push(
      Object.freeze({
        kind,
        machineId,
        contentHash: commitCanonical({ kind, machineId, payload }),
        atUtc: this.nowUtc(),
        payload,
      }),
    );
  }
}

export function isRejection(value: unknown): value is MachineRejection {
  return typeof value === 'object' && value !== null && 'code' in value && 'reason' in value && 'rejectionId' in value;
}
