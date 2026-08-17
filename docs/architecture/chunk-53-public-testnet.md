# Chunk 53 — SunRey public testnet genesis and deployment package

Implemented on latest `main` after Chunks 46–50 (SDK/Explorer packages
from later chunks are not required as competing owners). Canonical
owner remains `packages/sunrey-chain`.

- TypeScript package: `packages/sunrey-chain/src/testnet/`
- CLI: `sunrey-genesis` / `sunrey-testnet verify`
- Deployment: `deploy/sunrey-testnet/`
- Docs: `docs/testnet/`

Do not create `packages/sunrey-testnet`, `packages/sunrey-faucet`,
or a second chain. This is not mainnet. Tickers remain `NOT_ASSIGNED`.
`ENVIRONMENT` stays `simulation`. `LIVE_*` flags stay false.

## Identity

| Field | Value |
| --- | --- |
| Display name | SunRey Testnet 1 |
| Network ID | `net_sunrey_testnet_1` |
| Chain ID | `chn_sunrey_testnet_1` |
| Address HRP | `srtst` (Chunk 46 reserved test class) |
| SDK name | `SUNREY_TESTNET_1` |
| Validators | 7, equal voting power, no public staking |

Local development IDs are not reused.

## What this chunk implements

- Deterministic genesis builder (`sunrey-genesis`)
- Ceremony of public descriptors only
- Seven-validator CI fixture with `NOT_FOR_PRODUCTION` keys
- Native `SUNREY_COIN` / `MOONREY_COIN` testnet assets
- Dedicated faucet with limits, cooldown, and abuse hooks
- Seed, public RPC, and validator private-network profiles
- Explorer banner `SUNREY TESTNET` (not production circulation)
- SDK named network with configurable URLs
- Container images, Helm/Kubernetes, kind local cluster
- Release manifest, CycloneDX SBOM, Ed25519 signing port
- Reset versioning (`testnet-1` → `testnet-2`)
- Governed upgrade and 5-of-7 fault tests
- Full local E2E: wallets, faucet, transfer, Explorer, events, MoonRey attribution
