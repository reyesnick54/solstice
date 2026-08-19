/**
 * In-process development platform. Adapter over canonical engines.
 * Not a second ledger, chain, or exchange.
 */

import { createHash, randomUUID } from 'node:crypto';

import { estimateFee, FeeEngine } from '../../../sunrey-chain/src/fees/engine.ts';
import { developmentFeeSchedule, hashFeeSchedule } from '../../../sunrey-chain/src/fees/schedule.ts';
import { usageForOperation } from '../../../sunrey-chain/src/fees/meter.ts';
import {
  developmentFeePolicyV2,
  estimateFeeV2,
  hashFeePolicyV2,
  usageV2ForTransaction,
} from '../../../sunrey-chain/src/fees/v2/index.ts';
import {
  rehearseFeePolicyChange,
  rehearseOracleCompromiseEmergency,
} from '../../../sunrey-chain/src/governance-ops/rehearsals.ts';
import { developmentTreasuryPolicy, showTreasuryPolicy } from '../../../sunrey-chain/src/economics/treasury/index.ts';
import {
  defaultPostGenesisPolicy,
  initialStabilizationState,
  publicNetworkStatus,
} from '../../../sunrey-chain/src/post-genesis/index.ts';
import { encodeFromPublicKey } from '../../../sunrey-chain/src/wallet/index.ts';
import type { AddressClass, AuthorizationPolicyKind } from '../../../sunrey-chain/src/wallet/types.ts';
import { decodeEnvelope, transactionIdFromCanonicalBytes } from '../../../sunrey-chain/src/protocol/index.ts';
import {
  GPU_COMPUTE_MARKET_ID,
  INFORMATION_RIGHT_MARKET_ID,
  MANUFACTURING_CAPACITY_MARKET_ID,
  SUNREY_COIN_USD_MARKET_ID,
} from '../../../sunrey-exchange/src/ids.ts';
import { apiError, categoryForCode, type ApiErrorEnvelope } from '../errors.ts';
import { IdempotencyStore, bindIdempotencyKey } from '../idempotency.ts';
import {
  CLASSICAL_SUITE_ID,
  PUBLIC_CHAIN_ID,
  PUBLIC_NETWORK_ID,
  TICKER_STATUS,
  isKnownPublicSuite,
  rejectSuiteDowngrade,
} from '../ids.ts';
import { RateLimiter } from '../limits.ts';
import { paginate, type Page } from '../pagination.ts';
import type {
  AssetHolding,
  ChainStatus,
  ConsistencyLevel,
  EventType,
  FeeDeclaration,
  MarketFamily,
  PublicAccount,
  SubmissionResponse,
  TransactionReceipt,
  TransactionStatus,
  PublicStreamEvent,
} from '../types.ts';
import { objectHasPrivateKeyField } from './privacy.ts';
import { ConsumerGatewayApi } from './consumer-api.ts';

export type RegisteredAccount = PublicAccount & {
  readonly publicKeyHex: string;
  readonly suiteId: string;
};

type StoredTx = {
  readonly transaction_id: string;
  status: TransactionStatus;
  readonly network_id: string;
  readonly signed_hex: string;
  readonly account_id: string | null;
  readonly counterparty_id: string | null;
  readonly amount: string | null;
  height: string | null;
  block_id: string | null;
  readonly received_at: string;
  fee: FeeDeclaration | null;
};

type StoredBlock = {
  readonly height: string;
  readonly block_id: string;
  readonly parent_block_id: string;
  readonly state_root: string;
  readonly transaction_ids: readonly string[];
  readonly finalized: true;
};

export class DevelopmentPlatform {
  readonly networkId = PUBLIC_NETWORK_ID;
  readonly chainId = PUBLIC_CHAIN_ID;
  readonly fees = new FeeEngine();
  readonly limiter = new RateLimiter();
  readonly idempotency = new IdempotencyStore();
  readonly operatorToken: string;
  private height = 0;
  private latestBlockId = 'blk.genesis';
  private stateRoot = 'state.genesis';
  private eventSeq = 0;
  private readonly accounts = new Map<string, RegisteredAccount>();
  private readonly txs = new Map<string, StoredTx>();
  private readonly mempool: string[] = [];
  private readonly blocks: StoredBlock[] = [];
  readonly events: PublicStreamEvent[] = [];
  private readonly locks = new Map<string, readonly { readonly lock_id: string; readonly amount: string }[]>();
  private readonly orders = new Map<string, Readonly<Record<string, string>>>();
  private readonly trades = new Map<string, Readonly<Record<string, string>>>();
  readonly consumer = new ConsumerGatewayApi();

