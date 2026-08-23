/**
 * Customer wallet product service.
 *
 * Extends packages/custody. Kernel-gated deposit credit and withdrawal
 * execution go through CustodyService. This layer owns the customer
 * wallet resource, quotes, client-safe finality, and reconciliation
 * breaks. It is not a second ledger or key authority.
 */

import { createHash, randomUUID } from 'node:crypto';

import type { Clock } from '../../../config/src/clock.ts';
import type { CustomerId } from '../../../domain/src/customer.ts';
import type { Jurisdiction } from '../../../domain/src/jurisdiction.ts';
import type { VerifiedActorContext } from '../../../identity/src/index.ts';
import { isVerifiedActorContext } from '../../../identity/src/index.ts';
import {
  analyticsCannotDecideWithdrawal,
  type BlockchainAnalyticsProvider,
} from '../../../kernel/src/compliance/provider-candidate/blockchain-analytics.ts';
import { AssetQuantity } from '../../../money/src/asset-quantity.ts';
import type { NativeCustodyAssetId } from '../native-assets.ts';
import { isNativeCustodyAssetId } from '../native-assets.ts';
import type { CustomerAssetPort, DestinationRiskProvider, TravelRuleNetworkPort } from '../ports.ts';
import type { CustodyService } from '../service.ts';
import { signSimulationNotice } from '../simulation.ts';
import { evaluateTravelRuleApplicability, type TravelRulePack } from '../travel-rule.ts';
import { asCustodyAccountId, type DestinationId } from '../ids.ts';
import { deriveDepositAddress, validateAddressBinding } from './addresses.ts';
import { estimateWalletFees, feeChangedMaterially } from './fees.ts';
import { depositIsFinal, mapExternalFinality, mapNativeFinality } from './finality.ts';
import { assertNoClientSigningMaterial, productionSigningStatus, refuseSigningMaterial } from './keys.ts';
import type {
  AssetDetail,
  ConsumerWallet,
  DepositAddress,
  WalletProductOutcome,
  WalletReconciliationBreak,
  WalletTransaction,
  WithdrawalQuote,
  WithdrawalResource,
} from './types.ts';
import type { ClientFinalityState, CustodyModel, TravelRuleCustomerState, WalletNetworkId, WalletStatus } from './taxonomy.ts';
import { PRODUCTION_SIGNING_AUTHORIZED } from './taxonomy.ts';

export type WalletActorInput = {
  readonly actorId: string;
  readonly customerId: string;
  readonly verified?: VerifiedActorContext;
  readonly stepUpSatisfied: boolean;
  readonly originatedFromAgent: boolean;
};

type StoredWallet = {
  walletId: string;
  ownerId: string;
  assetId: NativeCustodyAssetId;
  networkId: WalletNetworkId;
  custodyModel: CustodyModel;
  status: WalletStatus;
  withdrawalEnabled: boolean;
  providerRef: string | null;
  custodyAccountId: string;
  createdAt: string;
  operationalApproved: boolean;
  pendingMinorUnits: bigint;
};

type StoredAddress = DepositAddress;

type StoredQuote = WithdrawalQuote & { readonly feeTotal: bigint };

type StoredWithdrawal = WithdrawalResource & {
  readonly destination: string;
  readonly destinationId: DestinationId | null;
  readonly custodyWithdrawalId: string | null;
};

type StoredDeposit = {
  readonly depositId: string;
  readonly walletId: string;
  readonly ownerId: string;
  readonly amountMinorUnits: bigint;
  readonly txRef: string;
  readonly noticeId: string;
  finality: ClientFinalityState;
  credited: boolean;
  createdAt: string;
};

export type WalletProductDeps = {
  readonly clock: Clock;
  readonly custody: CustodyService;
  readonly assets: CustomerAssetPort & {
    seed(ownerId: string, amount: AssetQuantity, custodyAccountId?: string): void;
  };
  readonly analytics: BlockchainAnalyticsProvider;
  readonly destinationRisk: DestinationRiskProvider;
  readonly travelNetwork: TravelRuleNetworkPort;
  readonly pack: TravelRulePack;
  readonly registerProviderAddress: (address: string, custodyAccountId: string, customerId: string) => void;
  readonly hsmReady?: boolean;
  readonly chainAvailable?: boolean;
  readonly custodyAvailable?: boolean;
  readonly exchangePositions?: (ownerId: string, assetId: string) => bigint;
  readonly marketAsOf?: string;
};

