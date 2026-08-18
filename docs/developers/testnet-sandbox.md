# Testnet and sandbox

## Environments

`LOCAL`, `TESTNET`, `SANDBOX`, `PRODUCTION`

Production credentials require developer/application approval. Approval
does not turn on production financial capabilities.

## Testnet faucet

Integrates the existing Chunk 53 Testnet faucet
(`packages/sunrey-chain` `TestnetFaucet`).

- Assets remain `SUNREY_COIN` / `MOONREY_COIN` on designated test networks
- Developer quota and anti-abuse limits apply
- Production network IDs and unknown assets are rejected

```
sunrey-dev testnet faucet --key <id> --secret <sk> --address <srdev1...>
```

## Sandbox accounts

`sunrey-dev sandbox create` builds deterministic non-production fixtures:

- wallet
- SunRey Coin account
- MoonRey Coin account
- machine identity
- Exchange fixture
- oracle fixture

The identity class is `SANDBOX`. It cannot be promoted to production.

## Local stack

`npm run sunrey:dev` and `sunrey-dev local devnet` start the existing
public gateway plus mock oracle, Exchange, and webhook receiver. This
is not a second chain implementation.

## Status

`sunrey-dev status` reports network, chain, faucet, RPC, and Explorer
availability. `ENVIRONMENT` remains `simulation`.
