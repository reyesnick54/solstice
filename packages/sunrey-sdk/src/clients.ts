import type { BlockchainAccount } from '../../sunrey-chain/src/wallet/index.ts';
import {
  buildAssetLock,
  buildAssetUnlock,
  buildGovernanceVote,
  buildInterchainPacket,
  buildMachineCommerce,
  buildNativeAssetTransfer,
  buildOracleObservation,
  buildProductiveClaim,
  type BuiltPublicTransaction,
} from './builders.ts';
import type { HttpTransport } from './http.ts';
import { PUBLIC_NETWORK_ID } from './ids.ts';
import { submissionRetrySafe } from './retry.ts';
import type { InjectedDevelopmentSigner } from './signer.ts';
import type {
  AssetHolding,
  ChainStatus,
  EventType,
  FeeDeclaration,
  PublicAccount,
  SubmissionResponse,
  TransactionReceipt,
  PublicStreamEvent,
} from './types.ts';

export class WalletClient {
  readonly http: HttpTransport;
  constructor(http: HttpTransport) {
    this.http = http;
  }

  register(input: {
    readonly account_id: string;
    readonly address: string;
    readonly public_key_hex: string;
    readonly suite_id: string;
    readonly authorization_policy?: PublicAccount['authorization_policy'];
  }): Promise<PublicAccount> {
    return this.http.post('/v1/accounts', {
      account_id: input.account_id,
      address: input.address,
      public_key_hex: input.public_key_hex,
      suite_id: input.suite_id,
      authorization_policy: input.authorization_policy ?? 'SINGLE_SIGNATURE',
    });
  }

  get(accountId: string): Promise<PublicAccount> {
    return this.http.get(`/v1/accounts/${accountId}`);
  }

  nonce(accountId: string): Promise<{ readonly nonce: string }> {
    return this.http.get(`/v1/accounts/${accountId}/nonce`);
  }
}

export class AssetClient {
  readonly http: HttpTransport;
  constructor(http: HttpTransport) {
    this.http = http;
  }

  registry(): Promise<unknown> {
    return this.http.get('/v1/assets');
  }

  holdings(accountId: string): Promise<{ readonly holdings: readonly AssetHolding[] }> {
    return this.http.get(`/v1/assets/holdings/${accountId}`);
  }

  locks(accountId: string): Promise<unknown> {
    return this.http.get(`/v1/assets/locks/${accountId}`);
  }

  supply(): Promise<unknown> {
    return this.http.get('/v1/assets/supply');
  }

  issuance(): Promise<unknown> {
    return this.http.get('/v1/assets/issuance');
  }

  burns(): Promise<unknown> {
    return this.http.get('/v1/assets/burns');
  }

  monetaryPolicy(): Promise<unknown> {
    return this.http.get('/v1/monetary/policy');
  }

  nativeSupplySummary(): Promise<unknown> {
    return this.http.get('/v1/monetary/supply');
  }

  genesisAllocationSummary(): Promise<unknown> {
    return this.http.get('/v1/monetary/genesis');
  }

  issuanceReceipt(id: string): Promise<unknown> {
    return this.http.get(`/v1/monetary/issuance/${id}`);
  }

  burnSummary(): Promise<unknown> {
    return this.http.get('/v1/monetary/burns');
  }
}

export class MonetaryClient {
  readonly http: HttpTransport;
  constructor(http: HttpTransport) {
    this.http = http;
  }

  policy(): Promise<unknown> {
    return this.http.get('/v1/monetary/policy');
  }

  supply(): Promise<unknown> {
    return this.http.get('/v1/monetary/supply');
  }

  genesis(): Promise<unknown> {
    return this.http.get('/v1/monetary/genesis');
  }

  issuanceReceipt(id: string): Promise<unknown> {
    return this.http.get(`/v1/monetary/issuance/${id}`);
  }

  burns(): Promise<unknown> {
    return this.http.get('/v1/monetary/burns');
  }
}

export class FeeClient {
  readonly http: HttpTransport;
  constructor(http: HttpTransport) {
    this.http = http;
  }

  schedule(): Promise<FeeDeclaration> {
    return this.http.get('/v1/fees/schedule');
  }

