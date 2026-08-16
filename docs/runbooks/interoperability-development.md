# Interoperability development runbook

Simulation only. Do not connect a live foreign network.

## Register and activate a development chain

1. A governance signer registers `ExternalChainDefinition`.
2. A governance signer activates it to `ACTIVE_DEVELOPMENT`.
3. AI preparers and relayers cannot activate a chain.
4. An endpoint string is not a registration.

## Initialize a light client

Use the simulated ExternalDevChain genesis as the trust anchor.
SunRey nodes verify the genesis hash and validator commitment
independently.

## Header updates

Relayers submit headers. Duplicate submissions of the same verified
header are safe. Invalid finality or a wrong chain ID is rejected.

## Packets

Open a connection (`INIT/TRY/ACK/CONFIRM`) and a typed channel before
sending. Ordered channels require exact sequence. Always check replay
protection.

## CLI

```
sunrey-node interop chains
sunrey-node interop client
sunrey-node interop header
sunrey-node interop connection
sunrey-node interop channel
sunrey-node interop packets
sunrey-node interop proof
sunrey-node interop security
sunrey-relayer run
```

## What not to do

- Do not treat a foreign fact as fiat or MoonRey authority
- Do not wrap USD or any fiat
- Do not enable production SunRey Coin or MoonRey interop
- Do not change `ENVIRONMENT` or any `LIVE_*` flag
