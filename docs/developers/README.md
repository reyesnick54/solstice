# SunRey developer documentation

Official interface to SunRey, SunRey Blockchain, SunRey Coin, MoonRey
Coin, and SunRey Exchange. Public tickers remain `NOT_ASSIGNED`.

- [Quickstart](./quickstart.md)
- [SDK quickstart](./sdk-quickstart.md)
- [API versioning](./api-versioning.md)
- [API authentication](./api-authentication.md)
- [Webhooks](./webhooks.md)
- [Testnet and sandbox](./testnet-sandbox.md)
- [Chunk 94 developer platform](./chunk-94-developer-platform.md)
- [TypeScript SDK](./typescript-sdk.md)
- [Rust SDK](./rust-sdk.md)
- [Events](./events.md)
- [API reference](./api-reference.md)
- [Human Information Network](../information/chunk-100-human-information-network.md)
- [Requester API](../information/requester-api.md)
- [Consumer Exchange API](./consumer-exchange.md)

Install the workspace SDK:

```
npm install
```

Then connect with `@solstice/sunrey-sdk`. Do not import
`packages/sunrey-chain` or `packages/sunrey-exchange` from application
code.