export class WalletProductService {
  private readonly wallets = new Map<string, StoredWallet>();
  private readonly addresses = new Map<string, StoredAddress>();
  private readonly quotes = new Map<string, StoredQuote>();
  private readonly withdrawals = new Map<string, StoredWithdrawal>();
  private readonly deposits = new Map<string, StoredDeposit>();
  private readonly destinationByAddress = new Map<string, DestinationId>();
  private readonly breaks: WalletReconciliationBreak[] = [];
  private readonly deps: WalletProductDeps;

  constructor(deps: WalletProductDeps) {
    this.deps = deps;
  }

  provisionWallet(input: {
    readonly walletId?: string;
    readonly ownerId: string;
    readonly assetId: string;
    readonly custodyModel: CustodyModel;
    readonly status?: WalletStatus;
    readonly withdrawalEnabled?: boolean;
    readonly operationalApproved?: boolean;
    readonly seedMinorUnits?: bigint;
    readonly providerRef?: string | null;
  }): WalletProductOutcome<ConsumerWallet> {
    if (!isNativeCustodyAssetId(input.assetId)) {
      return fail('UNSUPPORTED_ASSET', 'asset is not a supported native custody asset');
    }
    if (input.custodyModel === 'INTERNAL_OPERATIONAL' && input.operationalApproved !== true) {
      return fail('OPERATIONAL_NOT_APPROVED', 'INTERNAL_OPERATIONAL wallets require explicit approval');
    }
    const networkId: WalletNetworkId = 'SUNREY_CHAIN';
    const walletId = input.walletId ?? `wal_${randomUUID().replace(/-/g, '')}`;
    const custodyAccountId = input.ownerId;
    const createdAt = this.now();
    const withdrawalEnabled =
      input.custodyModel === 'INTERNAL_OPERATIONAL'
        ? input.withdrawalEnabled === true
        : input.withdrawalEnabled !== false;
    const wallet: StoredWallet = {
      walletId,
      ownerId: input.ownerId,
      assetId: input.assetId,
      networkId,
      custodyModel: input.custodyModel,
      status: input.status ?? 'ACTIVE',
      withdrawalEnabled,
      providerRef: input.providerRef ?? (input.custodyModel === 'EXTERNAL_CUSTODY' ? 'sim-custody-a' : 'sunrey-native'),
      custodyAccountId,
      createdAt,
      operationalApproved: input.operationalApproved === true,
      pendingMinorUnits: 0n,
    };
    this.wallets.set(walletId, wallet);
    const address = this.assignAddress(wallet);
    this.deps.custody.registerAddress(address.address, input.ownerId, asCustodyAccountId(custodyAccountId));
    this.deps.registerProviderAddress(address.address, custodyAccountId, input.ownerId);
    if (input.seedMinorUnits !== undefined && input.seedMinorUnits > 0n) {
      this.deps.assets.seed(
        input.ownerId,
        AssetQuantity.fromScaledUnits(input.seedMinorUnits, input.assetId),
        custodyAccountId,
      );
    } else {
      this.deps.assets.seed(input.ownerId, AssetQuantity.fromScaledUnits(0n, input.assetId), custodyAccountId);
    }
    return ok(this.toWallet(wallet));
  }

  listWallets(ownerId: string): readonly ConsumerWallet[] {
    return Object.freeze(
      [...this.wallets.values()].filter((row) => row.ownerId === ownerId).map((row) => this.toWallet(row)),
    );
  }

  getWallet(ownerId: string, walletId: string): WalletProductOutcome<ConsumerWallet> {
    const wallet = this.requireOwnedWallet(ownerId, walletId);
    if (!wallet.ok) {
      return wallet;
    }
    return ok(this.toWallet(wallet.value));
  }

  depositAddress(ownerId: string, walletId: string): WalletProductOutcome<DepositAddress> {
    const wallet = this.requireOwnedWallet(ownerId, walletId);
    if (!wallet.ok) {
      return wallet;
    }
    const existing = [...this.addresses.values()].find((row) => row.walletId === walletId && row.status !== 'RETIRED');
    if (existing) {
      return ok(existing);
    }
    return ok(this.assignAddress(wallet.value));
  }

  listTransactions(ownerId: string, walletId: string): WalletProductOutcome<readonly WalletTransaction[]> {
    const wallet = this.requireOwnedWallet(ownerId, walletId);
    if (!wallet.ok) {
      return wallet;
    }
    void wallet;
    return ok(this.transactionsFor(walletId));
  }