  constructor(input: { readonly operatorToken?: string } = {}) {
    this.operatorToken = input.operatorToken ?? 'dev-operator-token';
    this.seedReadModels();
  }

  now(): string {
    return new Date().toISOString();
  }

  requestId(): string {
    return `req_${randomUUID()}`;
  }

  rejectSensitive(body: unknown, requestId: string): ApiErrorEnvelope | null {
    if (objectHasPrivateKeyField(body)) {
      return apiError({
        error_code: 'PRIVATE_KEY_REJECTED',
        category: 'AUTHORIZATION',
        message: 'private key or sensitive material must never be sent to public RPC',
        retryable: false,
        request_id: requestId,
      });
    }
    return null;
  }

  chainStatus(): ChainStatus {
    return Object.freeze({
      network_id: this.networkId,
      chain_id: this.chainId,
      protocol_version: '1',
      api_version: 'v1',
      finalized_height: String(this.height),
      latest_block_id: this.latestBlockId,
      state_root: this.stateRoot,
      environment: 'simulation',
      ticker_status: TICKER_STATUS,
      consistency: 'FINALIZED',
    });
  }

  postGenesisPublicStatus() {
    const state = initialStabilizationState(defaultPostGenesisPolicy());
    return publicNetworkStatus({
      phase: state.phase,
      health: state.latestHealth,
      enabled: state.enabled,
      restricted: state.restricted,
    });
  }

  getNetworkPhase() {
    const status = this.postGenesisPublicStatus();
    return Object.freeze({
      phase: status.phase,
      environment: 'simulation',
      networkClass: status.networkClass,
      realProductionCapabilitiesActivated: false,
    });
  }

  getCapabilityStatus() {
    const status = this.postGenesisPublicStatus();
    return Object.freeze({
      capabilities: status.capabilities,
      planes: status.planes,
      realProductionCapabilitiesActivated: false,
    });
  }

  getPostGenesisHealth() {
    const status = this.postGenesisPublicStatus();
    return Object.freeze({
      engineeringHealth: status.planes.ENGINEERING_HEALTH,
      productionCapabilityStatus: status.planes.PRODUCTION_CAPABILITY_STATUS,
      regulatedServiceStatus: status.planes.REGULATED_SERVICE_STATUS,
      securityInternalsExposed: false,
    });
  }

  getProtocolVersion() {
    return Object.freeze({
      protocol_version: '1',
      api_version: 'v1',
      active_protocol: 'sunrey-protocol-0',
      compatibility: 'BACKWARD_COMPATIBLE',
    });
  }

  registerAccount(input: {
    readonly account_id: string;
    readonly address: string;
    readonly public_key_hex: string;
    readonly suite_id: string;
    readonly authorization_policy: AuthorizationPolicyKind;
    readonly approved_crypto_suites?: readonly string[];
  }): PublicAccount | ApiErrorEnvelope {
    const requestId = this.requestId();
    if (!isKnownPublicSuite(input.suite_id)) {
      return apiError({
        error_code: 'CRYPTO_SUITE_DOWNGRADE',
        category: 'AUTHENTICATION',
        message: 'unknown CryptoSuite',
        retryable: false,
        request_id: requestId,
      });
    }
    const existing = this.accounts.get(input.account_id);
    if (existing && rejectSuiteDowngrade(existing.suiteId, input.suite_id)) {
      return apiError({
        error_code: 'CRYPTO_SUITE_DOWNGRADE',
        category: 'AUTHENTICATION',
        message: 'CryptoSuite downgrade rejected',
        retryable: false,
        request_id: requestId,
      });
    }
    const account: RegisteredAccount = Object.freeze({
      account_id: input.account_id,
      address: input.address,
      nonce: existing?.nonce ?? '0',
      authorization_policy: input.authorization_policy,
      account_status: 'ACTIVE',
      approved_crypto_suites: Object.freeze([...(input.approved_crypto_suites ?? [input.suite_id])]),
      consistency: 'FINALIZED',
      publicKeyHex: input.public_key_hex,
      suiteId: input.suite_id,
    });
    this.accounts.set(input.account_id, account);
    return account;
  }

  getAccount(accountId: string): PublicAccount | undefined {
    const found = this.accounts.get(accountId);
    if (!found) {
      return undefined;
    }
    const { publicKeyHex: _pk, suiteId: _suite, ...publicAccount } = found;
    return publicAccount;
  }