  estimate(bytes = 256, sigs = 1): Promise<FeeDeclaration> {
    return this.http.get(`/v1/fees/estimate?bytes=${bytes}&sigs=${sigs}`);
  }

  resources(bytes = 256, sigs = 1): Promise<unknown> {
    return this.http.get(`/v1/fees/resources?bytes=${bytes}&sigs=${sigs}`);
  }

  receipt(transactionId: string): Promise<unknown> {
    return this.http.get(`/v1/fees/receipts/${transactionId}`);
  }

  getFeePolicy(): Promise<unknown> {
    return this.http.get('/v1/fees/policy');
  }

  getBaseResourcePrice(): Promise<unknown> {
    return this.http.get('/v1/fees/price');
  }

  estimateResources(bytes = 256, sigs = 1, signatureClass = 'CLASSICAL'): Promise<unknown> {
    return this.http.get(`/v1/fees/resources?bytes=${bytes}&sigs=${sigs}&class=${signatureClass}`);
  }

  estimateFeeV2(bytes = 256, sigs = 1, signatureClass = 'CLASSICAL'): Promise<unknown> {
    return this.http.get(`/v1/fees/estimate-v2?bytes=${bytes}&sigs=${sigs}&class=${signatureClass}`);
  }
}

export class ValidatorClient {
  readonly http: HttpTransport;
  constructor(http: HttpTransport) {
    this.http = http;
  }

  list(): Promise<unknown> {
    return this.http.get('/v1/validators');
  }

  epochs(): Promise<unknown> {
    return this.http.get('/v1/validators/epochs');
  }

  evidence(): Promise<unknown> {
    return this.http.get('/v1/validators/evidence');
  }

  getValidatorEconomicPolicy(): Promise<unknown> {
    return this.http.get('/v1/validators/economics/policy');
  }

  getValidatorBond(validatorId: string): Promise<unknown> {
    return this.http.get(`/v1/validators/${encodeURIComponent(validatorId)}/bond`);
  }

  getValidatorRewardSummary(validatorId: string): Promise<unknown> {
    return this.http.get(`/v1/validators/${encodeURIComponent(validatorId)}/rewards`);
  }

  getValidatorPublicPenalties(validatorId: string): Promise<unknown> {
    return this.http.get(`/v1/validators/${encodeURIComponent(validatorId)}/penalties`);
  }

  getValidatorUnbondStatus(validatorId: string): Promise<unknown> {
    return this.http.get(`/v1/validators/${encodeURIComponent(validatorId)}/unbond`);
  }
}

export class GovernanceClient {
  readonly http: HttpTransport;
  constructor(http: HttpTransport) {
    this.http = http;
  }

  proposals(): Promise<unknown> {
    return this.http.get('/v1/governance/proposals');
  }

  upgrades(): Promise<unknown> {
    return this.http.get('/v1/governance/upgrades');
  }

  votes(): Promise<unknown> {
    return this.http.get('/v1/governance/votes');
  }

  versions(): Promise<unknown> {
    return this.http.get('/v1/governance/versions');
  }

  activations(): Promise<unknown> {
    return this.http.get('/v1/governance/activations');
  }

  operationPackage(): Promise<unknown> {
    return this.http.get('/v1/governance/operations/package');
  }

  policyDiff(): Promise<unknown> {
    return this.http.get('/v1/governance/operations/diff');
  }

  activationStatus(): Promise<unknown> {
    return this.http.get('/v1/governance/operations/activation');
  }

  emergencyStatus(): Promise<unknown> {
    return this.http.get('/v1/governance/operations/emergency');
  }
}

export class OracleClient {
  readonly http: HttpTransport;
  constructor(http: HttpTransport) {
    this.http = http;
  }

  providers(): Promise<unknown> {
    return this.http.get('/v1/oracles/providers');
  }

  feeds(): Promise<unknown> {
    return this.http.get('/v1/oracles/feeds');
  }

  observations(): Promise<unknown> {
    return this.http.get('/v1/oracles/observations');
  }

  facts(): Promise<unknown> {
    return this.http.get('/v1/oracles/facts');
  }

  quality(): Promise<unknown> {
    return this.http.get('/v1/oracles/quality');
  }
}