  quoteWithdrawal(
    ownerId: string,
    walletId: string,
    body: Record<string, unknown>,
    actor: WalletActorInput,
  ): WalletProductOutcome<WithdrawalQuote> {
    const gated = this.precheck(ownerId, walletId, body, actor, 'quote');
    if (!gated.ok) {
      return gated;
    }
    const { wallet, destination, amount } = gated.value;
    const analytics = this.deps.analytics.screenAddress(destination.address, this.deps.clock.now());
    const riskScreen = this.deps.destinationRisk.screen({
      address: destination.address,
      customerId: ownerId,
      assetId: wallet.assetId,
    });
    const travel = this.travelCustomerState(ownerId, amount, destination.address);
    const fees = estimateWalletFees({ amountMinorUnits: amount, networkId: wallet.networkId });
    const risk = riskScreen.outcome === 'BLOCK' ? 'BLOCK' : analytics.outcome === 'REVIEW' || riskScreen.outcome === 'REVIEW' ? 'REVIEW' : 'CLEAR';
    if (!analyticsCannotDecideWithdrawal(analytics)) {
      return fail('ANALYTICS_CANNOT_AUTHORIZE', 'blockchain analytics cannot independently authorize');
    }
    const quoteId = `wquote_${randomUUID().replace(/-/g, '')}`;
    const quote: StoredQuote = Object.freeze({
      schema: 'sunrey.consumer.withdrawal-quote.v1',
      quoteId,
      walletId,
      ownerId,
      assetId: wallet.assetId,
      networkId: wallet.networkId,
      destination: destination.address,
      amountMinorUnits: amount.toString(),
      fees,
      travelRule: travel.state,
      travelRuleRequired: travel.required,
      risk,
      requiredApproval: risk === 'REVIEW' ? 'MANUAL_REVIEW' : 'STEP_UP_AUTHENTICATION',
      expiresAt: this.plusMinutes(15),
      estimate: true,
      productionMoneyMovement: false,
      feeTotal: BigInt(fees.totalEstimateMinorUnits),
    });
    this.quotes.set(quoteId, quote);
    return ok(this.publicQuote(quote));
  }

  createWithdrawal(
    ownerId: string,
    walletId: string,
    body: Record<string, unknown>,
    actor: WalletActorInput,
  ): WalletProductOutcome<WithdrawalResource> {
    if (actor.originatedFromAgent) {
      return this.agentProposal(ownerId, walletId, body, actor);
    }
    return this.executeWithdrawal(ownerId, walletId, body, actor);
  }

  getWithdrawal(ownerId: string, walletId: string, withdrawalId: string): WalletProductOutcome<WithdrawalResource> {
    const wallet = this.requireOwnedWallet(ownerId, walletId);
    if (!wallet.ok) {
      return wallet;
    }
    void wallet;
    const found = this.withdrawals.get(withdrawalId);
    if (!found || found.ownerId !== ownerId || found.walletId !== walletId) {
      return fail('RESOURCE_NOT_OWNED', 'withdrawal is not owned by this customer');
    }
    return ok(this.publicWithdrawal(found));
  }

  assetDetail(ownerId: string, assetId: string): WalletProductOutcome<AssetDetail> {
    if (!isNativeCustodyAssetId(assetId)) {
      return fail('UNSUPPORTED_ASSET', 'asset is not a supported native custody asset');
    }
    const wallet = [...this.wallets.values()].find((row) => row.ownerId === ownerId && row.assetId === assetId);
    const networkStatus = this.deps.chainAvailable === false ? 'OUTAGE' : 'SIMULATION';
    const resource = wallet ? this.toWallet(wallet) : null;
    return ok(
      Object.freeze({
        schema: 'sunrey.consumer.asset-detail.v1',
        assetId,
        displayName: assetId === 'MOONREY_COIN' ? 'MoonRey Coin' : 'SunRey Coin',
        networkId: 'SUNREY_CHAIN',
        wallet: resource,
        marketPrice: {
          label: 'SANDBOX_INDICATIVE',
          source: 'sandbox-fixture',
          asOf: this.deps.marketAsOf ?? this.now(),
          indicative: true,
        },
        marketData: { freshness: 'SANDBOX_FIXTURE', commercialPricing: false },
        supplyData: { circulating: null, reason: 'supply is protocol-owned; this view is not a mint' },
        networkStatus,
        recentActivity: wallet ? this.transactionsFor(wallet.walletId).slice(0, 10) : Object.freeze([]),
        eligibility: {
          depositAvailable: resource !== null && resource.status === 'ACTIVE' && this.deps.chainAvailable !== false,
          withdrawalAvailable:
            resource !== null &&
            resource.status === 'ACTIVE' &&
            resource.withdrawalEnabled &&
            this.deps.custodyAvailable !== false,
          exchangeAvailable: resource !== null,
        },
        productionMoneyMovement: false,
      }),
    );
  }