  holdings(accountId: string): readonly AssetHolding[] {
    const sun = this.fees.accounts.position(accountId, 'SUNREY_COIN');
    const moon = this.fees.accounts.position(accountId, 'MOONREY_COIN');
    return Object.freeze([
      this.holdingView(accountId, 'SUNREY_COIN', sun.available, sun.locked),
      this.holdingView(accountId, 'MOONREY_COIN', moon.available, moon.locked),
    ]);
  }

  faucet(accountId: string, amount: bigint): AssetHolding {
    this.fees.faucet(accountId, amount, 'SUNREY_COIN');
    const sun = this.fees.accounts.position(accountId, 'SUNREY_COIN');
    this.emit('accountActivity', { account_id: accountId, kind: 'FAUCET' }, {});
    return this.holdingView(accountId, 'SUNREY_COIN', sun.available, sun.locked);
  }

  estimateFee(encodedBytes = 256, signatureCount = 1): FeeDeclaration {
    const schedule = developmentFeeSchedule();
    const usage = usageForOperation('NATIVE_TRANSFER', encodedBytes, signatureCount);
    const estimated = estimateFee(schedule, usage).estimatedFee;
    return Object.freeze({
      estimatedFee: estimated.toString(),
      maximumAuthorizedFee: estimated.toString(),
      actualFinalizedFee: null,
      feeAsset: 'SUNREY_COIN',
      scheduleHash: hashFeeSchedule(schedule),
    });
  }

  getFeePolicy(): Record<string, unknown> {
    const policy = developmentFeePolicyV2();
    return Object.freeze({
      historicPolicy: 'FeeSchedule v1',
      policyVersion: policy.policyVersion,
      formulaVersion: policy.formulaVersion,
      feeAsset: policy.feeAsset,
      moonreyFeeEnabled: policy.moonreyFeeEnabled,
      productionParametersConfigured: policy.productionParametersConfigured,
      hash: hashFeePolicyV2(policy),
    });
  }

  getBaseResourcePrice(): Record<string, unknown> {
    return Object.freeze({
      baseResourcePrice: this.fees.priceState.baseResourcePrice.toString(),
      formulaVersion: this.fees.priceState.formulaVersion,
      targetUtilizationBps: this.fees.feePolicyV2.bounds.targetUtilizationBps.toString(),
    });
  }

  estimateResourcesV2(encodedBytes = 256, signatureCount = 1, signatureClass: 'CLASSICAL' | 'HYBRID' | 'PQ' = 'CLASSICAL') {
    const tx = {
      transactionId: 'estimate',
      operation: 'NATIVE_TRANSFER' as const,
      payerAuthenticated: true,
      encodedBytes,
      signatureCount,
      signatureClass,
      budget: {
        maxExecutionUnits: 10_000n,
        maxFee: 50_000n,
        feeAsset: 'SUNREY_COIN' as const,
        feePayer: 'estimator',
        exemption: 'NONE' as const,
      },
    };
    return usageV2ForTransaction(tx);
  }

  estimateFeeV2(encodedBytes = 256, signatureCount = 1, signatureClass: 'CLASSICAL' | 'HYBRID' | 'PQ' = 'CLASSICAL') {
    const policy = developmentFeePolicyV2();
    const tx = {
      transactionId: 'estimate',
      operation: 'NATIVE_TRANSFER' as const,
      payerAuthenticated: true,
      encodedBytes,
      signatureCount,
      signatureClass,
      budget: {
        maxExecutionUnits: 10_000n,
        maxFee: 10_000_000n,
        feeAsset: 'SUNREY_COIN' as const,
        feePayer: 'estimator',
        exemption: 'NONE' as const,
      },
    };
    const quote = estimateFeeV2(policy, tx, this.fees.priceState.baseResourcePrice);
    return Object.freeze({
      informational: true,
      authorization: 'signed canonical max_fee',
      policy: this.getFeePolicy(),
      resourceUsage: this.estimateResourcesV2(encodedBytes, signatureCount, signatureClass),
      quote: quote.ok ? quote.quote : quote,
      feeAsset: 'SUNREY_COIN',
      maxFeeGuidance: 'authorize max_fee >= estimatedTotal; estimate is not authorization',
    });
  }