export class ProductiveClient {
  readonly http: HttpTransport;
  constructor(http: HttpTransport) {
    this.http = http;
  }

  objects(): Promise<unknown> {
    return this.http.get('/v1/productive/objects');
  }

  claims(): Promise<unknown> {
    return this.http.get('/v1/productive/claims');
  }

  contributions(): Promise<unknown> {
    return this.http.get('/v1/productive/contributions');
  }

  lineage(): Promise<unknown> {
    return this.http.get('/v1/productive/lineage');
  }

  graph(): Promise<unknown> {
    return this.http.get('/v1/productive/graph');
  }

  moonreyAttribution(): Promise<unknown> {
    return this.http.get('/v1/productive/moonrey');
  }

  getMoonReyPolicy(): Promise<unknown> {
    return this.http.get('/v1/productive/moonrey/policy');
  }

  getMoonReyCategoryPolicy(category: string): Promise<unknown> {
    return this.http.get(`/v1/productive/moonrey/categories/${encodeURIComponent(category)}`);
  }

  getProductiveContribution(contributionId: string): Promise<unknown> {
    return this.http.get(`/v1/productive/contributions/${encodeURIComponent(contributionId)}`);
  }

  getMoonReyIssuanceReceipt(issuanceId: string): Promise<unknown> {
    return this.http.get(`/v1/productive/moonrey/issuance/${encodeURIComponent(issuanceId)}`);
  }

  getMoonReySupplyPressure(): Promise<unknown> {
    return this.http.get('/v1/productive/moonrey/supply-pressure');
  }
}

export class MachineClient {
  readonly http: HttpTransport;
  constructor(http: HttpTransport) {
    this.http = http;
  }

  identities(): Promise<unknown> {
    return this.http.get('/v1/machines');
  }

  capabilities(): Promise<unknown> {
    return this.http.get('/v1/machines/capabilities');
  }

  offers(): Promise<unknown> {
    return this.http.get('/v1/machines/offers');
  }

  commerce(): Promise<unknown> {
    return this.http.get('/v1/machines/commerce');
  }

  deliveries(): Promise<unknown> {
    return this.http.get('/v1/machines/deliveries');
  }
}

export class InteropClient {
  readonly http: HttpTransport;
  constructor(http: HttpTransport) {
    this.http = http;
  }

  chains(): Promise<unknown> {
    return this.http.get('/v1/interop/chains');
  }

  clients(): Promise<unknown> {
    return this.http.get('/v1/interop/clients');
  }

  connections(): Promise<unknown> {
    return this.http.get('/v1/interop/connections');
  }

  channels(): Promise<unknown> {
    return this.http.get('/v1/interop/channels');
  }

  packets(): Promise<unknown> {
    return this.http.get('/v1/interop/packets');
  }

  security(): Promise<unknown> {
    return this.http.get('/v1/interop/security');
  }
}

export class ExchangeClient {
  readonly http: HttpTransport;
  constructor(http: HttpTransport) {
    this.http = http;
  }

  listMarkets(): Promise<unknown> {
    return this.http.get('/v1/exchange/markets');
  }

  getInstrument(id: string): Promise<unknown> {
    return this.http.get(`/v1/exchange/instruments/${id}`);
  }

  getOrderBook(marketId: string): Promise<unknown> {
    return this.http.get(`/v1/exchange/order-books/${marketId}`);
  }

  placeSignedOrder(input: {
    readonly market_id: string;
    readonly signed_order_hex: string;
    readonly actor: string;
  }): Promise<unknown> {
    return this.http.post('/v1/exchange/orders', input);
  }

  cancelOrder(orderId: string): Promise<unknown> {
    return this.http.post(`/v1/exchange/orders/${orderId}/cancel`, {});
  }

  getTrade(tradeId: string): Promise<unknown> {
    return this.http.get(`/v1/exchange/trades/${tradeId}`);
  }

  getSettlement(settlementId: string): Promise<unknown> {
    return this.http.get(`/v1/exchange/settlements/${settlementId}`);
  }

  getAuction(): Promise<unknown> {
    return this.http.get('/v1/exchange/auctions');
  }

