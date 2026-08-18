# Chunk 79 — SunRey production governance operations

This is the human-controlled operational system for packaging, reviewing,
authorizing, and verifying future SunRey protocol and economic policy
changes. Canonical protocol governance remains Chunk 40
(`UpgradePlan` / `UpgradeManager`). Installing a newer binary does not
activate a policy.

## What this is not

- Not a governance token
- Not token-weighted public governance
- Not AI voting or AI activation
- Not a competing consensus-level governance engine
- Not an authority that can rewrite finalized history

## Domains

Operational packages may cover `PROTOCOL_UPGRADE`, `MONETARY_POLICY`,
`FEE_POLICY`, `VALIDATOR_ECONOMICS`, `MOONREY_POLICY`, `TREASURY_POLICY`,
`ORACLE_POLICY`, `CRYPTO_POLICY`, `VALIDATOR_SET`, `INTEROP_POLICY`, and
`OTHER_GOVERNED_PROTOCOL_ACTION`.

## Approval architecture

Human approvals reuse the Chunk 64 / Chunk 65 authority model:

- `PROTOCOL_AUTHORITY`
- `SECURITY_AUTHORITY`
- `OPERATIONS_AUTHORITY`
- `RELEASE_AUTHORITY`
- `ECONOMIC_POLICY_AUTHORITY`
- `VALIDATOR_GOVERNANCE_AUTHORITY`
- `OBSERVER`
- `AI_ANALYST` (draft and analyze only)

High-impact actions require configured multi-person authorization. One
operator credential cannot hold universal protocol or economic authority.
Approvals bind actor, role, exact package hash, network, chain, policy
version, activation height, and signature.

AI may draft proposal text, analyze simulations, compare policy versions,
summarize risk, and recommend activation timing. AI cannot vote, sign a
human approval, activate policy, change emergency authority, or declare
legal approval.

## Activation

Consensus activation remains height- or epoch-deterministic. Wall-clock
UI scheduling may prepare operations. A subsequent policy version may
supersede an undesirable policy; historical finalized state remains
authoritative.

Owner: `packages/sunrey-chain/src/governance-ops`.
