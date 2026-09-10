/**
 * Lovable Consumer BFF for Exchange, wallets, and economy views.
 * Frontend-provided instructions are never trusted order or issuance state.
 */

import { asUtcInstant, type UtcInstant } from '@solstice/domain';
import {
  DigitalAssetLifecycle,
  MARKET_DATA_CLIENT_STATUSES,
  moonreyCoinEconomyView,
  sunreyCoinEconomyView,
  type ConsumerAlphaIdempotencyRecord,
  type ConsumerAlphaIdempotencyResource,
  type LifecycleMode,
} from '@solstice/sunrey-exchange';
import { bffError, type BffErrorEnvelope } from './errors.ts';
import type { BffPrincipal } from './ports.ts';

export type ExchangeBffPersistenceHooks = {
  load(customerId: string, mode: LifecycleMode): Promise<DigitalAssetLifecycle | null>;
  save(customerId: string, mode: LifecycleMode, world: DigitalAssetLifecycle): Promise<void>;
  loadIdempotency(idempotencyKey: string): Promise<ConsumerAlphaIdempotencyRecord | null>;
  saveIdempotency(record: ConsumerAlphaIdempotencyRecord): Promise<void>;
};

export class ExchangeBffSurface {
  private readonly worlds = new Map<string, DigitalAssetLifecycle>();
  private readonly now: () => UtcInstant;
  private readonly persistence: ExchangeBffPersistenceHooks | null;

  constructor(
    now: () => UtcInstant = () => asUtcInstant(new Date().toISOString()),
    persistence: ExchangeBffPersistenceHooks | null = null,
    preloadedWorlds?: Map<string, DigitalAssetLifecycle>,
  ) {
    this.now = now;
    this.persistence = persistence;
    if (preloadedWorlds) {
      for (const [key, world] of preloadedWorlds) {
        this.worlds.set(key, world);
      }
    }
  }

  worldFor(principal: BffPrincipal, mode?: LifecycleMode): DigitalAssetLifecycle {
    const key = `${principal.customerId}:${mode ?? 'READY'}`;
    const existing = this.worlds.get(key);
    if (existing) {
      return existing;
    }
    const created = new DigitalAssetLifecycle({
      now: this.now(),
      participantId: principal.customerId,
      mode: mode ?? (principal.restricted ? 'COMPLIANCE_BLOCKED' : 'READY'),
    });
    this.worlds.set(key, created);
    void this.persistWorld(principal.customerId, mode ?? 'READY', created);
    return created;
  }

  home(principal: BffPrincipal, requestId: string): Record<string, unknown> {
    return { ...this.worldFor(principal).home(), requestId };
  }

  markets(principal: BffPrincipal, requestId: string): Record<string, unknown> {
    return { ...this.worldFor(principal).markets(), requestId };
  }

  market(principal: BffPrincipal, marketId: string, requestId: string): Record<string, unknown> {
    return { ...this.worldFor(principal).marketDetail(marketId), requestId };
  }

  ticker(principal: BffPrincipal, requestId: string): Record<string, unknown> {
    return { ...this.worldFor(principal).ticker(), requestId };
  }

  orderBook(principal: BffPrincipal, requestId: string): Record<string, unknown> {
    return { ...this.worldFor(principal).orderBook(), requestId };
  }

  chart(principal: BffPrincipal, requestId: string): Record<string, unknown> {
    return { ...this.worldFor(principal).chart(), requestId };
  }

  eligibility(principal: BffPrincipal, requestId: string): Record<string, unknown> {
    return { ...this.worldFor(principal).eligibility(), requestId };
  }

  holdings(principal: BffPrincipal, requestId: string): Record<string, unknown> {
    return { ...this.worldFor(principal).holdings(), requestId };
  }

  fund(principal: BffPrincipal, requestId: string): Record<string, unknown> {
    return { ...this.worldFor(principal).fundQuote(), requestId };
  }

