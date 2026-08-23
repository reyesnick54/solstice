# SunRey system-wide threat model

Engineering consolidation of financial, identity, provider, Agent,
Exchange, chain, privacy, and supply-chain threats.

Machine-readable source:
`packages/security/src/productization/threat-model.ts`

This is **not** an external threat-model workshop sign-off and **not**
an audit report. Every record sets `externalAuditComplete=false`.

---

## Catalog

| ID | Actor | Primary mitigations | Residual |
| --- | --- | --- | --- |
| FINANCIAL_FRAUD | External or compromised customer | Kernel, Execution Authority, idempotency, corridor filter | Live rails and counsel-confirmed corridors absent |
| ACCOUNT_TAKEOVER | Credential / session thief | Short-lived tokens, refresh reuse, step-up, no body `userId` | Stolen access token until expiry |
| PROVIDER_COMPROMISE | Vendor | SecretReference, environment isolation, webhook guard | Fixture adapters only |
| INSIDER_THREAT | Operator / developer | Named admin, step-up, break-glass records, no superuser | Break-glass is still powerful |
| AGENT_ABUSE | Injection / malicious tool | ProposalGate, no EA, redaction, cross-user deny | ALLOW is not execution |
| EXCHANGE_MANIPULATION | Trader / API key | Eligibility, surveillance, ledger ports | Live matching unauthorized |
| WALLET_THEFT | Key extractor / RPC | Non-exportable HSM contract, purpose split, RPC≠HSM | Production HSM absent |
| VALIDATOR_COMPROMISE | Operator / network | Ceremony, purpose matrix, mainnet off, signer zone | Simulation HSM is not a launch key |
| ORACLE_MANIPULATION | Data provider | Taxonomy, fail-closed transport, facts do not mint | Licensed live data absent |
| PERSONAL_DATA_DISCLOSURE | Reader / insider | Envelope encryption, subject bind, redaction | Not a privacy-audit opinion |
| SUPPLY_CHAIN_COMPROMISE | Dependency / CI | Lockfiles, pinned Actions, SBOM, secret scan | Some image digests unpopulated |
| DDOS | Unauthenticated flood | Rate limits, endpoint classes, default-deny | Edge WAF is external |

---

## Related models (do not replace)

- `docs/productization/SUNREY_AGENT_THREAT_MODEL.md`
- `docs/security/sunrey-blockchain-threat-model.md`
- `docs/information/privacy-threat-model.md`

## Status

Independent threat-model validation remains an external gate.