  getCapacityContract(): Promise<unknown> {
    return this.http.get('/v1/exchange/capacity-contracts');
  }

  marketData(marketId: string, tier: 'public' | 'authorized' = 'public'): Promise<unknown> {
    return this.http.get(`/v1/exchange/market-data?market_id=${encodeURIComponent(marketId)}&tier=${tier}`);
  }

  orderSandbox(input: {
    readonly market_id: string;
    readonly signed_order_hex: string;
    readonly actor: string;
    readonly environment?: 'SANDBOX';
  }): Promise<unknown> {
    return this.http.post('/v1/exchange/sandbox/orders', {
      ...input,
      environment: 'SANDBOX',
    });
  }

  orderStatus(orderId: string): Promise<unknown> {
    return this.http.get(`/v1/exchange/orders/${orderId}`);
  }

  tradingSession(sessionId: string): Promise<unknown> {
    return this.http.get(`/v1/exchange/trading-sessions/${sessionId}`);
  }

  listFills(): Promise<unknown> {
    return this.http.get('/v1/exchange/fills');
  }

  listHoldings(): Promise<unknown> {
    return this.http.get('/v1/exchange/holdings');
  }

  streamMarket(): Promise<unknown> {
    return this.http.get('/v1/exchange/stream');
  }

  getConsumerPortfolio(participantId: string): Promise<unknown> {
    return this.http.get(`/v1/consumer/exchange/portfolio?participant_id=${encodeURIComponent(participantId)}`);
  }

  getConsumerMarket(): Promise<unknown> {
    return this.http.get('/v1/consumer/exchange/markets');
  }

  getConsumerQuote(input: {
    readonly participant_id: string;
    readonly side: 'BUY' | 'SELL';
    readonly quantity: string;
  }): Promise<unknown> {
    return this.http.post('/v1/consumer/exchange/quotes', input);
  }

  previewConsumerTrade(input: Readonly<Record<string, string>>): Promise<unknown> {
    return this.http.post('/v1/consumer/exchange/preview', input);
  }

  submitConsumerTrade(input: Readonly<Record<string, unknown>>): Promise<unknown> {
    return this.http.post('/v1/consumer/exchange/orders', input);
  }

  cancelConsumerOrder(orderId: string, input: Readonly<Record<string, unknown>> = {}): Promise<unknown> {
    return this.http.post(`/v1/consumer/exchange/orders/${orderId}/cancel`, input);
  }

  getConsumerOrder(orderId: string): Promise<unknown> {
    return this.http.get(`/v1/consumer/exchange/orders/${orderId}`);
  }

  getConsumerTradeReceipt(orderId: string): Promise<unknown> {
    return this.http.get(`/v1/consumer/exchange/receipts/${orderId}`);
  }

  createPriceAlert(input: Readonly<Record<string, unknown>>): Promise<unknown> {
    return this.http.post('/v1/consumer/exchange/alerts', input);
  }
}

export class ProtocolTreasuryClient {
  readonly http: HttpTransport;
  constructor(http: HttpTransport) {
    this.http = http;
  }

  getProtocolTreasury(): Promise<unknown> {
    return this.http.get('/v1/treasury');
  }

  getProtocolReserves(): Promise<unknown> {
    return this.http.get('/v1/treasury/reserves');
  }

  getTreasuryBudget(budgetId?: string): Promise<unknown> {
    return budgetId
      ? this.http.get(`/v1/treasury/budgets/${encodeURIComponent(budgetId)}`)
      : this.http.get('/v1/treasury/budgets');
  }

  getTreasuryDisbursement(disbursementId?: string): Promise<unknown> {
    return disbursementId
      ? this.http.get(`/v1/treasury/disbursements/${encodeURIComponent(disbursementId)}`)
      : this.http.get('/v1/treasury/disbursements');
  }

  getTreasuryPolicy(): Promise<unknown> {
    return this.http.get('/v1/treasury/policy');
  }
}

export class InformationClient {
  readonly http: HttpTransport;
  constructor(http: HttpTransport) {
    this.http = http;
  }

  getInformationRights(subjectId: string): Promise<unknown> {
    return this.http.get(`/v1/information/rights?subject_id=${encodeURIComponent(subjectId)}`);
  }

