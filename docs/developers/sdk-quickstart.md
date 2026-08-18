# SDK quickstart

Official clients never require sending a private key to SunRey servers.

```
npm install
npm run sunrey:dev
```

TypeScript:

```ts
import {
  connectSunRey,
  createDevelopmentWallet,
  publicRegistration,
  verifyWebhookSignature,
} from '@solstice/sunrey-sdk';
```

Workflow:

1. Create a local development wallet (`createDevelopmentWallet`)
2. Register the public descriptor
3. Request Testnet/sandbox SunRey
4. Build a native transfer
5. Sign locally with the injected signer
6. Submit the already-signed envelope
7. Track `FINALIZED` (BFT finality, not confirmations)
8. Subscribe to `newFinalizedBlock`
9. Verify inbound webhooks with `verifyWebhookSignature`
10. Read SunRey/MoonRey supply and Exchange market data where available

Examples:

- `packages/sunrey-sdk/examples/read-chain.ts`
- `packages/sunrey-sdk/examples/wallet-transfer.ts`
- `packages/sunrey-sdk/examples/subscribe-blocks.ts`
- `packages/sunrey-sdk/examples/verify-webhook.ts`
- `packages/sunrey-sdk/examples/read-supply.ts`
- `packages/sunrey-sdk/examples/read-market-data.ts`
- `packages/sunrey-sdk/examples/developer-platform-sample.ts`

Rust client: `packages/sunrey-chain/rust/crates/sdk`.