  ingestDeposit(input: {
    readonly ownerId: string;
    readonly walletId: string;
    readonly amountMinorUnits: bigint;
    readonly txRef: string;
    readonly confirmations: number;
    readonly nativeFinality?: 'PENDING_PROPOSAL' | 'MEMPOOL' | 'BFT_FINALIZED';
    readonly actorId: string;
    readonly review?: boolean;
  }): WalletProductOutcome<WalletTransaction> {
    const wallet = this.requireOwnedWallet(input.ownerId, input.walletId);
    if (!wallet.ok) {
      return wallet;
    }
    const address = [...this.addresses.values()].find((row) => row.walletId === input.walletId);
    if (!address) {
      return fail('ADDRESS_MISSING', 'deposit address has not been assigned');
    }
    const noticeId = `notice_${hash(input.txRef)}`;
    const existing = [...this.deposits.values()].find((row) => row.noticeId === noticeId);
    if (existing) {
      return ok(this.depositTransaction(existing, wallet.value));
    }
    const analytics = this.deps.analytics.screenTransaction(input.txRef, this.deps.clock.now());
    const review = input.review === true || analytics.outcome === 'REVIEW';
    const finality = mapNativeFinality({
      native: input.nativeFinality,
      confirmations: input.confirmations,
      review,
    });
    const deposit: StoredDeposit = {
      depositId: `dep_${randomUUID().replace(/-/g, '')}`,
      walletId: input.walletId,
      ownerId: input.ownerId,
      amountMinorUnits: input.amountMinorUnits,
      txRef: input.txRef,
      noticeId,
      finality,
      credited: false,
      createdAt: this.now(),
    };
    const material = `notice:${noticeId}:${address.address}:${input.amountMinorUnits.toString()}`;
    const ingested = this.deps.custody.ingestExternalDeposit({
      material,
      signatureHex: this.signNotice(material),
      notice: {
        noticeId,
        providerId: 'SIMULATION_CUSTODY',
        signatureValid: true,
        assetId: wallet.value.assetId,
        quantity: AssetQuantity.fromScaledUnits(input.amountMinorUnits, wallet.value.assetId),
        destinationAddress: address.address,
        txRef: input.txRef,
        confirmations: input.confirmations,
        receivedAt: this.deps.clock.now(),
        ...(input.nativeFinality ? { finality: input.nativeFinality } : {}),
      },
    });
    if (ingested.outcome !== 'OK') {
      return fail(ingested.outcome === 'REJECTED' ? ingested.code : 'KERNEL_REFUSED', ingested.outcome === 'REJECTED' ? ingested.message : 'deposit notice refused');
    }
    if (depositIsFinal(finality) && !review) {
      const credited = this.deps.custody.creditExternalDeposit({
        actorId: input.actorId,
        depositId: ingested.value.depositId,
      });
      if (credited.outcome !== 'OK') {
        if (credited.outcome === 'REJECTED' && credited.code === 'AWAITING_FINALITY') {
          deposit.finality = 'CONFIRMING';
          wallet.value.pendingMinorUnits += input.amountMinorUnits;
        } else {
          return fail(credited.outcome === 'REJECTED' ? credited.code : 'KERNEL_REFUSED', credited.outcome === 'REJECTED' ? credited.message : 'deposit credit refused');
        }
      } else {
        deposit.credited = true;
        deposit.finality = 'FINALIZED';
      }
    } else {
      wallet.value.pendingMinorUnits += input.amountMinorUnits;
    }
    this.deposits.set(deposit.depositId, deposit);
    return ok(this.depositTransaction(deposit, wallet.value));
  }

  reconcileWallet(ownerId: string, walletId: string): WalletProductOutcome<readonly WalletReconciliationBreak[]> {
    const wallet = this.requireOwnedWallet(ownerId, walletId);
    if (!wallet.ok) {
      return wallet;
    }
    const report = this.deps.custody.reconcile();
    const found: WalletReconciliationBreak[] = [];
    if (report.outcome !== 'MATCHED') {
      found.push(this.recordBreak(walletId, 'CUSTODY_PROVIDER', 'CUSTOMER_READ_MODEL', report.notes.join('; ') || report.outcome));
    }
    const read = this.deps.assets.position(ownerId, wallet.value.assetId);
    const exchange = this.deps.exchangePositions?.(ownerId, wallet.value.assetId) ?? read.available.scaledUnits;
    if (exchange !== read.available.scaledUnits) {
      found.push(
        this.recordBreak(walletId, 'EXCHANGE_POSITION', 'CUSTOMER_READ_MODEL', 'exchange position does not match customer read model'),
      );
    }
    const native = read.available.scaledUnits + read.held.scaledUnits;
    if (wallet.value.custodyModel === 'SUNREY_NATIVE' && native < 0n) {
      found.push(this.recordBreak(walletId, 'SUNREY_CHAIN_NATIVE', 'CUSTOMER_READ_MODEL', 'native quantity cannot be negative'));
    }
    void report.autoCorrected;
    return ok(Object.freeze(found));
  }

