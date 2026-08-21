# Bounded emergency authority

`EmergencyAuthorityPolicy` permits only a closed catalog:

- `RESTRICT_NEW_MOONREY_ISSUANCE`
- `RESTRICT_TREASURY_DISBURSEMENTS`
- `RESTRICT_NEW_EXCHANGE_ORDERS`
- `RESTRICT_EXCHANGE_SETTLEMENT`
- `RESTRICT_CUSTODY_WITHDRAWALS`
- `SUSPEND_ORACLE_PROVIDER`
- `RESTRICT_INTEROP_CHANNEL`
- `RESTRICT_SPECIFIC_PROTOCOL_FEATURE`
- `RESTRICT_NEW_SUNREY_ISSUANCE`
- `RESTRICT_PAYMENT_SUBMISSIONS`
- `RESTRICT_BANKING_RAILS`
- `RESTRICT_HUMAN_INFORMATION_MARKET`
- `SUSPEND_PROVIDER_DOMAIN`

Chunk 167 added the last five classes. They only narrow future activity.
They do not mint, confiscate, rewrite supply, or rewrite finalized
history. Restrictions remain domain-scoped. Provider suspension suspends
a route, not the canonical domain owner.

Where a canonical kill switch already exists (oracle suspension, Exchange
controls, custody withdrawal halt, treasury halt), emergency operations
reuse that switch. They do not invent a second mint or confiscation path.

Emergency authority cannot mint native assets, rewrite supply, confiscate
arbitrary customer wallets, rewrite finalized blocks, forge oracle facts,
erase evidence, alter historical policy, unilaterally create legal
approval, or convert a testnet into mainnet.

High-impact emergency actions require the configured security/human
approval set. AI cannot approve. Temporary restrictions have an explicit
review or expiry height. Silent restoration is refused; resumption
requires the same class of human authority. Restriction expiry enters
`EXPIRED_AWAITING_AUTHORITY` and does not auto-resume a capability.
See [chunk-167-launch-abort-recovery.md](../operations/chunk-167-launch-abort-recovery.md).