  preview(principal: BffPrincipal, body: Record<string, unknown>, requestId: string): Record<string, unknown> | BffErrorEnvelope {
    const side = body.side === 'SELL' ? 'SELL' : 'BUY';
    const quantity = parseQty(body.quantity);
    if (quantity === null) {
      return this.fail(requestId, 'VALIDATION', 'INVALID_QUANTITY');
    }
    const notionalUsdMinor = str(body.notionalUsdMinor);
    const preview = this.worldFor(principal).preview({
      side,
      quantity,
      ...(notionalUsdMinor ? { notionalUsdMinor } : {}),
    });
    if ('ok' in preview && preview.ok === false) {
      return this.fail(requestId, 'POLICY', preview.reason);
    }
    return this.jsonQty(preview as object, requestId);
  }

  createProposal(principal: BffPrincipal, body: Record<string, unknown>, requestId: string): Record<string, unknown> | BffErrorEnvelope {
    const side = body.side === 'SELL' ? 'SELL' : 'BUY';
    const quantity = parseQty(body.quantity);
    if (quantity === null) {
      return this.fail(requestId, 'VALIDATION', 'INVALID_QUANTITY');
    }
    const proposal = this.worldFor(principal).createProposal({
      side,
      quantity,
      notionalUsdMinor: str(body.notionalUsdMinor) ?? '50000',
      origin: body.origin === 'AGENT' ? 'AGENT' : 'HUMAN',
    });
    if ('ok' in proposal && proposal.ok === false) {
      return this.fail(requestId, 'POLICY', proposal.reason);
    }
    void this.persistWorld(principal.customerId, 'READY', this.worldFor(principal));
    return this.jsonQty(proposal as object, requestId);
  }

  approve(
    principal: BffPrincipal,
    proposalId: string,
    body: Record<string, unknown>,
    requestId: string,
  ): Record<string, unknown> | BffErrorEnvelope {
    if (principal.restricted) {
      return this.fail(requestId, 'POLICY', 'COMPLIANCE_BLOCKED');
    }
    const result = this.worldFor(principal).approveProposal({
      proposalId,
      actor: body.actor === 'AGENT' ? 'AGENT' : 'HUMAN',
      stepUpSatisfied: body.stepUpSatisfied === true,
    });
    if ('ok' in result && result.ok === false) {
      return this.fail(requestId, result.reason === 'STEP_UP_REQUIRED' ? 'AUTH' : 'POLICY', result.reason);
    }
    void this.persistWorld(principal.customerId, 'READY', this.worldFor(principal));
    return this.jsonQty(result as object, requestId);
  }

  async submit(
    principal: BffPrincipal,
    proposalId: string,
    body: Record<string, unknown>,
    requestId: string,
  ): Promise<Record<string, unknown> | BffErrorEnvelope> {
    const idempotencyKey = readExchangeIdempotencyKey(body, requestId);
    const replay = await this.loadIdempotentResponse(principal.customerId, idempotencyKey, 'ORDER');
    if (replay) {
      return { ...replay, requestId, replay: true };
    }
    const result = this.worldFor(principal).submitOrder(proposalId, str(body.clientOrderId));
    if ('ok' in result && result.ok === false) {
      return this.fail(requestId, 'POLICY', result.reason);
    }
    const world = this.worldFor(principal);
    await this.persistWorld(principal.customerId, 'READY', world);
    const response = this.jsonQty(result as object, requestId);
    await this.saveIdempotentResponse({
      idempotencyKey,
      customerId: principal.customerId,
      resourceType: 'ORDER',
      resourceId: String((result as { orderId?: string }).orderId ?? proposalId),
      response,
    });
    return response;
  }

  orders(principal: BffPrincipal, requestId: string): Record<string, unknown> {
    return { ...this.worldFor(principal).orders(), requestId };
  }

  fills(principal: BffPrincipal, requestId: string): Record<string, unknown> {
    return { ...this.worldFor(principal).fills(), requestId };
  }

  stream(principal: BffPrincipal, requestId: string): Record<string, unknown> {
    return { ...this.worldFor(principal).stream(), requestId };
  }

  wallets(principal: BffPrincipal, requestId: string): Record<string, unknown> {
    return { ...this.worldFor(principal).wallet(), requestId };
  }

