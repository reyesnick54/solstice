/**
 * Lovable Consumer BFF for Exchange, wallets, and economy views.
 * Frontend-provided instructions are never trusted order or issuance state.
 */

import type { UtcInstant } from '../../../../packages/domain/src/time.ts';
import { asUtcInstant } from '../../../../packages/domain/src/time.ts';
import {
  DigitalAssetLifecycle,
  MARKET_DATA_CLIENT_STATUSES,
  moonreyCoinEconomyView,
  sunreyCoinEconomyView,
  type LifecycleMode,
} from '../../../../packages/sunrey-exchange/src/productization/index.ts';
import { bffError, type BffErrorEnvelope } from './errors.ts';
import type { BffPrincipal } from './ports.ts';

export class ExchangeBffSurface {
  private readonly worlds = new Map<string, DigitalAssetLifecycle>();
  private readonly now: () => UtcInstant;

  constructor(now: () => UtcInstant = () => asUtcInstant(new Date().toISOString())) {
    this.now = now;
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
    const preview = this.worldFor(principal).preview({ side, quantity, notionalUsdMinor: str(body.notionalUsdMinor) });
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
    return this.jsonQty(result as object, requestId);
  }

  submit(principal: BffPrincipal, proposalId: string, body: Record<string, unknown>, requestId: string): Record<string, unknown> | BffErrorEnvelope {
    const result = this.worldFor(principal).submitOrder(proposalId, str(body.clientOrderId));
    if ('ok' in result && result.ok === false) {
      return this.fail(requestId, 'POLICY', result.reason);
    }
    return this.jsonQty(result as object, requestId);
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

  simulateDeposit(principal: BffPrincipal, body: Record<string, unknown>, requestId: string): Record<string, unknown> | BffErrorEnvelope {
    const quantity = parseQty(body.quantity) ?? 25n;
    const result = this.worldFor(principal).simulateDeposit(quantity);
    if (result.ok === false) {
      return this.fail(requestId, 'TEMPORARY_UNAVAILABLE', String(result.reason));
    }
    return { ...result, requestId };
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

  withdraw(principal: BffPrincipal, body: Record<string, unknown>, requestId: string): Record<string, unknown> | BffErrorEnvelope {
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
    return { ...result, requestId };
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
