# Blockchain account authorization

A `BlockchainAccount` is cryptographic account-control state on SunRey
Blockchain. It is not confiscation authority and not a fiat account.

## Policies

| Policy | Threshold rule |
| --- | --- |
| `SINGLE_SIGNATURE` | exactly one authorized key |
| `M_OF_N` | integer `M` of `N` authorized keys |
| `ROLE_BASED` | role bindings plus integer threshold |
| `OWNER_PLUS_RECOVERY` | owner key, or recovery credentials after delay |
| `INSTITUTIONAL_POLICY` | institutional signer set |
| `MACHINE_MANDATE` | machine identity + spending/resource mandates |

## Multi-authorization

A transaction binds account, body hash, required policy, signer key IDs,
signatures, and CryptoSuites. Duplicate signers are rejected. Keys not
in the policy are rejected. Insufficient `M` is rejected.

## Account status

`ACTIVE`, `RECOVERY_PENDING`, `SECURITY_RESTRICTED`,
`KEY_ROTATION_PENDING`, `REVOKED`.

`SECURITY_RESTRICTED` requires an explicit owner authorization policy.
It is not an arbitrary freeze.

## Delegated keys

A delegated key never inherits unrestricted master authority. Limits may
include transaction type, asset, maximum amount, maximum total, expiration
height, counterparty, purpose, and fee ceiling.

## CryptoSuite

New signatures must use an approved suite. Downgrades are rejected.
Historical signatures remain verifiable after rotation.