  getInformationRequests(requesterId?: string): Promise<unknown> {
    const query = requesterId ? `?requester_id=${encodeURIComponent(requesterId)}` : '';
    return this.http.get(`/v1/information/requests${query}`);
  }

  previewInformationConsent(input: {
    readonly request_id: string;
    readonly subject_id: string;
    readonly descriptor_id: string;
  }): Promise<unknown> {
    return this.http.post('/v1/information/consent/preview', input);
  }

  approveInformationConsent(input: {
    readonly request_id: string;
    readonly subject_id: string;
    readonly descriptor_id: string;
  }): Promise<unknown> {
    return this.http.post('/v1/information/consent/approve', input);
  }

  revokeInformationConsent(input: { readonly grant_id: string }): Promise<unknown> {
    return this.http.post('/v1/information/consent/revoke', input);
  }

  getInformationUsage(subjectId?: string): Promise<unknown> {
    const query = subjectId ? `?subject_id=${encodeURIComponent(subjectId)}` : '';
    return this.http.get(`/v1/information/usage${query}`);
  }

  getInformationCompensation(subjectId?: string): Promise<unknown> {
    const query = subjectId ? `?subject_id=${encodeURIComponent(subjectId)}` : '';
    return this.http.get(`/v1/information/compensation${query}`);
  }

  submitInformationRequest(input: Record<string, unknown>): Promise<unknown> {
    return this.http.post('/v1/information/requests', input);
  }

  submitCleanRoomComputation(input: Record<string, unknown>): Promise<unknown> {
    return this.http.post('/v1/information/clean-room', input);
  }

  getCleanRoomResult(computationRequestId: string): Promise<unknown> {
    return this.http.get(`/v1/information/clean-room/${encodeURIComponent(computationRequestId)}`);
  }

  listHinContributions(): Promise<unknown> {
    return this.http.get('/v1/hin/contributions');
  }

  getHinContribution(contributionId: string): Promise<unknown> {
    return this.http.get(`/v1/hin/contributions/${encodeURIComponent(contributionId)}`);
  }

  getHinMetrics(): Promise<unknown> {
    return this.http.get('/v1/hin/metrics');
  }

  getHinMySummary(): Promise<unknown> {
    return this.http.get('/v1/hin/me/summary');
  }

  listHinValuationMethodologies(): Promise<unknown> {
    return this.http.get('/v1/hin/valuation-methodologies');
  }
}

export class EventClient {
  readonly http: HttpTransport;
  constructor(http: HttpTransport) {
    this.http = http;
  }

  replay(input: { readonly cursor?: string; readonly subscribe?: readonly EventType[] } = {}): Promise<{
    readonly events: readonly PublicStreamEvent[];
    readonly cursor: string;
  }> {
    const params = new URLSearchParams({ format: 'json' });
    if (input.cursor) {
      params.set('cursor', input.cursor);
    }
    if (input.subscribe && input.subscribe.length > 0) {
      params.set('subscribe', input.subscribe.join(','));
    }
    return this.http.get(`/v1/events?${params.toString()}`);
  }
}

export class SunReyClient {
  readonly wallet: WalletClient;
  readonly assets: AssetClient;
  readonly monetary: MonetaryClient;
  readonly fees: FeeClient;
  readonly validators: ValidatorClient;
  readonly governance: GovernanceClient;
  readonly oracles: OracleClient;
  readonly productive: ProductiveClient;
  readonly machines: MachineClient;
  readonly interop: InteropClient;
  readonly exchange: ExchangeClient;
  readonly treasury: ProtocolTreasuryClient;
  readonly information: InformationClient;
  readonly events: EventClient;

  readonly http: HttpTransport;
  constructor(http: HttpTransport) {
    this.http = http;
    this.wallet = new WalletClient(http);
    this.assets = new AssetClient(http);
    this.monetary = new MonetaryClient(http);
    this.fees = new FeeClient(http);
    this.validators = new ValidatorClient(http);
    this.governance = new GovernanceClient(http);
    this.oracles = new OracleClient(http);
    this.productive = new ProductiveClient(http);
    this.machines = new MachineClient(http);
    this.interop = new InteropClient(http);
    this.exchange = new ExchangeClient(http);
    this.treasury = new ProtocolTreasuryClient(http);
    this.information = new InformationClient(http);
    this.events = new EventClient(http);
  }

