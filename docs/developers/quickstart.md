# SunRey developer quickstart

Executable path: `npm run demo:sunrey-sdk` or
`node --experimental-strip-types packages/sunrey-sdk/src/quickstart.ts`.

1. Install the SDK (`npm install` in this repository).
2. Connect to the development network (`connectSunRey(rpcUrl)`).
3. Create a development wallet (`createDevelopmentWallet`). Keys stay local.
4. Request development SunRey units (`client.faucet`).
5. Query holdings (`client.assets.holdings`).
6. Build a transfer (`client.buildTransfer`).
7. Estimate the fee (`client.fees.estimate`).
8. Sign locally (`client.signLocally` with an injected signer).
9. Submit the signed envelope (`client.submitTransaction`).
10. Subscribe for finality (`client.events.replay`).
11. Query the receipt (`client.transaction`).

One-command developer environment:

```
npm run sunrey:dev
```

That process prints RPC, event, faucet, and Exchange URLs.
