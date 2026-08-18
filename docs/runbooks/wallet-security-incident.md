# Wallet security incident runbook

Simulation / rehearsal only. Do not enable `LIVE_*` flags or change
`ENVIRONMENT` away from `simulation`.

## Immediate actions

1. Identify the wallet and custody class. Do not convert the class.
2. Revoke the affected device (`sunrey-wallet devices <wallet> revoke <device>`).
3. Revoke sessions (`sunrey-wallet sessions <wallet> revoke-device <device>` or `revoke-all`).
4. Review delegated keys and agent mandates (`sunrey-wallet delegations <wallet>`).
5. If signing authority may be compromised, start recovery or key rotation.
   Recovery does not reverse finalized transfers.
6. For institutional custody wallets, use the canonical custody approval
   and destination controls. Do not invent a second custody path.
7. Seal evidence. Notify through the Chunk 97 privacy-safe hook payload
   only — no device secrets, session tokens, or recovery challenges.

## Public Explorer

Do not publish device, session, or recovery information. Public Explorer
may show only chain-authoritative key changes where protocol policy
makes them public.
