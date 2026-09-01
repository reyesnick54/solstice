# ADR lifecycle vocabulary

This document is the canonical reference for Architecture Decision Record
status in the SunRey / Solstice monorepo.

## Three independent axes

| Axis | Question it answers | Must not imply |
| --- | --- | --- |
| Engineering decision status | Has architecture accepted this design direction? | Legal approval, regulatory approval, production authorization |
| Implementation status | Does code on `main` reflect the decision? | Production activation, counsel confirmation |
| Production activation | May regulated behavior run against real users/money/chains? | That engineering is complete |

## Engineering decision status

| Status | Meaning |
| --- | --- |
| `DRAFT` | Written but not yet submitted for review |
| `PROPOSED` | Submitted; humans have not accepted or rejected |
| `ACCEPTED_FOR_ENGINEERING` | Engineering may implement in simulation/testnet; not product go-live |
| `ACCEPTED` | Human architecture acceptance; still not legal/regulatory approval |
| `SUPERSEDED` | Replaced by a later record; do not implement further |
| `REJECTED` | Do not implement |
| `DEPRECATED` | Was accepted; now retired |

Agents must not change `PROPOSED` to `ACCEPTED` or `ACCEPTED_FOR_ENGINEERING`
without human review.

## Legal / regulatory confidence

Used when an ADR discusses a legal or regulatory position.

| Status | Meaning |
| --- | --- |
| `NOT_APPLICABLE` | Pure engineering decision |
| `DRAFT` | Position drafted; not reviewed |
| `RESEARCH_REQUIRED` | More research needed; no production claim |
| `COUNSEL_REVIEWED` | Counsel has reviewed; not necessarily approved |
| `CONFIRMED_BY_COUNSEL` | Counsel confirmed — **none in this repository** |

Agents must not mark any position `CONFIRMED_BY_COUNSEL`.

## Implementation status

| Status | Meaning |
| --- | --- |
| `NOT_IMPLEMENTED` | No runtime on `main` |
| `PARTIAL` | Subset implemented |
| `IMPLEMENTED` | Engineering artifacts on `main` (may be simulation-only) |

## Production activation

| Status | Meaning |
| --- | --- |
| `NOT_ALLOWED` | No production path; ADR unresolved or rejected |
| `ENGINEERING_ONLY` | Simulation/dev/test only |
| `REGULATORY_GATED` | Code may exist; live regulated behavior blocked |
| `EXTERNAL_APPROVAL_REQUIRED` | Provider, license, or specialist review required |

Runtime enforcement lives in `packages/config/src/activation-gates.ts`.
Every `LIVE_*` flag in `packages/config/src/flags.ts` defaults `false`.

## External approval states (tests and gates)

Use these labels in tests and gate messages. They do not claim real approval.

- `UNVERIFIED`
- `NOT_APPROVED`
- `EXTERNAL_APPROVAL_REQUIRED`
- `RESEARCH_REQUIRED`

## Confirmation criteria

An ADR is *implemented* only when its stated engineering confirmation
criteria exist on `main`.

An ADR is *production-active* only when **all** of the following hold:

1. Engineering status is `ACCEPTED` (not merely `ACCEPTED_FOR_ENGINEERING`).
2. Required legal/regulatory/provider approvals are recorded outside this
   repository by authorized humans.
3. Explicit activation markers pass `assertProductionActivationSafe()`.
4. Relevant `LIVE_*` flags are deliberately enabled through an authorized
   launch process — not by test fixtures implying approval.

Until then, regulated features remain fail-closed.
