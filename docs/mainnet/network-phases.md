# Network phases

Post-genesis operations use governed phases rather than a single
all-or-nothing production switch.

| Phase | Meaning |
| --- | --- |
| `CHAIN_STABILIZATION` | Chain-only safe mode. Consensus, validators, monitoring, and backups operate. High-risk financial capabilities remain independently disabled. |
| `NATIVE_ASSET_LIMITED` | Native-asset conservation and fee-market observation. Productive MoonRey issuance remains explicitly disabled until its own package exists. |
| `ORACLE_LIMITED` | Oracle technical health may be measured. Production feeds still require provider, commercial, governance, and human evidence. |
| `ECONOMIC_SERVICES_LIMITED` | Economic audits pass. Treasury spending still requires configured policy and governance authorization. Genesis does not authorize spending. |
| `REGULATED_SERVICES_ELIGIBLE` | Regulated services may become eligible only through independent capability packages. |
| `FULL_CONFIGURED_OPERATIONS` | Configured operations remain independently gated and restriction-bound. |

Public Explorer and status APIs distinguish:

- `ENGINEERING_HEALTH`
- `PRODUCTION_CAPABILITY_STATUS`
- `REGULATED_SERVICE_STATUS`

SunRey Chain may be healthy while regulated Exchange remains
unavailable. That split is represented accurately.