  submitSigned(input: {
    readonly signed_envelope_hex: string;
    readonly network_id: string;
    readonly actor: string;
    readonly idempotency_key?: string;
    readonly transfer?: { readonly from: string; readonly to: string; readonly amount: bigint };
  }): SubmissionResponse | ApiErrorEnvelope {
    const requestId = this.requestId();
    if (input.network_id !== this.networkId && input.network_id !== 'net_sunrey_local_dev') {
      return apiError({
        error_code: 'WRONG_NETWORK',
        category: 'VALIDATION',
        message: 'wrong-network transaction rejected',
        retryable: false,
        request_id: requestId,
        details_safe_for_client: { network_id: input.network_id },
      });
    }
    const bytes = Buffer.from(input.signed_envelope_hex, 'hex');
    if (bytes.length === 0) {
      return apiError({
        error_code: 'MALFORMED',
        category: 'VALIDATION',
        message: 'signed envelope hex is empty',
        retryable: false,
        request_id: requestId,
      });
    }
    let txId = transactionIdFromCanonicalBytes(this.networkId, this.chainId, bytes);
    try {
      const decoded = decodeEnvelope(bytes);
      if (decoded.networkId !== this.networkId && decoded.networkId !== 'net_sunrey_local_dev') {
        return apiError({
          error_code: 'WRONG_NETWORK',
          category: 'VALIDATION',
          message: 'envelope network does not match this RPC',
          retryable: false,
          request_id: requestId,
        });
      }
      txId = transactionIdFromCanonicalBytes(decoded.networkId, decoded.chainId, bytes);
    } catch {
      // Builder-produced canonical bytes remain submissible; decode is best-effort.
    }
    const existing = this.txs.get(txId);
    if (existing) {
      return Object.freeze({
        transaction_id: txId,
        submission_status: 'KNOWN',
        network_id: this.networkId,
        received_at: existing.received_at,
        mempool_status: existing.status === 'MEMPOOL' ? 'QUEUED' : 'ABSENT',
      });
    }
    if (input.idempotency_key) {
      const binding = bindIdempotencyKey({
        actor: input.actor,
        operation: 'submitTransaction',
        canonicalContent: input.signed_envelope_hex,
      });
      const decision = this.idempotency.remember(input.idempotency_key, binding, txId);
      if (decision === 'CONFLICT') {
        return apiError({
          error_code: 'IDEMPOTENCY_CONFLICT',
          category: 'VALIDATION',
          message: 'idempotency key reused with different content',
          retryable: false,
          request_id: requestId,
        });
      }
      if (decision === 'REPLAY') {
        const replayed = this.idempotency.replay(input.idempotency_key);
        const known = replayed ? this.txs.get(replayed) : undefined;
        if (known) {
          return Object.freeze({
            transaction_id: known.transaction_id,
            submission_status: 'KNOWN',
            network_id: this.networkId,
            received_at: known.received_at,
            mempool_status: known.status === 'MEMPOOL' ? 'QUEUED' : 'ABSENT',
          });
        }
      }
    }
    const receivedAt = this.now();
    this.txs.set(txId, {
      transaction_id: txId,
      status: 'MEMPOOL',
      network_id: this.networkId,
      signed_hex: input.signed_envelope_hex,
      account_id: input.transfer?.from ?? null,
      counterparty_id: input.transfer?.to ?? null,
      amount: input.transfer ? input.transfer.amount.toString() : null,
      height: null,
      block_id: null,
      received_at: receivedAt,
      fee: this.estimateFee(),
    });
    this.mempool.push(txId);
    if (input.transfer) {
      this.pendingTransfers.set(txId, input.transfer);
    }
    this.emit('transactionStatus', { transaction_id: txId, status: 'MEMPOOL' }, { transaction_id: txId });
    return Object.freeze({
      transaction_id: txId,
      submission_status: 'ACCEPTED',
      network_id: this.networkId,
      received_at: receivedAt,
      mempool_status: 'QUEUED',
    });
  }

  private readonly pendingTransfers = new Map<string, { readonly from: string; readonly to: string; readonly amount: bigint }>();

  produceBlock(): StoredBlock {
    this.height += 1;
    const txIds = this.mempool.splice(0, this.mempool.length);
    const blockId = createHash('sha256').update(`blk.${this.height}.${txIds.join(',')}`).digest('hex');
    this.stateRoot = createHash('sha256').update(`state.${this.height}.${blockId}`).digest('hex');
    for (const txId of txIds) {
      const row = this.txs.get(txId);
      if (!row) {
        continue;
      }
      const transfer = this.pendingTransfers.get(txId);
      if (transfer) {
        this.fees.accounts.transfer(transfer.from, transfer.to, 'SUNREY_COIN', transfer.amount);
        this.emit('assetTransfer', {
          from: transfer.from,
          to: transfer.to,
          amount: transfer.amount.toString(),
        }, { transaction_id: txId, block_id: blockId });
        this.pendingTransfers.delete(txId);
      }
      row.status = 'FINALIZED';
      row.height = String(this.height);
      row.block_id = blockId;
      this.emit('transactionStatus', { transaction_id: txId, status: 'FINALIZED' }, { transaction_id: txId, block_id: blockId });
    }
    const block: StoredBlock = Object.freeze({
      height: String(this.height),
      block_id: blockId,
      parent_block_id: this.latestBlockId,
      state_root: this.stateRoot,
      transaction_ids: Object.freeze([...txIds]),
      finalized: true,
    });
    this.latestBlockId = blockId;
    this.blocks.push(block);
    this.emit('newFinalizedBlock', { height: block.height, block_id: block.block_id }, { block_id: blockId });
    return block;
  }

