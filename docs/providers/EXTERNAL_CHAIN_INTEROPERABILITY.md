# External Chain Interoperability (Wave 3)

SunRey Wave 3 adds **read-only external chain intelligence** on top of Wave 1
provider infrastructure. SunRey Blockchain remains the native authoritative
chain for SunRey Coin and MoonRey Coin.

## Canonical owner

`packages/sunrey-chain/src/blockchain-intelligence/`

Services:

| Service | Role |
| --- | --- |
| `CryptoMarketReferenceService` | CoinGecko fixture market quotes |
| `ExternalChainIntelligenceService` | Bitcoin / network intelligence (Mempool.space) |
| `ExternalChainRpcService` | Ethereum / Solana JSON-RPC read aggregation |
| `BlockchainIntelligenceService` | Aggregator for BFF, Exchange metadata, Agent evidence |

## Observable external networks

| Network | Family | RPC | Explorer | Market reference |
| --- | --- | --- | --- | --- |
| `ethereum-mainnet` | EVM | Yes | Yes | Yes |
| `bitcoin-mainnet` | Bitcoin | No | Yes (indexer) | Yes |
| `solana-mainnet` | Solana | Yes | No | No |

SunRey native chain (`sunrey-native`) is registered for capability comparison but
is **not** exposed through external-chain BFF routes.

## Provider catalog (Wave 3 partial population)

15 providers in `config/providers/free-api-catalog.yaml`:

| Provider | Status | Role |
| --- | --- | --- |
| coingecko | Simulated | Crypto market reference (primary) |
| coinmarketcap | Blocked | Legal review pending |
| mempool-space | Simulated | Bitcoin network / fees |
| cloudflare-eth-rpc | Simulated | Ethereum RPC primary |
| infura-ethereum | Simulated | Ethereum RPC secondary |
| alchemy-ethereum | Simulated | Ethereum RPC fallback |
| etherscan | Simulated | Explorer / indexer |
| blockscout | Simulated | Explorer secondary |
| solana-public-rpc | Simulated | Solana RPC |
| chainlink-feeds | Simulated | Oracle reference (read-only) |
| the-graph | Simulated | Indexing secondary |
| covalent | Simulated | Indexing secondary |
| ethplorer | Simulated | Token metadata |
| bitquery | Blocked | Commercial terms unclear |
| blockchain-info | Deprecated | Use mempool-space |

## Security controls

- **No** `sendRawTransaction`, signing, deployment, or generic public RPC proxy.
- Chain ID validation with mismatch → provider unhealthy / security failure.
- Contract `eth_call` targets allowlisted in `limits.ts` only.
- Query limits: block range, hex length, response size, rate limits, cache TTL.
- Provider endpoints from catalog configuration only — no user-supplied RPC URLs.
- Simulation only — no live network calls in this prompt.

## BFF routes (read-only)

- `GET /api/v1/blockchain/networks`
- `GET /api/v1/blockchain/networks/:network`
- `GET /api/v1/blockchain/networks/:network/status`
- `GET /api/v1/blockchain/networks/:network/fees`
- `GET /api/v1/blockchain/transactions/:network/:hash`
- `GET /api/v1/blockchain/market-quotes`

## Explicit non-goals (Wave 3)

- No external-chain transaction signing.
- No bridge, wrap, mint, or burn of SunRey Coin / MoonRey Coin on external chains.
- No external custody or deposit/withdraw enablement from RPC presence.
- External oracle values are **not** SunRey consensus or issuance inputs.

## SunRey native boundary

External observations flow: Provider fixture → normalization envelope → cache →
`BlockchainIntelligenceService` → BFF / Exchange metadata / Financial Agent evidence.

Native chain execution, consensus, and issuance remain in `packages/sunrey-chain`
outside this module.
