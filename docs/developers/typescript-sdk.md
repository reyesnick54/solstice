# TypeScript SDK

Package: `@solstice/sunrey-sdk`

```ts
import { connectSunRey, createDevelopmentWallet } from '@solstice/sunrey-sdk';
```

Modules:

- `SunReyClient`
- `WalletClient`
- `AssetClient`
- `FeeClient`
- `ValidatorClient`
- `GovernanceClient`
- `OracleClient`
- `ProductiveClient`
- `MachineClient`
- `InteropClient`
- `ExchangeClient` (includes consumer portfolio, quote, preview, trade, cancel, receipt, and price-alert methods)
- `EventClient`
- `MonetaryClient` (read-only policy, supply, genesis, issuance receipt, burns; no mint)
- `InformationClient` (Human Information rights, consent, usage, compensation, and clean-room APIs; a developer API key is not sufficient by itself)
- Mobile sync helpers: `connectMobileWallet`, `syncWallet`, `subscribeWallet`, `trackFinality`, `createPaymentRequest`, `parsePaymentRequest`, `getPendingTransactions`, `getSecurityEvents`

The signer is injected. There is no process-wide private-key singleton.
Account policies include single-key, M-of-N, policy, institutional,
machine, and delegated session keys. Transaction models carry
CryptoSuite IDs.