  txStatus(txId: string): TransactionReceipt {
    const row = this.txs.get(txId);
    if (!row) {
      return Object.freeze({
        transaction_id: txId,
        status: 'UNKNOWN',
        network_id: this.networkId,
        height: null,
        block_id: null,
        finalized: false,
        consistency: 'PENDING_LOCAL',
        fee: null,
      });
    }
    return Object.freeze({
      transaction_id: row.transaction_id,
      status: row.status,
      network_id: row.network_id,
      height: row.height,
      block_id: row.block_id,
      finalized: row.status === 'FINALIZED',
      consistency: row.status === 'FINALIZED' ? 'FINALIZED' : 'PENDING_LOCAL',
      fee: row.fee,
    });
  }

  listBlocks(cursor: string | undefined, pageSize: number): Page<StoredBlock> | { readonly error: 'INVALID_PAGINATION_CURSOR' } {
    return paginate(this.blocks, 'blocks', this.height, cursor, pageSize);
  }

  listTransactions(cursor: string | undefined, pageSize: number): Page<TransactionReceipt> | { readonly error: 'INVALID_PAGINATION_CURSOR' } {
    const items = [...this.txs.values()].map((row) => this.txStatus(row.transaction_id));
    return paginate(items, 'transactions', this.height, cursor, pageSize);
  }

  getBlock(height: string): StoredBlock | undefined {
    return this.blocks.find((block) => block.height === height);
  }

  validators(): readonly Record<string, string>[] {
    return Object.freeze([
      { validator_id: 'val.1', status: 'ACTIVE', voting_power: '1', epoch: '1' },
      { validator_id: 'val.2', status: 'ACTIVE', voting_power: '1', epoch: '1' },
      { validator_id: 'val.3', status: 'ACTIVE', voting_power: '1', epoch: '1' },
      { validator_id: 'val.4', status: 'ACTIVE', voting_power: '1', epoch: '1' },
    ]);
  }

  validatorEconomicPolicy(): Record<string, unknown> {
    return Object.freeze({
      version: 1,
      bondAsset: 'DEVELOPMENT_SUNREY_COIN',
      bondAssetStatus: 'DEVELOPMENT_FIXTURE',
      productionBondAsset: 'UNCONFIGURED',
      publicDelegation: false,
      coinEqualsVote: false,
    });
  }

  validatorBond(validatorId: string): Record<string, unknown> {
    return Object.freeze({
      validatorId,
      bondState: 'BONDED',
      bondAsset: 'DEVELOPMENT_SUNREY_COIN',
      bondedQuantity: '1000000',
      policyVersion: 1,
    });
  }

  validatorRewardSummary(validatorId: string): Record<string, unknown> {
    return Object.freeze({ validatorId, paid: '0', pending: '0', policyVersion: 1 });
  }

  validatorPublicPenalties(validatorId: string): Record<string, unknown> {
    return Object.freeze({ validatorId, penalties: [] });
  }

  validatorUnbondStatus(validatorId: string): Record<string, unknown> {
    return Object.freeze({ validatorId, pending: '0', releaseEpoch: null });
  }

  governance(): readonly Record<string, string>[] {
    return Object.freeze([
      {
        proposal_id: 'gov.sim.1',
        status: 'SCHEDULED',
        protocol_version: '1',
        activation_height: '100',
      },
    ]);
  }

  governanceOperations(): {
    readonly package: Record<string, unknown>;
    readonly diff: Record<string, unknown> | null;
    readonly activation: Record<string, unknown>;
    readonly emergency: Record<string, unknown>;
  } {
    const fee = rehearseFeePolicyChange();
    const emergency = rehearseOracleCompromiseEmergency();
    return Object.freeze({
      package: {
        package_id: fee.package.packageId,
        operation_type: fee.package.operationType,
        package_hash: fee.package.packageHash,
        network_id: fee.package.networkId,
        activation_height: fee.package.activation.height,
        governance_token: false,
      },
      diff: fee.package.economic?.canonicalDiff ?? null,
      activation: {
        status: fee.public.approvalResult,
        active_version: fee.public.activeVersion,
        coordinate: fee.public.activationCoordinate,
      },
      emergency: {
        restriction_class: emergency.suspend.actionClass,
        restriction_state: emergency.suspend.result,
        supply_rewritten: false,
      },
    });
  }