  depositAddress(principal: BffPrincipal, requestId: string): Record<string, unknown> {
    const wallet = this.worldFor(principal).wallet();
    return { schema: 'sunrey.consumer.wallet.deposit-address.v1', address: wallet.depositAddress, source: wallet.source, requestId };
  }

  async simulateDeposit(
    principal: BffPrincipal,
    body: Record<string, unknown>,
    requestId: string,
  ): Promise<Record<string, unknown> | BffErrorEnvelope> {
    const idempotencyKey = readExchangeIdempotencyKey(body, requestId);
    const replay = await this.loadIdempotentResponse(principal.customerId, idempotencyKey, 'DEPOSIT');
    if (replay) {
      return { ...replay, requestId, replay: true };
    }
    const quantity = parseQty(body.quantity) ?? 25n;
    const result = this.worldFor(principal).simulateDeposit(quantity);
    if (result.ok === false) {
      return this.fail(requestId, 'TEMPORARY_UNAVAILABLE', String(result.reason));
    }
    const world = this.worldFor(principal);
    await this.persistWorld(principal.customerId, 'READY', world);
    const response = { ...result, requestId };
    await this.saveIdempotentResponse({
      idempotencyKey,
      customerId: principal.customerId,
      resourceType: 'DEPOSIT',
      resourceId: String(result.depositId),
      response,
    });
    return response;
  }

  withdrawalQuote(principal: BffPrincipal, body: Record<string, unknown>, requestId: string): Record<string, unknown> | BffErrorEnvelope {
    const quantity = parseQty(body.quantity);
    if (quantity === null) {
      return this.fail(requestId, 'VALIDATION', 'INVALID_QUANTITY');
    }
    const result = this.worldFor(principal).withdrawalQuote({
      assetId: body.assetId === 'MOONREY_COIN' ? 'MOONREY_COIN' : 'SUNREY_COIN',
      quantity,
      destination: str(body.destination) ?? '',
    });
    if (result.ok === false) {
      return this.fail(requestId, 'POLICY', String(result.reason));
    }
    return { ...result, requestId };
  }

  async withdraw(
    principal: BffPrincipal,
    body: Record<string, unknown>,
    requestId: string,
  ): Promise<Record<string, unknown> | BffErrorEnvelope> {
    const idempotencyKey = readExchangeIdempotencyKey(body, requestId);
    const replay = await this.loadIdempotentResponse(principal.customerId, idempotencyKey, 'WITHDRAWAL');
    if (replay) {
      return { ...replay, requestId, replay: true };
    }
    const quantity = parseQty(body.quantity);
    if (quantity === null) {
      return this.fail(requestId, 'VALIDATION', 'INVALID_QUANTITY');
    }
    const result = this.worldFor(principal).withdraw({
      assetId: body.assetId === 'MOONREY_COIN' ? 'MOONREY_COIN' : 'SUNREY_COIN',
      quantity,
      destination: str(body.destination) ?? '',
      approved: body.approved === true,
      actor: body.actor === 'AGENT' ? 'AGENT' : 'HUMAN',
    });
    if (result.ok === false) {
      return this.fail(requestId, 'POLICY', String(result.reason));
    }
    const world = this.worldFor(principal);
    await this.persistWorld(principal.customerId, 'READY', world);
    const response = { ...result, requestId };
    await this.saveIdempotentResponse({
      idempotencyKey,
      customerId: principal.customerId,
      resourceType: 'WITHDRAWAL',
      resourceId: String(result.withdrawalId),
      response,
    });
    return response;
  }

  transactions(principal: BffPrincipal, requestId: string): Record<string, unknown> {
    return { ...this.worldFor(principal).transactions(), requestId };
  }

  sunreyCoin(principal: BffPrincipal, requestId: string): Record<string, unknown> {
    return { ...this.worldFor(principal).sunreyCoin(), economy: sunreyCoinEconomyView(this.now()), requestId };
  }

  moonreyCoin(principal: BffPrincipal, requestId: string): Record<string, unknown> {
    return {
      ...this.worldFor(principal).moonreyCoin(),
      economy: moonreyCoinEconomyView(this.now(), [
        'energy',
        'compute',
        'manufacturing',
        'resources',
        'food_agriculture',
        'real_estate',
        'logistics',
      ]),
      requestId,
    };
  }

