# SUNREY FINAL PRODUCTIZATION MATRIX

Phase I Prompt 6. Classifications are independent. A capability can be
`PRODUCTIZED_INTERNAL` and still require every external column.

`PRODUCTION_READY=false` for every row.

| Capability | PRODUCTIZED_INTERNAL | SANDBOX_FUNCTIONAL | PREPRODUCTION_DEPLOYABLE | REAL_PROVIDER_REQUIRED | EXTERNAL_CERTIFICATION_REQUIRED | REGULATORY_APPROVAL_REQUIRED | HUMAN_GOVERNANCE_REQUIRED | EXTERNAL_SECURITY_REVIEW_REQUIRED | READY_FOR_LOVABLE |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Money / Ledger / accounts | yes | yes | yes | no for sandbox | no | yes for live deposit-taking | yes | yes | yes |
| Payments | yes | yes | yes | yes | yes | yes | yes | yes | yes |
| FX | yes | yes | yes | yes | yes | yes | yes | yes | yes |
| Cards | yes | yes | yes | yes | yes | yes | yes | yes | yes |
| Treasury / settlement / reconciliation | yes | yes | yes | yes for live rails | yes | yes | yes | yes | n/a (ops) |
| Provider Runtime | yes | yes | yes | yes | yes | no (filter only) | yes | yes | n/a |
| Grow My Money | yes | yes | yes | yes for live brokerage | yes | yes | yes | yes | yes |
| Financial Agent | yes | yes | yes | yes for live model/runtime | yes | yes | yes | yes | yes |
| Exchange | yes | yes | yes | yes | yes | yes | yes | yes | yes |
| SunRey Chain / testnet | yes | yes | yes | validator operators | protocol audit | yes for mainnet | yes | yes | explorer only |
| SunRey Coin | yes | yes | yes | custody + market data | yes | yes | yes | yes | yes |
| MoonRey Coin | yes | yes | yes | oracles + custody | yes | yes | yes | yes | yes |
| Wallets / custody | yes | yes | yes | yes | yes | yes | yes | yes | yes |
| Personal Data Vault | yes | yes | yes | optional connectors | privacy cert | yes | yes | yes | yes |
| HIN | yes | yes | yes | licensee network | yes | yes | yes | yes | yes |
| Productive economy data | yes | yes | yes | licensed feeds | yes | yes | yes | yes | yes |
| Operations control plane | yes | yes | yes | paging/on-call vendor | no | no | yes (staffing) | yes | n/a |
| Security architecture | yes | yes | yes | production HSM/KMS | pentest + audit | no | yes | yes | n/a |
| Deployment architecture | yes | testnet artifacts | yes | production infra / DNS | supply-chain audit | no | yes | yes | n/a |
| Onboarding / Login / Home / Profile / Security | yes | yes | yes | KYC vendor for live | yes | yes | yes | yes | yes |
| Notifications / Support | yes | pending-actions + request_id | yes | comms/support vendors | no | no | yes (desk) | yes | yes |

Legend:

- **PRODUCTIZED_INTERNAL** — canonical owner exists; no second architecture required
- **SANDBOX_FUNCTIONAL** — customer journey works with simulation/sandbox adapters
- **PREPRODUCTION_DEPLOYABLE** — software and runbooks can be rehearsed; this VM did not host a cluster
- **REAL_PROVIDER_REQUIRED** — live capability needs a selected vendor
- **EXTERNAL_CERTIFICATION_REQUIRED** — vendor or protocol certification not in-repo
- **REGULATORY_APPROVAL_REQUIRED** — counsel/license still required
- **HUMAN_GOVERNANCE_REQUIRED** — signatures, staffing, or methodology approval
- **EXTERNAL_SECURITY_REVIEW_REQUIRED** — third-party review not present
- **READY_FOR_LOVABLE** — public API + SDK + screen mapping exist
