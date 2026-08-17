# Testnet faucet

The faucet issues **testnet** SunRey and, where permitted, MoonRey
through canonical blockchain transactions.

It uses the existing development issuance architecture with a distinct
testnet policy (`sunrey.issuance.testnet_faucet.v1`) and actor
`testnet.faucet`.

## Safety

- Credentials are separate from validator and governance keys.
- Authorization is valid only for designated test networks
  (`net_sunrey_testnet_*`).
- The faucet cannot govern or validate.
- Issued units are `TESTNET_DEVELOPMENT_UNITS` with ticker
  `NOT_ASSIGNED`.

## Controls

- per-address limits
- per-IP / client rate limits
- cooldown
- abuse-detection hooks
- request logging
- faucet balance monitoring
- transaction finality tracking
