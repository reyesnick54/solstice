# ADR index

Engineering decision status and regulatory/legal confidence are
different axes. Do not collapse them.

**Engineering decision status:** `PROPOSED` · `ACCEPTED` · `SUPERSEDED`
· `REJECTED`

**Regulatory / legal confidence** (when a record discusses a legal or
regulatory position): `DRAFT` · `RESEARCH_REQUIRED` ·
`COUNSEL_REVIEWED` · `CONFIRMED_BY_COUNSEL`

No record in this repository is `CONFIRMED_BY_COUNSEL`. Agents must not
mark any legal or regulatory position `CONFIRMED_BY_COUNSEL`.

ADR-0001 through ADR-0005 are not in this repository. Existing numbers
are not reused or silently changed.

| Number | Title | Engineering status | Legal / regulatory confidence | Affected subsystem | Depends on | Implementation status | Link |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0006 | Policy Engine Language | PROPOSED | RESEARCH_REQUIRED — no counsel review; no pack is confirmed | COMPLIANCE / policy engine | none | NOT_IMPLEMENTED | [ADR-0006-policy-engine-language.md](./ADR-0006-policy-engine-language.md) |
| 0007 | Identity and authentication stack (earlier draft) | PROPOSED | not a legal opinion; no counsel review | IDENTITY | none | NOT_IMPLEMENTED | [ADR-0007-identity-stack.md](./ADR-0007-identity-stack.md) |
| 0007 | Identity and Authentication Stack (later revision) | PROPOSED | not a legal opinion; no counsel review | IDENTITY | ADR-0006, ADR-0008 | NOT_IMPLEMENTED | [ADR-0007-identity-and-authentication-stack.md](./ADR-0007-identity-and-authentication-stack.md) |
| 0008 | Persistence Layer for Phase 1 | PROPOSED | not a legal opinion | persistence / BANKING / Evidence durability | ADR-0006, ADR-0007 | NOT_IMPLEMENTED | [ADR-0008-persistence-layer.md](./ADR-0008-persistence-layer.md) |

## Notes on ADR-0007

Two files share number 0007. They are not two different decisions and
they are not renumbered.

- `ADR-0007-identity-stack.md` was written against an empty application
  tree.
- `ADR-0007-identity-and-authentication-stack.md` revises the same
  slot so the Context cites the Customer domain. Other ADRs link to
  this later filename.

Both remain `PROPOSED`. Neither authorizes an identity provider, SDK,
or vendor contract.

## What "implementation status" means here

- **NOT_IMPLEMENTED** — the decision, if later accepted, has no
  corresponding runtime on `main`.
- **PARTIAL** — reserved for later use when a proposed ADR has a
  subset of its consequences on `main`.
- **IMPLEMENTED** — reserved for later use when an **ACCEPTED** ADR
  has its stated confirmation criteria on `main`.

PROPOSED is not ACCEPTED. Agents must not change these statuses.