  oracles(): readonly Record<string, string>[] {
    return Object.freeze([
      { provider_id: 'oracle.sim.1', feed_id: 'feed.energy', quality: 'DEVELOPMENT', fact_id: 'fact.energy.1' },
    ]);
  }

  productive(): readonly Record<string, string>[] {
    return Object.freeze([
      {
        object_id: 'prod.obj.1',
        claim_id: 'prod.claim.1',
        contribution_id: 'prod.contrib.1',
        moonrey_attribution: 'derived-from-verified-contribution',
        ticker_status: TICKER_STATUS,
      },
    ]);
  }

  getProtocolTreasury(): Record<string, unknown> {
    const policy = developmentTreasuryPolicy();
    return Object.freeze({
      classification: 'PROTOCOL TREASURY',
      distinctFrom: Object.freeze(['customer custody', 'fiat Ledger', 'Exchange customer balances']),
      owner: 'packages/sunrey-chain',
      policyVersion: policy.policyVersion,
      productionTreasuryInactive: true,
      writeInterface: 'GOVERNANCE_AUTHORIZED',
    });
  }

  getProtocolReserves(): Record<string, unknown> {
    return Object.freeze({
      classification: 'PROTOCOL TREASURY',
      reserves: Object.freeze([]),
      productionTreasuryInactive: true,
    });
  }

  getTreasuryBudget(budgetId?: string): Record<string, unknown> {
    return Object.freeze({
      budget_id: budgetId ?? null,
      budgets: Object.freeze([]),
      writeInterface: 'GOVERNANCE_AUTHORIZED',
    });
  }

  getTreasuryDisbursement(disbursementId?: string): Record<string, unknown> {
    return Object.freeze({
      disbursement_id: disbursementId ?? null,
      disbursements: Object.freeze([]),
      writeInterface: 'GOVERNANCE_AUTHORIZED',
    });
  }

  getTreasuryPolicy(): Record<string, unknown> {
    return Object.freeze({
      ...showTreasuryPolicy(),
      writeInterface: 'GOVERNANCE_AUTHORIZED',
    });
  }

  moonreyPolicy(): Record<string, unknown> {
    return Object.freeze({
      policyVersion: 1,
      assetId: 'MOONREY_COIN',
      tickerStatus: TICKER_STATUS,
      parameterClass: 'ENGINEERING_SIMULATION_PARAMETERS',
      productionCaps: 'UNCONFIGURED',
    });
  }

  moonreyCategoryPolicy(category: string): Record<string, unknown> {
    return Object.freeze({
      category,
      canonical: true,
      tickerStatus: TICKER_STATUS,
    });
  }

  productiveContribution(contributionId: string): Record<string, unknown> {
    return Object.freeze({
      contribution_id: contributionId,
      object_id: 'prod.obj.1',
      status: 'ELIGIBLE',
    });
  }

  moonreyIssuanceReceipt(issuanceId: string): Record<string, unknown> {
    return Object.freeze({
      issuanceId,
      assetId: 'MOONREY_COIN',
      tickerStatus: TICKER_STATUS,
      policyVersion: 1,
    });
  }

  moonreySupplyPressure(): Record<string, unknown> {
    return Object.freeze({
      classification: 'ENGINEERING_ECONOMIC_SIMULATION',
      automaticMarketPriceClaim: false,
      tickerStatus: TICKER_STATUS,
    });
  }

  machines(): readonly Record<string, string>[] {
    return Object.freeze([
      {
        machine_id: 'machine.sim.1',
        capability: 'COMPUTE',
        offer_id: 'offer.compute.1',
        commerce_state: 'OPEN',
      },
    ]);
  }

  interop(): readonly Record<string, string>[] {
    return Object.freeze([
      {
        chain_id: 'ext.sim.1',
        client_id: 'lc.sim.1',
        connection_id: 'conn.sim.1',
        channel_id: 'chan.sim.1',
        packet_id: 'pkt.sim.1',
        packet_state: 'ACKED',
        security_profile: 'SIMULATED_DETERMINISTIC_BFT_EXTERNAL_CHAIN',
      },
    ]);
  }