  signingMaterial(audience: 'FRONTEND' | 'AGENT'): ReturnType<typeof refuseSigningMaterial> {
    return refuseSigningMaterial(audience);
  }

  productionSigning(): ReturnType<typeof productionSigningStatus> {
    return productionSigningStatus(this.deps.hsmReady === true);
  }

  agentRestrictions(): {
    readonly mayShowWallet: true;
    readonly mayShowBalance: true;
    readonly mayShowAddress: true;
    readonly mayExplainTransaction: true;
    readonly mayCreateWithdrawalProposal: true;
    readonly maySign: false;
    readonly mayBroadcast: false;
    readonly mayBypassStepUp: false;
    readonly mayBypassCompliance: false;
  } {
    return {
      mayShowWallet: true,
      mayShowBalance: true,
      mayShowAddress: true,
      mayExplainTransaction: true,
      mayCreateWithdrawalProposal: true,
      maySign: false,
      mayBroadcast: false,
      mayBypassStepUp: false,
      mayBypassCompliance: false,
    };
  }

  setWalletStatus(ownerId: string, walletId: string, status: WalletStatus, withdrawalEnabled?: boolean): WalletProductOutcome<ConsumerWallet> {
    const wallet = this.requireOwnedWallet(ownerId, walletId);
    if (!wallet.ok) {
      return wallet;
    }
    wallet.value.status = status;
    if (withdrawalEnabled !== undefined) {
      wallet.value.withdrawalEnabled = withdrawalEnabled;
    }
    if (status === 'FROZEN' || status === 'CLOSED' || status === 'RESTRICTED') {
      wallet.value.withdrawalEnabled = withdrawalEnabled === true ? wallet.value.withdrawalEnabled : false;
    }
    return ok(this.toWallet(wallet.value));
  }

  breaks(): readonly WalletReconciliationBreak[] {
    return Object.freeze([...this.breaks]);
  }

