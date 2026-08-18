# Development wallet runbook

Simulation only. Tickers remain `NOT_ASSIGNED`.

Chunk 100 Human Information mobile events may appear as
privacy-minimized wallet notifications. They never include legal name
or raw personal data.

## Create and transfer

```
sunrey-wallet create alice actor.alice human
sunrey-wallet create bob actor.bob human
sunrey-wallet address alice
sunrey-wallet balance alice
sunrey-wallet build alice bob 25000 2000
sunrey-wallet sign alice alice.key.1
sunrey-wallet submit alice
sunrey-wallet history alice
```

The TypeScript demo (`npm run demo:sunrey-wallet`) runs the required
four-validator transfer, 2-of-3 multi-auth, recovery delay, and
CryptoSuite migration scenarios.

## Keystore

The local development keystore uses scrypt and AES-256-GCM envelope
encryption from `packages/security`. Unlock before signing. Lock when
finished. File mode is `0600` where the platform allows it.

Hardware, HSM, remote, institutional, and PQ signers are ports. They do
not hold local key material in this chunk.

## Watch-only

```
sunrey-wallet watch observer
```

Watch-only can query, build unsigned transactions, and monitor finality.
It cannot sign, rotate, or recover.

## RPC (read only)

`/wallet/account/{id}`, `/wallet/nonce/{id}`, `/wallet/holdings/{id}`,
`/wallet/locks/{id}`, `/wallet/fee-estimate`, `/wallet/tx/{id}`,
`/wallet/finality`, `/wallet/crypto-policy`.

Private keys are never exposed over RPC.
