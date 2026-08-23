# Phase I Prompt 5 — Regulatory readiness, external assurance, and production gates

Canonical owner: `packages/sunrey-chain` at
`src/production-handoff/production-gates`.

This prompt extends the existing production-handoff owner and composes
Chunk 160 external-evidence references. It does **not** create
`packages/production-gates`, `packages/legal-engine`,
`packages/external-audit`, `packages/readiness-v2`,
`packages/licensing`, or a second Kernel / ledger / Evidence Vault.

This prompt does **not** grant licenses or legal approvals.

`CORE_CODE_COMPLETE_CANDIDATE=true`
`BACKEND_SOFTWARE_READY=true`
`EXTERNAL_GATES_MISSING=true`
`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`
`production_authorized=false`
`RELEASE_DECISION=BLOCKED`

Do not begin Prompt 6 from this document.

## External Input Registry

Machine-readable source of truth:

- TypeScript catalog: `packages/sunrey-chain/src/production-handoff/production-gates/catalog.ts`
- Evaluated snapshot: `docs/productization/sunrey-external-input-registry.json`

Every input carries `gateId`, `category`, `description`, `requiredFor`,
`jurisdiction`, `status`, `evidenceReference`, `ownerRole`,
`expiration`, `lastValidated`, and `notes`.

Statuses are a lifecycle, not a boolean:

`MISSING` | `IN_PROGRESS` | `PRESENT_UNVERIFIED` | `VERIFIED` | `EXPIRED` | `NOT_APPLICABLE`

## Fail-closed evaluation

`evaluateProductionGates` derives:

`BLOCKED` | `CONDITIONAL` | `READY_FOR_LIMITED_LIVE` | `READY_FOR_PRODUCTION`

Missing, expired, or unverified required evidence blocks. Internal
tests cannot satisfy `EXTERNAL_AUDIT` gates. Labels such as
`EXTERNAL_PENTEST_COMPLETE` stay false unless external evidence is
explicitly registered and human-verified.

Ordinary developers, AI, S3M, Grok, automation, and the Agent cannot
override missing required gates. Human `GOVERNANCE_ADMIN` /
`HUMAN_GOVERNANCE` may record a hashed, expiring exception only for
explicitly eligible gates. Security audits, HSM, economic parameters,
and mainnet activation are never exceptionable.

Regulatory gates for unknown jurisdictions are
`COUNSEL_REVIEW_REQUIRED`. This package does not mark
`CONFIRMED_BY_COUNSEL`.

## Internal readiness API

Confidential legal/regulatory status is **not** on the Consumer BFF.

- `GET /internal/v1/production-gates`
- `GET /internal/v1/production-gates/decision`
- `GET /internal/v1/production-gates/report`

Requires `x-sunrey-operator-role` in
`GOVERNANCE_OPERATOR | GOVERNANCE_ADMIN | HUMAN_GOVERNANCE` and
`x-sunrey-internal-token`. Lovable / consumer / agent clients are
refused. Public `/ready` remains process-health only.

## Generated reports

- `docs/productization/SUNREY_PRODUCTION_GATE_REPORT.md`
- `docs/productization/SUNREY_EXTERNAL_ASSURANCE_HANDOFF.md`
- `docs/productization/SUNREY_LAUNCH_CEREMONY_CHECKLIST.md`

The launch ceremony checklist is prepared and **not executed**.

## CLI

```
sunrey-ops production gates evaluate
sunrey-ops production gates report
sunrey-ops production gates write
sunrey-ops production gates ceremony
sunrey-ops production gates assurance
```

## Authority boundaries

- Ledger remains the fiat / application journal.
- Kernel remains policy/regulatory control.
- Execution Authority remains the only mutation permit.
- SunRey Chain remains protocol-native state.
- AI proposes; it does not authorize or override gates.
- Providers adapt; they are not the system of record.
- Frontends display and submit; they do not keep books.

`SAFE_TO_PROCEED_TO_PHASE_I_PROMPT_6` is an engineering handoff label
only after this framework is in tree with production still disabled.
