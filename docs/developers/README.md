# SunRey developer documentation

Official interface to SunRey, SunRey Blockchain, SunRey Coin, MoonRey
Coin, and SunRey Exchange. Public tickers remain `NOT_ASSIGNED`.

- [Quickstart](./quickstart.md)
- [API versioning](./api-versioning.md)
- [TypeScript SDK](./typescript-sdk.md)
- [Rust SDK](./rust-sdk.md)
- [Events](./events.md)
- [API reference](./api-reference.md)

Install the workspace SDK:

```
npm install
```

Then connect with `@solstice/sunrey-sdk`. Do not import
`packages/sunrey-chain` or `packages/sunrey-exchange` from application
code.
