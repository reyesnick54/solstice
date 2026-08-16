# Chunk 45 — SunRey machine economic identity and commerce

Implemented on latest `main` after Chunk 40. Native asset locks,
protocol fees, oracle facts, and productive-contribution verification
are consumed through typed ports so this chunk does not reimplement
those later planes or create a second exchange.

Canonical owner remains `packages/sunrey-chain`.

- TypeScript engine: `packages/sunrey-chain/src/machine-economy/`
- CLI: `sunrey-node machine …`
- Demos: compute (four-validator state roots) and energy

Do not create `packages/machine-economy`, `packages/machine-identity`,
or `packages/moonrey-coin`.

## Core principle

A machine is not a wallet with unlimited authority. Every
`MachineEconomicIdentity` resolves to owner, controller, optional
operator, capabilities, resource limits, financial limits, purpose,
jurisdiction, cryptographic identity, and revocation state.

Machine types refine the canonical `ActorType` set. They do not
create a parallel actor system.

## What machines may do

Inside a controller-granted bounded mandate, a machine may buy or
sell verified resources and services: compute, energy, storage,
bandwidth, goods, logistics, and generic services.

Capabilities are explicit. There is no implicit universal commerce
permission.

## What machines must not do

Machines cannot:

- become validators or vote in validator consensus
- vote in protocol governance
- issue Execution Authority
- change CryptoSuite policy
- modify oracle registry authority
- change MoonRey issuance policy
- issue MoonRey directly

A machine transaction never automatically issues MoonRey. Delivery
facts may become eligible for later productive-contribution
verification.

## Settlement

Deterministic path:

escrow + verified delivery + contract terms → payment

Unused locked quantity releases. Partial delivery pays the verified
portion with exact integer arithmetic. Oracle conflict prevents
ordinary settlement. High-value settlement requires finalized oracle
facts unless policy explicitly permits self-report.

AI cannot resolve its own financial dispute with binding authority.
Disputes preserve locked assets.

## Keys

Machine keys use purpose `MACHINE_SIGNING` and remain separate from
validator consensus, governance, Execution Authority, human wallet
recovery, oracle provider, and P2P validator keys. CryptoSuite
lifecycle supports classical → hybrid → PQ rotation.

## Matching

Matching is direct bilateral or routed through an adapter port toward
SunRey Exchange / a future capacity market. This chunk does not
create a second exchange.

## Development posture

Simulation only. Public tickers remain `NOT_ASSIGNED`. MoonRey
issuance remains unavailable. Production network activation is out
of scope.