  markets(): readonly { readonly market_id: string; readonly family: MarketFamily; readonly instrument_id: string }[] {
    return Object.freeze([
      { market_id: SUNREY_COIN_USD_MARKET_ID, family: 'DIGITAL_ASSET', instrument_id: 'inst.sunrey-usd' },
      { market_id: INFORMATION_RIGHT_MARKET_ID, family: 'HUMAN_INFORMATION_RIGHT', instrument_id: 'inst.info-right' },
      { market_id: GPU_COMPUTE_MARKET_ID, family: 'INTELLIGENCE_COMPUTE', instrument_id: 'inst.gpu-compute' },
      { market_id: MANUFACTURING_CAPACITY_MARKET_ID, family: 'PRODUCTIVE_CAPACITY', instrument_id: 'inst.capacity' },
    ]);
  }

  orderBook(marketId: string): Readonly<Record<string, string>> {
    return Object.freeze({
      market_id: marketId,
      bids: '[]',
      asks: '[]',
      consistency: 'INDEXED_FINALIZED',
    });
  }

  placeSignedOrder(input: {
    readonly market_id: string;
    readonly signed_order_hex: string;
    readonly actor: string;
  }): Readonly<Record<string, string>> | ApiErrorEnvelope {
    const requestId = this.requestId();
    if (objectHasPrivateKeyField(input)) {
      return apiError({
        error_code: 'PRIVATE_KEY_REJECTED',
        category: 'AUTHORIZATION',
        message: 'signed order must not include private keys',
        retryable: false,
        request_id: requestId,
      });
    }
    const orderId = `ord_${createHash('sha256').update(input.signed_order_hex).digest('hex').slice(0, 16)}`;
    const existing = this.orders.get(orderId);
    if (existing) {
      return existing;
    }
    const order = Object.freeze({
      order_id: orderId,
      market_id: input.market_id,
      status: 'ACCEPTED',
      actor: input.actor,
    });
    this.orders.set(orderId, order);
    const trade = Object.freeze({
      trade_id: `trd_${orderId}`,
      market_id: input.market_id,
      order_id: orderId,
      settlement_id: `set_${orderId}`,
    });
    this.trades.set(trade.trade_id, trade);
    this.emit('exchangeTrade', trade, {});
    this.emit('exchangeSettlement', { settlement_id: trade.settlement_id }, {});
    return order;
  }

  getOrder(orderId: string): Readonly<Record<string, string>> | undefined {
    return this.orders.get(orderId);
  }

  getTrade(tradeId: string): Readonly<Record<string, string>> | undefined {
    return this.trades.get(tradeId);
  }

  marketData(marketId: string, tier: 'public' | 'authorized' = 'public'): Readonly<Record<string, string | number>> {
    const book = this.orderBook(marketId);
    return Object.freeze({
      market_id: marketId,
      tier: tier === 'authorized' ? 'AUTHORIZED_REALTIME' : 'PUBLIC_DELAYED',
      delayed_ms: tier === 'authorized' ? 0 : 900_000,
      depth_levels: tier === 'authorized' ? 10 : 1,
      ...(book.bids !== undefined ? { bids: book.bids } : {}),
      ...(book.asks !== undefined ? { asks: book.asks } : {}),
      sequence: this.events.length,
      canonical_state_unchanged: 'true',
    });
  }

  placeSandboxOrder(input: {
    readonly market_id: string;
    readonly signed_order_hex: string;
    readonly actor: string;
    readonly environment?: string;
  }): Readonly<Record<string, string>> | ApiErrorEnvelope {
    if (input.environment && input.environment !== 'SANDBOX') {
      return apiError({
        error_code: 'SANDBOX_CANNOT_TRADE_PRODUCTION',
        category: 'AUTHORIZATION',
        message: 'developer API key cannot trade production funds',
        retryable: false,
        request_id: this.requestId(),
      });
    }
    const placed = this.placeSignedOrder(input);
    if ('error_code' in placed) {
      return placed;
    }
    return Object.freeze({ ...placed, environment: 'SANDBOX', production_funds: 'false' });
  }

  tradingSession(sessionId: string): Readonly<Record<string, string>> {
    return Object.freeze({
      session_id: sessionId,
      environment: 'SANDBOX',
      can_trade_production_funds: 'false',
      requires_trading_authority: 'true',
      custody_private_keys: 'outside_sdk_path',
    });
  }

  eventsSince(cursor: string | undefined, types: readonly EventType[] | undefined): {
    readonly events: readonly PublicStreamEvent[];
    readonly cursor: string;
  } | { readonly error: 'INVALID_PAGINATION_CURSOR' } {
    let start = 0;
    if (cursor && cursor.length > 0) {
      const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
      if (!decoded.startsWith('evt|')) {
        return { error: 'INVALID_PAGINATION_CURSOR' };
      }
      const seq = Number(decoded.slice(4));
      if (!Number.isInteger(seq) || seq < 0) {
        return { error: 'INVALID_PAGINATION_CURSOR' };
      }
      start = seq;
    }
    const selected = this.events.filter((event, index) => {
      if (index < start) {
        return false;
      }
      return types === undefined || types.length === 0 || types.includes(event.event_type);
    });
    return {
      events: selected,
      cursor: Buffer.from(`evt|${this.events.length}`, 'utf8').toString('base64url'),
    };
  }