  private executeWithdrawal(
    ownerId: string,
    walletId: string,
    body: Record<string, unknown>,
    actor: WalletActorInput,
  ): WalletProductOutcome<WithdrawalResource> {
    if (this.deps.custodyAvailable === false) {
      return fail('CUSTODY_OUTAGE', 'custody provider is unavailable');
    }
    if (this.deps.chainAvailable === false) {
      return fail('CHAIN_OUTAGE', 'native chain is unavailable');
    }
    const gated = this.precheck(ownerId, walletId, body, actor, 'execute');
    if (!gated.ok) {
      return gated;
    }
    if (!actor.stepUpSatisfied) {
      return fail('STEP_UP_REQUIRED', 'withdrawal execution requires step-up authentication');
    }
    const quote = typeof body.quoteId === 'string' ? this.quotes.get(body.quoteId) : undefined;
    if (quote && quote.ownerId === ownerId) {
      const current = estimateWalletFees({
        amountMinorUnits: BigInt(quote.amountMinorUnits),
        networkId: quote.networkId,
      });
      if (feeChangedMaterially(quote.feeTotal, BigInt(current.totalEstimateMinorUnits))) {
        return fail('FEE_CHANGED', 'estimated fees changed materially; request a new quote');
      }
    }
    const { wallet, destination, amount } = gated.value;
    const analytics = this.deps.analytics.screenAddress(destination.address, this.deps.clock.now());
    if (!analyticsCannotDecideWithdrawal(analytics)) {
      return fail('ANALYTICS_CANNOT_AUTHORIZE', 'blockchain analytics cannot independently authorize');
    }
    const riskScreen = this.deps.destinationRisk.screen({
      address: destination.address,
      customerId: ownerId,
      assetId: wallet.assetId,
    });
    if (riskScreen.outcome === 'BLOCK') {
      return fail('HIGH_RISK_DESTINATION', riskScreen.reason);
    }
    const verified = actor.verified;
    if (!verified || !isVerifiedActorContext(verified)) {
      return fail('ACTOR_UNVERIFIED', 'withdrawal requires a verified ActorContext');
    }
    let destinationId = this.destinationByAddress.get(`${ownerId}:${destination.address}`);
    if (!destinationId) {
      const added = this.deps.custody.addDestination({
        actor: verified,
        customerId: ownerId as CustomerId,
        address: destination.address,
        label: 'customer destination',
      });
      if (added.outcome !== 'OK') {
        return fail(added.outcome === 'REJECTED' ? added.code : 'KERNEL_REFUSED', added.outcome === 'REJECTED' ? added.message : 'destination refused');
      }
      destinationId = added.value.destinationId;
      this.destinationByAddress.set(`${ownerId}:${destination.address}`, destinationId);
    }
    const initiated = this.deps.custody.initiateWithdrawal({
      actor: verified,
      customerId: ownerId as CustomerId,
      custodyAccountId: asCustodyAccountId(wallet.custodyAccountId),
      destinationId,
      quantity: AssetQuantity.fromScaledUnits(amount, wallet.assetId),
      ...(body.forceFailedBroadcast === true ? { timeoutAfterBroadcast: true } : {}),
    });
    if (initiated.outcome !== 'OK') {
      return fail(initiated.outcome === 'REJECTED' ? initiated.code : 'KERNEL_REFUSED', initiated.outcome === 'REJECTED' ? initiated.message : 'withdrawal refused');
    }
    const travel = this.travelCustomerState(ownerId, amount, destination.address);
    const failedBroadcast = initiated.value.state === 'SUBMISSION_UNKNOWN';
    const finality: ClientFinalityState = failedBroadcast
      ? 'FAILED'
      : initiated.value.state === 'SETTLED' || initiated.value.state === 'MATCHED'
        ? 'FINALIZED'
        : 'BROADCAST';
    const fees = estimateWalletFees({ amountMinorUnits: amount, networkId: wallet.networkId });
    const resource: StoredWithdrawal = {
      schema: 'sunrey.consumer.withdrawal.v1',
      withdrawalId: `wd_${randomUUID().replace(/-/g, '')}`,
      quoteId: typeof body.quoteId === 'string' ? body.quoteId : null,
      walletId,
      ownerId,
      assetId: wallet.assetId,
      networkId: wallet.networkId,
      destinationHint: maskAddress(destination.address),
      destination: destination.address,
      amountMinorUnits: amount.toString(),
      fees,
      travelRule: travel.state === 'ADDITIONAL_INFORMATION_REQUIRED' && initiated.value.travelRuleMessageId ? 'COMPLETE' : travel.state,
      risk: riskScreen.outcome === 'REVIEW' || analytics.outcome === 'REVIEW' ? 'REVIEW' : 'CLEAR',
      requiredApproval: 'STEP_UP_AUTHENTICATION',
      finality,
      status: initiated.value.state,
      createdAt: this.now(),
      expiresAt: null,
      txRef: initiated.value.chainTxRef,
      originatedFromAgent: false,
      productionMoneyMovement: false,
      productionSigningAuthorized: PRODUCTION_SIGNING_AUTHORIZED,
      destinationId,
      custodyWithdrawalId: initiated.value.withdrawalId,
    };
    this.withdrawals.set(resource.withdrawalId, resource);
    return ok(this.publicWithdrawal(resource));
  }

  private agentProposal(
    ownerId: string,
    walletId: string,
    body: Record<string, unknown>,
    actor: WalletActorInput,
  ): WalletProductOutcome<WithdrawalResource> {
    const quoted = this.quoteWithdrawal(ownerId, walletId, body, { ...actor, originatedFromAgent: false });
    if (!quoted.ok) {
      return quoted;
    }
    const resource: StoredWithdrawal = {
      schema: 'sunrey.consumer.withdrawal.v1',
      withdrawalId: `wd_${randomUUID().replace(/-/g, '')}`,
      quoteId: quoted.value.quoteId,
      walletId,
      ownerId,
      assetId: quoted.value.assetId,
      networkId: quoted.value.networkId,
      destinationHint: maskAddress(quoted.value.destination),
      destination: quoted.value.destination,
      amountMinorUnits: quoted.value.amountMinorUnits,
      fees: quoted.value.fees,
      travelRule: quoted.value.travelRule,
      risk: quoted.value.risk,
      requiredApproval: quoted.value.requiredApproval,
      finality: 'PENDING',
      status: 'PROPOSED',
      createdAt: this.now(),
      expiresAt: quoted.value.expiresAt,
      txRef: null,
      originatedFromAgent: true,
      productionMoneyMovement: false,
      productionSigningAuthorized: PRODUCTION_SIGNING_AUTHORIZED,
      destinationId: null,
      custodyWithdrawalId: null,
    };
    this.withdrawals.set(resource.withdrawalId, resource);
    return ok(this.publicWithdrawal(resource));
  }

