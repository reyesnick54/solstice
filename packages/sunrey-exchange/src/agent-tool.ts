import { err, ok, type Result } from '../../domain/src/result.ts';
import { isVerifiedActorContext } from '../../identity/src/actor-context.ts';
import { PRICE_LABEL } from './taxonomy.ts';
import type { ExchangeFailure, MarketDataSnapshot } from './types.ts';
import type { SunReyExchangeService } from './service.ts';
import type { ExchangeMarketId } from './ids.ts';

/**
 * Read-only subject-scoped explanations. The Personal Economy Agent cannot
 * place, cancel, halt, or settle, and cannot issue Execution Authority.
 */
export class SubjectScopedSunReyExchangeTool {
  private readonly exchange: SunReyExchangeService;

  constructor(exchange: SunReyExchangeService) {
    this.exchange = exchange;
  }

  explainMarket(
    actor: unknown,
    marketId: ExchangeMarketId,
  ): Result<{ readonly snapshot: MarketDataSnapshot; readonly priceLabel: typeof PRICE_LABEL | 'UNAVAILABLE' }, ExchangeFailure> {
    if (!isVerifiedActorContext(actor)) {
      return err({ code: 'ACTOR_CONTEXT_REQUIRED', message: 'agent tool requires a verified ActorContext' });
    }
    const snapshot = this.exchange.marketData(marketId);
    return ok({ snapshot, priceLabel: snapshot.lastPriceLabel });
  }

  explainNoOfficialValuation(): Result<string, ExchangeFailure> {
    return ok(
      `Last trade is labeled ${PRICE_LABEL}. It is not a guaranteed return and not a public ticker.`,
    );
  }

  listMarkets(
    actor: unknown,
  ): Result<{ readonly markets: ReturnType<SunReyExchangeService['productizedInstruments']> }, ExchangeFailure> {
    if (!isVerifiedActorContext(actor)) {
      return err({ code: 'ACTOR_CONTEXT_REQUIRED', message: 'agent tool requires a verified ActorContext' });
    }
    return ok({ markets: this.exchange.productizedInstruments() });
  }

  createOrderProposal(
    actor: unknown,
    input: {
      readonly marketId: string;
      readonly side: 'BUY' | 'SELL';
      readonly quantityScaled: string;
    },
  ): Result<
    {
      readonly kind: 'EXCHANGE_ORDER_PROPOSAL';
      readonly executed: false;
      readonly marketId: string;
      readonly side: 'BUY' | 'SELL';
      readonly quantityScaled: string;
      readonly requiresHumanApproval: true;
    },
    ExchangeFailure
  > {
    if (!isVerifiedActorContext(actor)) {
      return err({ code: 'ACTOR_CONTEXT_REQUIRED', message: 'agent tool requires a verified ActorContext' });
    }
    return ok({
      kind: 'EXCHANGE_ORDER_PROPOSAL',
      executed: false,
      marketId: input.marketId,
      side: input.side,
      quantityScaled: input.quantityScaled,
      requiresHumanApproval: true,
    });
  }

  explainProposal(proposal: { readonly kind: 'EXCHANGE_ORDER_PROPOSAL'; readonly executed: false }): Result<string, ExchangeFailure> {
    return ok(
      `This is a ${proposal.kind}. It is not an order. A human must approve it before Execution Authority can reach the Exchange API.`,
    );
  }

  matchIncoming(): Result<never, ExchangeFailure> {
    return err({ code: 'AGENT_CANNOT_EXECUTE', message: 'the Agent cannot call matching internals' });
  }

  placeDigitalOrder(): Result<never, ExchangeFailure> {
    return err({ code: 'AGENT_CANNOT_EXECUTE', message: 'the Personal Economy Agent cannot place an exchange order' });
  }

  cancelDigitalOrder(): Result<never, ExchangeFailure> {
    return err({ code: 'AGENT_CANNOT_EXECUTE', message: 'the Personal Economy Agent cannot cancel an exchange order' });
  }

  halt(): Result<never, ExchangeFailure> {
    return err({ code: 'AGENT_CANNOT_EXECUTE', message: 'the Personal Economy Agent cannot halt a market' });
  }

  settle(): Result<never, ExchangeFailure> {
    return err({ code: 'AGENT_CANNOT_EXECUTE', message: 'the Personal Economy Agent cannot settle an exchange trade' });
  }
}