  locksFor(accountId: string): readonly { readonly lock_id: string; readonly amount: string }[] {
    return this.locks.get(accountId) ?? [];
  }

  encodeDevelopmentAddress(input: {
    readonly accountId: string;
    readonly publicKeyHex: string;
    readonly suiteId: string;
    readonly addressClass?: AddressClass;
  }): string {
    return encodeFromPublicKey(this.networkId, input.addressClass ?? 'SINGLE_KEY_ACCOUNT', {
      schemaVersion: 1,
      keyId: `${input.accountId}.key.1`,
      suiteId: input.suiteId,
      algorithm: input.suiteId === CLASSICAL_SUITE_ID ? 'ED25519_V1' : 'HYBRID_SIM_V1',
      publicKeyHex: input.publicKeyHex,
      purpose: 'WALLET_SIGNING',
    }).text;
  }

  economicDefaultConsistency(): ConsistencyLevel {
    return 'FINALIZED';
  }

  private holdingView(
    accountId: string,
    assetId: 'SUNREY_COIN' | 'MOONREY_COIN',
    available: bigint,
    locked: bigint,
  ): AssetHolding {
    return Object.freeze({
      account_id: accountId,
      asset_id: assetId,
      available: available.toString(),
      locked: locked.toString(),
      ticker_status: TICKER_STATUS,
      consistency: 'FINALIZED',
    });
  }

  private rememberSubmission(
    txId: string,
    status: 'REJECTED',
    input: { readonly signed_envelope_hex: string },
    requestId: string,
  ): SubmissionResponse | ApiErrorEnvelope {
    const _unused = requestId;
    const receivedAt = this.now();
    this.txs.set(txId, {
      transaction_id: txId,
      status,
      network_id: this.networkId,
      signed_hex: input.signed_envelope_hex,
      account_id: null,
      counterparty_id: null,
      amount: null,
      height: null,
      block_id: null,
      received_at: receivedAt,
      fee: null,
    });
    return Object.freeze({
      transaction_id: txId,
      submission_status: 'REJECTED',
      network_id: this.networkId,
      received_at: receivedAt,
      mempool_status: 'ABSENT',
    });
  }

  private emit(
    type: EventType,
    payload: Readonly<Record<string, string>>,
    ref: { readonly transaction_id?: string; readonly block_id?: string },
  ): void {
    this.eventSeq += 1;
    const event: PublicStreamEvent = Object.freeze({
      event_version: 'v1',
      event_type: type,
      event_id: `evt_${this.eventSeq}`,
      cursor: Buffer.from(`evt|${this.events.length}`, 'utf8').toString('base64url'),
      finalized_height: String(this.height),
      occurred_at: this.now(),
      authority: 'PROJECTION',
      canonical_ref: Object.freeze({
        ...(ref.transaction_id !== undefined ? { transaction_id: ref.transaction_id } : {}),
        ...(ref.block_id !== undefined ? { block_id: ref.block_id } : {}),
      }),
      payload,
    });
    this.events.push(event);
  }

  private seedReadModels(): void {
    this.emit('governanceProposal', { proposal_id: 'gov.sim.1' }, {});
    this.emit('oracleFact', { fact_id: 'fact.energy.1' }, {});
    this.emit('productiveContribution', { contribution_id: 'prod.contrib.1' }, {});
    this.emit('moonreyIssuance', { note: 'development-attribution-only' }, {});
    this.emit('machineSettlement', { machine_id: 'machine.sim.1' }, {});
    this.emit('interopPacket', { packet_id: 'pkt.sim.1' }, {});
  }
}

export function errorStatus(error: ApiErrorEnvelope): number {
  if (error.category === 'NOT_FOUND') {
    return 404;
  }
  if (error.category === 'RATE_LIMIT') {
    return 429;
  }
  if (error.category === 'AUTHORIZATION' || error.category === 'AUTHENTICATION') {
    return 403;
  }
  if (error.error_code === 'UNKNOWN_API_VERSION') {
    return 404;
  }
  if (error.category === 'TEMPORARY_UNAVAILABLE') {
    return 503;
  }
  return 400;
}

export { categoryForCode };
