# SunRey Data Purpose Registry

Canonical product catalog: `packages/consent/src/product/purposes.ts`.

Ledger purpose versions: `packages/consent/src/purpose-registry.ts`.

This is an engineering catalog. It is not legal advice and does not
claim GDPR, CCPA, or PDPL compliance. Every purpose stays
`RESEARCH_REQUIRED` or `COUNSEL_REVIEW_REQUIRED`. None is
`CONFIRMED_BY_COUNSEL`.

Current terms version: `sunrey.data-terms.v1`.

Materially broader terms do not silently attach to an older grant.
The grant stays bound to its purpose version and terms version, or is
`SUSPENDED` until the customer grants again.

| purposeId | family | necessity | ledger code | shareable | economic compensation | required for basic account |
| --- | --- | --- | --- | --- | --- | --- |
| `core-account-service` | CORE_SERVICE | REQUIRED_FOR_CORE_SERVICE | `CORE_ACCOUNT_SERVICE` | no | no | yes |
| `financial-analysis` | FINANCIAL_ANALYSIS | OPTIONAL | `PERSONAL_BUDGET_ANALYSIS` | no | no | no |
| `agent-assistance` | AGENT_ASSISTANCE | OPTIONAL | `PERSONAL_AGENT_ANALYSIS` | no | no | no |
| `personalization` | PERSONALIZATION | OPTIONAL | `PERSONALIZATION` | no | no | no |
| `analytics` | ANALYTICS | OPTIONAL | `ANALYTICS` | no | no | no |
| `product-improvement` | PRODUCT_IMPROVEMENT | OPTIONAL | `PRODUCT_IMPROVEMENT_RESEARCH` | no | no | no |
| `aggregated-research` | RESEARCH | OPTIONAL | `AGGREGATED_RESEARCH` | no | no | no |
| `data-licensing` | DATA_LICENSING | OPTIONAL_COMPENSATED | `DATA_CONTRIBUTION_RESEARCH` | yes | yes | no |
| `hin-participation` | HIN_PARTICIPATION | OPTIONAL | `HIN_PARTICIPATION` | yes | yes | no |
| `marketing` | MARKETING | OPTIONAL | `MARKETING` | no | no | no |

Permission bundles (UX labels only; storage is granular):

| bundleId | purposeId | categories |
| --- | --- | --- |
| `AGENT_SPENDING_DATA` | `agent-assistance` | TRANSACTION_DATA, PURCHASE_HISTORY |
| `PERSONALIZATION_PREFERENCES` | `personalization` | PREFERENCE_DATA, USER_DECLARED_DATA |
| `HIN_OPTIONAL_PARTICIPATION` | `hin-participation` | TRANSACTION_DATA, PREFERENCE_DATA, DATA_CONTRIBUTION_CANDIDATE |
| `ECONOMIC_DATA_LICENSING` | `data-licensing` | TRANSACTION_DATA, PREFERENCE_DATA |
| `AGGREGATED_RESEARCH` | `aggregated-research` | TRANSACTION_DATA, PREFERENCE_DATA |

Economic-use classes are exclusive:

- `NONE`
- `PERSONALIZATION`
- `AGGREGATED_RESEARCH`
- `ECONOMIC_LICENSING`

Granting personalization never authorizes licensing or aggregated
research.
