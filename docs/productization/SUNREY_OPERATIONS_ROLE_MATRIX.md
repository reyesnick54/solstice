# SunRey operations role matrix

Staff privilege is explicit. There is no `SUPER_ADMIN`.
`PLATFORM_ADMIN` is not a union of all roles.

`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`

Companion: `PHASE_I_01_OPERATIONS_CONTROL_PLANE.md`.

## Roles and primary capabilities

| Role | Primary capability | Typical use | Cannot |
| --- | --- | --- | --- |
| `CUSTOMER_SUPPORT` | `ADMIN_SUPPORT` | Support profile, support cases | Restrict accounts, custody signing, ledger mutation, sensitive KYC without `ADMIN_SUPPORT_SENSITIVE` |
| `COMPLIANCE_ANALYST` | `ADMIN_COMPLIANCE` | Investigate KYC/AML/sanctions cases | Approve own escalated decision |
| `COMPLIANCE_MANAGER` | `ADMIN_COMPLIANCE_APPROVE` | Dual-control clearance | Hold customer Execution Authority |
| `FRAUD_ANALYST` | `ADMIN_FRAUD` | Fraud cases, account restriction (dual control) | Ledger posting |
| `PAYMENTS_OPERATOR` | `ADMIN_PAYMENTS` | Payment exceptions, unknown provider status | Edit Ledger balances |
| `TREASURY_OPERATOR` | `ADMIN_TREASURY` | Provider balances, liquidity (ops view) | Treat provider balance as customer ledger |
| `RECONCILIATION_OPERATOR` | `ADMIN_RECONCILIATION` | Breaks, suspense, daily close | Silent overwrite of accounting state |
| `EXCHANGE_SURVEILLANCE` | `ADMIN_EXCHANGE_SURVEILLANCE` | Alerts, market halt (dual control) | Declare legal guilt |
| `CUSTODY_OPERATOR` | `ADMIN_CUSTODY` | Wallet / deposit / withdrawal / Travel Rule views | Private keys, `CUSTODY_OPERATE_REQUEST` |
| `SECURITY_OPERATOR` | `ADMIN_SECURITY` | Security events, second control on halts | Raw secrets |
| `SRE_OPERATOR` | `ADMIN_SRE` | Provider health, kill switch (dual control) | Production activation |
| `AUDITOR` | `ADMIN_AUDIT` | Read-only cases, notes, support history | Any mutation except notes |
| `PLATFORM_ADMIN` | `ADMIN_PLATFORM` | Staff platform configuration | Case approval, market halt, ledger, production |

Legacy aliases: `SUPPORT` → `CUSTOMER_SUPPORT`, `COMPLIANCE_REVIEWER` →
`COMPLIANCE_ANALYST`, `SECURITY_ADMINISTRATOR` → `SECURITY_OPERATOR`.

## Segregation of duties

| Rule | Enforcement |
| --- | --- |
| Investigator cannot approve their own escalated decision | `SELF_APPROVAL_FORBIDDEN` |
| Dual control for restrict/release account, disable provider, halt market, pause Agent, approve escalated case | `DUAL_CONTROL_REQUIRED` |
| Provider configurator cannot authorize production | `PRODUCTION_ACTIVATION_FORBIDDEN` |
| Support cannot hold custody signing or ledger mutators | `SUPPORT_CANNOT_SIGN` / `LEDGER_MUTATION_FORBIDDEN` |
| Agent / platform operator cannot hold ledger mutators | `AGENT_CANNOT_MUTATE_LEDGER` |
| Privileged mutations require step-up | `STEP_UP_REQUIRED` |

## Case domains

`KYC`, `KYB`, `AML`, `SANCTIONS`, `FRAUD`, `PAYMENT`, `TREASURY`,
`RECONCILIATION`, `EXCHANGE_SURVEILLANCE`, `CUSTODY`, `TRAVEL_RULE`,
`AGENT`, `SECURITY`, `DATA_RIGHTS`, `PROVIDER`, `CUSTOMER_SUPPORT`.

Conceptual states: `OPEN`, `QUEUED`, `IN_REVIEW`, `ACTION_REQUIRED`,
`AWAITING_CUSTOMER`, `AWAITING_PROVIDER`, `AWAITING_COMPLIANCE`,
`ESCALATED`, `RESOLVED`, `CLOSED`. Specialized compliance cases keep
`CLEARED` / `BLOCKED` / `ASSIGNED`.

## Privileged operations

`CASE_CREATE`, `CASE_ASSIGN`, `CASE_TRANSITION`, `CASE_NOTE`,
`CASE_ESCALATE`, `CASE_RESOLVE`, `CASE_CLOSE`, `CASE_APPROVE`,
`ACCOUNT_RESTRICT`, `ACCOUNT_RELEASE`, `PROVIDER_DISABLE`,
`MARKET_HALT`, `AGENT_PAUSE`, `BREAK_RECLASSIFY`, `SUPPORT_VIEW_OPEN`,
`SUPPORT_SENSITIVE_VIEW`, `PROVIDER_CONFIGURE`.

Each mutation records operator, reason, evidence, and an operations
event. Support-view sessions are read-limited, audited, time-bounded
(15 minutes), and cannot approve financial actions.

## Internal APIs

Base: `/internal/v1` (`packages/kernel/src/operations/http.ts`)

Health, staff identity, cases (domain-filtered), search (case /
customer / payment / transaction / order / wallet / provider /
correlation IDs only), timeline, payments, treasury, reconciliation,
surveillance, custody, providers, agents, security, privileged
actions, support view, and explicit ledger / Execution Authority /
custody-key refusal routes.

Read surfaces are capability-gated. Support cannot read custody,
treasury, or surveillance. Auditors may read but not write.

Not mounted on the consumer BFF. Not a Lovable client surface.

## Audit

Operator actions seal `OPERATIONS_OPERATOR_ACTION` evidence. Cases,
assignments, approvals, notes, and action records persist in
`operations.*` (`V039`). Restart must not drop the audit trail.
