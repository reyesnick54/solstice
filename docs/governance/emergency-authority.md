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
requires the same class of human authority.