  status(): Promise<ChainStatus> {
    return this.http.get('/v1/chain/status');
  }

  getNetworkPhase(): Promise<unknown> {
    return this.http.get('/v1/network/phase');
  }

  getCapabilityStatus(): Promise<unknown> {
    return this.http.get('/v1/network/capabilities');
  }

  getPostGenesisHealth(): Promise<unknown> {
    return this.http.get('/v1/network/health');
  }

  getProtocolVersion(): Promise<unknown> {
    return this.http.get('/v1/chain/protocol');
  }

  transaction(id: string): Promise<TransactionReceipt> {
    return this.http.get(`/v1/chain/transactions/${id}`);
  }

  faucet(accountId: string, amount: bigint): Promise<AssetHolding> {
    return this.http.post('/v1/dev/faucet', { account_id: accountId, amount: amount.toString() });
  }

  async submitTransaction(input: {
    readonly signed_envelope_hex: string;
    readonly network_id?: string;
    readonly actor?: string;
    readonly idempotency_key?: string;
    readonly from_account_id?: string;
    readonly to_account_id?: string;
    readonly amount?: bigint;
    readonly previous_transaction_id?: string;
  }): Promise<SubmissionResponse> {
    const body = {
      signed_envelope_hex: input.signed_envelope_hex,
      network_id: input.network_id ?? PUBLIC_NETWORK_ID,
      actor: input.actor ?? 'public',
      ...(input.idempotency_key !== undefined ? { idempotency_key: input.idempotency_key } : {}),
      ...(input.from_account_id !== undefined ? { from_account_id: input.from_account_id } : {}),
      ...(input.to_account_id !== undefined ? { to_account_id: input.to_account_id } : {}),
      ...(input.amount !== undefined ? { amount: input.amount.toString() } : {}),
    };
    const submitted = await this.http.post<SubmissionResponse>('/v1/transactions', body);
    if (input.previous_transaction_id && !submissionRetrySafe({
      previousTransactionId: input.previous_transaction_id,
      nextTransactionId: submitted.transaction_id,
    })) {
      throw new Error('unsafe retry would create a new economic transaction');
    }
    return submitted;
  }

  buildTransfer(input: {
    readonly account: BlockchainAccount;
    readonly toAccountId: string;
    readonly toAddressText: string;
    readonly amount: bigint;
    readonly maxFee: bigint;
    readonly nonce: bigint;
  }): BuiltPublicTransaction {
    return buildNativeAssetTransfer(input);
  }

  buildLock(input: Parameters<typeof buildAssetLock>[0]): BuiltPublicTransaction {
    return buildAssetLock(input);
  }

  buildUnlock(input: Parameters<typeof buildAssetUnlock>[0]): BuiltPublicTransaction {
    return buildAssetUnlock(input);
  }

  buildMachineCommerce(input: Parameters<typeof buildMachineCommerce>[0]): BuiltPublicTransaction {
    return buildMachineCommerce(input);
  }

  buildOracleObservation(input: Parameters<typeof buildOracleObservation>[0]): BuiltPublicTransaction {
    return buildOracleObservation(input);
  }

  buildProductiveClaim(input: Parameters<typeof buildProductiveClaim>[0]): BuiltPublicTransaction {
    return buildProductiveClaim(input);
  }

  buildGovernanceVote(input: Parameters<typeof buildGovernanceVote>[0]): BuiltPublicTransaction {
    return buildGovernanceVote(input);
  }

  buildInterchainPacket(input: Parameters<typeof buildInterchainPacket>[0]): BuiltPublicTransaction {
    return buildInterchainPacket(input);
  }

  signLocally(signer: InjectedDevelopmentSigner, keyId: string, built: BuiltPublicTransaction): string {
    const signature = signer.sign(keyId, Buffer.from(built.sign_bytes_hex, 'hex'));
    return `${built.unsigned_envelope_hex}${signature.signatureHex}`;
  }
}