  private precheck(
    ownerId: string,
    walletId: string,
    body: Record<string, unknown>,
    actor: WalletActorInput,
    mode: 'quote' | 'execute',
  ): WalletProductOutcome<{ wallet: StoredWallet; destination: { address: string }; amount: bigint }> {
    const privileged = assertNoClientSigningMaterial(body);
    if (!privileged.ok) {
      return fail(privileged.code, privileged.message);
    }
    if (actor.customerId !== ownerId) {
      return fail('RESOURCE_NOT_OWNED', 'wallet is not owned by this customer');
    }
    const wallet = this.requireOwnedWallet(ownerId, walletId);
    if (!wallet.ok) {
      return wallet;
    }
    if (wallet.value.status !== 'ACTIVE') {
      return fail('WALLET_NOT_ACTIVE', `wallet status ${wallet.value.status} cannot withdraw`);
    }
    if (mode === 'execute' && !wallet.value.withdrawalEnabled) {
      return fail('WITHDRAWAL_DISABLED', 'withdrawal capability is independently disabled');
    }
    const quote = typeof body.quoteId === 'string' ? this.quotes.get(body.quoteId) : undefined;
    const destinationRaw = typeof body.destination === 'string' ? body.destination : quote?.destination;
    const amountRaw = typeof body.amountMinorUnits === 'string' ? body.amountMinorUnits : quote?.amountMinorUnits;
    const networkId = typeof body.networkId === 'string' ? body.networkId : wallet.value.networkId;
    if (!destinationRaw || !amountRaw) {
      return fail('VALIDATION', 'destination and amountMinorUnits are required');
    }
    let amount: bigint;
    try {
      amount = BigInt(amountRaw);
    } catch {
      return fail('VALIDATION', 'amountMinorUnits must be an integer string');
    }
    if (amount <= 0n) {
      return fail('VALIDATION', 'amount must be positive');
    }
    const destination = validateAddressBinding({
      address: destinationRaw,
      networkId,
      assetId: wallet.value.assetId,
    });
    if ('ok' in destination && destination.ok === false) {
      return fail(destination.code, destination.message);
    }
    const available = this.deps.assets.position(ownerId, wallet.value.assetId).available.scaledUnits;
    if (mode === 'execute' && available < amount) {
      return fail('INSUFFICIENT_ASSET', 'withdrawal exceeds available balance');
    }
    return ok({ wallet: wallet.value, destination: { address: destination.address }, amount });
  }

  private requireOwnedWallet(ownerId: string, walletId: string): WalletProductOutcome<StoredWallet> {
    const wallet = this.wallets.get(walletId);
    if (!wallet || wallet.ownerId !== ownerId) {
      return fail('RESOURCE_NOT_OWNED', 'wallet is not owned by this customer');
    }
    return ok(wallet);
  }

  private assignAddress(wallet: StoredWallet): DepositAddress {
    const address = deriveDepositAddress({
      walletId: wallet.walletId,
      assetId: wallet.assetId,
      networkId: wallet.networkId,
    });
    const resource: DepositAddress = Object.freeze({
      schema: 'sunrey.consumer.deposit-address.v1',
      addressId: `addr_${hash(wallet.walletId)}`,
      walletId: wallet.walletId,
      address,
      networkId: wallet.networkId,
      assetId: wallet.assetId,
      status: 'ACTIVE',
      qrPayload: address,
      createdAt: this.now(),
      belongsToWallet: true,
    });
    this.addresses.set(resource.addressId, resource);
    return resource;
  }

  private toWallet(wallet: StoredWallet): ConsumerWallet {
    const position = this.deps.assets.position(wallet.ownerId, wallet.assetId);
    const pending = wallet.pendingMinorUnits + position.held.scaledUnits;
    const available = position.available.scaledUnits;
    return Object.freeze({
      schema: 'sunrey.consumer.wallet.v1',
      walletId: wallet.walletId,
      ownerId: wallet.ownerId,
      assetId: wallet.assetId,
      networkId: wallet.networkId,
      custodyModel: wallet.custodyModel,
      status: wallet.status,
      withdrawalEnabled: wallet.withdrawalEnabled,
      addressRefs: Object.freeze(
        [...this.addresses.values()].filter((row) => row.walletId === wallet.walletId).map((row) => row.addressId),
      ),
      balance: Object.freeze({
        totalMinorUnits: (available + pending).toString(),
        availableMinorUnits: available.toString(),
        pendingMinorUnits: pending.toString(),
        assetId: wallet.assetId,
        source: 'CUSTODY_READ_MODEL',
        providerBalanceIsTruth: false,
        blendedReturn: null,
      }),
      providerRef: wallet.providerRef,
      custodyAccountId: wallet.custodyAccountId,
      createdAt: wallet.createdAt,
      productionSigningAuthorized: false,
      productionMoneyMovement: false,
    });
  }

