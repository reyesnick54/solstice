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
- `ExchangeClient`
- `EventClient`
- `MonetaryClient` (read-only policy, supply, genesis, issuance receipt, burns; no mint)

The signer is injected. There is no process-wide private-key singleton.
Account policies include single-key, M-of-N, policy, institutional,
machine, and delegated session keys. Transaction models carry
CryptoSuite IDs.
