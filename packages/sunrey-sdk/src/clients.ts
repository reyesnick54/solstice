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
    this.events = new EventClient(http);
  }

  status(): Promise<ChainStatus> {
    return this.http.get('/v1/chain/status');
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