  private transactionsFor(walletId: string): readonly WalletTransaction[] {
    const wallet = this.wallets.get(walletId);
    if (!wallet) {
      return Object.freeze([]);
    }
    const deposits = [...this.deposits.values()]
      .filter((row) => row.walletId === walletId)
      .map((row) => this.depositTransaction(row, wallet));
    const withdrawals = [...this.withdrawals.values()]
      .filter((row) => row.walletId === walletId)
      .map((row) => this.withdrawalTransaction(row, wallet));
    return Object.freeze(
      [...deposits, ...withdrawals].sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    );
  }

  private depositTransaction(deposit: StoredDeposit, wallet: StoredWallet): WalletTransaction {
    return Object.freeze({
      schema: 'sunrey.consumer.wallet-transaction.v1',
      transactionId: deposit.depositId,
      walletId: wallet.walletId,
      kind: 'DEPOSIT',
      assetId: wallet.assetId,
      networkId: wallet.networkId,
      amountMinorUnits: deposit.amountMinorUnits.toString(),
      counterpartyHint: 'inbound',
      finality: deposit.finality,
      travelRule: 'NOT_REQUIRED',
      createdAt: deposit.createdAt,
      txRef: deposit.txRef,
      productionMoneyMovement: false,
    });
  }

  private withdrawalTransaction(row: StoredWithdrawal, wallet: StoredWallet): WalletTransaction {
    return Object.freeze({
      schema: 'sunrey.consumer.wallet-transaction.v1',
      transactionId: row.withdrawalId,
      walletId: wallet.walletId,
      kind: row.assetId === 'MOONREY_COIN' && row.destination.startsWith('mr1') ? 'TRANSFER' : 'WITHDRAWAL',
      assetId: wallet.assetId,
      networkId: wallet.networkId,
      amountMinorUnits: row.amountMinorUnits,
      counterpartyHint: row.destinationHint,
      finality: row.finality,
      travelRule: row.travelRule,
      createdAt: row.createdAt,
      txRef: row.txRef,
      productionMoneyMovement: false,
    });
  }

  private publicQuote(row: StoredQuote): WithdrawalQuote {
    const { feeTotal: _feeTotal, ...rest } = row;
    void _feeTotal;
    return Object.freeze({ ...rest });
  }

  private publicWithdrawal(row: StoredWithdrawal): WithdrawalResource {
    const { destination: _destination, destinationId: _destinationId, custodyWithdrawalId: _custodyWithdrawalId, ...rest } = row;
    void _destination;
    void _destinationId;
    void _custodyWithdrawalId;
    return Object.freeze({ ...rest });
  }

  private travelCustomerState(
    ownerId: string,
    amount: bigint,
    destination: string,
  ): { readonly state: TravelRuleCustomerState; readonly required: boolean } {
    const vasp = this.deps.travelNetwork.discoverCounterparty(destination);
    const decision = evaluateTravelRuleApplicability({
      pack: this.deps.pack,
      originatorJurisdiction: 'GB' as Jurisdiction,
      quantity: AssetQuantity.fromScaledUnits(amount, 'SUNREY_COIN'),
      counterpartyIsVasp: vasp !== null,
    });
    if (decision.applicability === 'NOT_APPLICABLE') {
      return { state: 'NOT_REQUIRED', required: false };
    }
    if (decision.applicability === 'RESEARCH_REQUIRED') {
      return { state: 'REVIEW', required: true };
    }
    return { state: 'ADDITIONAL_INFORMATION_REQUIRED', required: true };
  }

  private recordBreak(
    walletId: string,
    left: WalletReconciliationBreak['left'],
    right: WalletReconciliationBreak['right'],
    note: string,
  ): WalletReconciliationBreak {
    const row: WalletReconciliationBreak = Object.freeze({
      breakId: `brk_${randomUUID().replace(/-/g, '')}`,
      walletId,
      left,
      right,
      note,
      autoCorrected: false,
      createdAt: this.now(),
    });
    this.breaks.push(row);
    return row;
  }

  private signNotice(material: string): string {
    return signSimulationNotice(material);
  }

  private now(): string {
    return this.deps.clock.now();
  }

  private plusMinutes(minutes: number): string {
    return new Date(Date.parse(this.now()) + minutes * 60_000).toISOString();
  }
}

function ok<T>(value: T): WalletProductOutcome<T> {
  return { ok: true, value };
}

function fail(code: string, message: string): WalletProductOutcome<never> {
  return { ok: false, code, message };
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function maskAddress(address: string): string {
  if (address.length <= 10) {
    return address;
  }
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export { mapExternalFinality };
