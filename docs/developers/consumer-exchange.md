# Consumer Exchange API

`ExchangeClient` exposes the Chunk 99 consumer surface. Personal
account state requires authenticated authorization. An API session
alone cannot spend.

```ts
client.exchange.getConsumerMarket();
client.exchange.getConsumerPortfolio(participantId);
client.exchange.getConsumerQuote({ participant_id, side, quantity });
client.exchange.previewConsumerTrade({ ... });
client.exchange.submitConsumerTrade({ signed_intent_hex, ... });
client.exchange.cancelConsumerOrder(orderId);
client.exchange.getConsumerOrder(orderId);
client.exchange.getConsumerTradeReceipt(orderId);
client.exchange.createPriceAlert({ ... });
```

Quotes are `INDICATIVE` unless a firm executable quote facility is
separately implemented. Sandbox portfolios are `NON_PRODUCTION`.
Production consumer trading remains gated.