  economy(principal: BffPrincipal, requestId: string): Record<string, unknown> {
    void principal;
    return {
      schema: 'sunrey.consumer.economy.v1',
      sunreyCoin: sunreyCoinEconomyView(this.now()),
      moonreyCoin: moonreyCoinEconomyView(this.now(), [
        'energy',
        'compute',
        'manufacturing',
        'resources',
        'food_agriculture',
        'real_estate',
        'logistics',
      ]),
      requestId,
      productionEconomics: false,
    };
  }

  economyStatus(principal: BffPrincipal, requestId: string): Record<string, unknown> {
    const world = this.worldFor(principal);
    return {
      schema: 'sunrey.consumer.economy.status.v1',
      marketData: world.marketDataStatus(),
      hin: 'SANDBOX',
      productiveOracle: 'SANDBOX',
      freshnessValues: MARKET_DATA_CLIENT_STATUSES,
      live: false,
      delayed: false,
      unavailable: false,
      requestId,
    };
  }

  private async persistWorld(customerId: string, mode: LifecycleMode, world: DigitalAssetLifecycle): Promise<void> {
    if (!this.persistence) {
      return;
    }
    await this.persistence.save(customerId, mode, world);
  }

  private async loadIdempotentResponse(
    customerId: string,
    idempotencyKey: string,
    resourceType: ConsumerAlphaIdempotencyResource,
  ): Promise<Record<string, unknown> | null> {
    if (!this.persistence) {
      return null;
    }
    const record = await this.persistence.loadIdempotency(idempotencyKey);
    if (!record || record.customerId !== customerId || record.resourceType !== resourceType) {
      return null;
    }
    return JSON.parse(record.responseCanonical) as Record<string, unknown>;
  }

  private async saveIdempotentResponse(input: {
    readonly idempotencyKey: string;
    readonly customerId: string;
    readonly resourceType: ConsumerAlphaIdempotencyResource;
    readonly resourceId: string;
    readonly response: Record<string, unknown>;
  }): Promise<void> {
    if (!this.persistence) {
      return;
    }
    await this.persistence.saveIdempotency(
      Object.freeze({
        idempotencyKey: input.idempotencyKey,
        customerId: input.customerId,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        responseCanonical: JSON.stringify(input.response),
        createdAt: this.now(),
      }),
    );
  }

  private fail(requestId: string, category: 'VALIDATION' | 'POLICY' | 'AUTH' | 'TEMPORARY_UNAVAILABLE', code: string): BffErrorEnvelope {
    const errorCode =
      code === 'STEP_UP_REQUIRED'
        ? 'STEP_UP_REQUIRED'
        : category === 'VALIDATION'
          ? 'VALIDATION'
          : category === 'TEMPORARY_UNAVAILABLE'
            ? 'FEATURE_UNAVAILABLE'
            : 'KERNEL_REFUSED';
    return bffError({
      errorCode,
      category:
        category === 'AUTH'
          ? 'AUTHENTICATION'
          : category === 'TEMPORARY_UNAVAILABLE'
            ? 'TEMPORARY_UNAVAILABLE'
            : category === 'VALIDATION'
              ? 'VALIDATION'
              : 'POLICY',
      message: code,
      retryable: category === 'TEMPORARY_UNAVAILABLE',
      requestId,
      detailsSafeForClient: { reason: code },
    });
  }

  private jsonQty(value: object, requestId: string): Record<string, unknown> {
    const parsed = JSON.parse(
      JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item)),
    ) as Record<string, unknown>;
    return { ...parsed, requestId };
  }
}

function parseQty(value: unknown): bigint | null {
  if (typeof value === 'bigint') {
    return value > 0n ? value : null;
  }
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return BigInt(value);
  }
  if (typeof value === 'string' && /^\d+$/.test(value) && value !== '0') {
    return BigInt(value);
  }
  return null;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readExchangeIdempotencyKey(body: Record<string, unknown>, requestId: string): string {
  const fromBody = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '';
  const fromClient = typeof body.clientOrderId === 'string' ? body.clientOrderId.trim() : '';
  return fromBody || fromClient || `idem_${requestId}`;
}
