# Chunk 65 — SunRey mainnet readiness and genesis-candidate controls

This chunk implements the engineering control plane required before any
future production activation. It does **not** launch mainnet, enable
`LIVE_*` services, publish production genesis, migrate customer funds,
open Exchange trading, or enable custody withdrawals.

Owner: `packages/sunrey-chain/src/mainnet`.
Capability: `sunrey-mainnet-readiness`.

## What exists

- `MainnetReadinessRegistry` and a 25-dimension evidence catalog
  including infrastructure readiness
- Per-capability activation matrix (chain vs financial products)
- Production network **candidate** identity
- Deterministic genesis candidate builder (`sunrey-genesis candidate`)
- Validator, allocation, crypto-policy, and ceremony bindings
- Human authorization workflow that rejects AI signatures
- External legal/regulatory/security-review slots that stay incomplete
  unless real evidence is supplied
- Separate Exchange, custody, oracle, interop, and privacy checklists
- Activation-plan generation that does not execute infrastructure
- Readiness CLI: `sunrey-mainnet`

## What this is not

- Not a production network launch
- Not legal, regulatory, or licensing approval
- Not an independent security audit
- Not a claim that testnet success authorizes mainnet
- Not a licensed exchange or custody business
- Not production HSM post-quantum capability

Chunks 61–64 are implemented on this tree. Engineering artifacts are
linked by exact digest (formal report, audit preparation bundle, RC
qualification, root-of-trust rehearsal transcript, SBOM, provenance).
Independent auditor, commercial HSM, counsel, regulator, license, and
partner slots remain `NOT_PROVIDED` or
`EXTERNAL_VERIFICATION_REQUIRED`. Simulation rehearsal of a Chunk 64
ceremony is process-readiness evidence only.
