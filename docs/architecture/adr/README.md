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
| 0006 | Policy Engine Language | PROPOSED (Addendum A: engineering Option C implemented in simulation; not human ACCEPTED) | RESEARCH_REQUIRED — no counsel review; no pack is confirmed | COMPLIANCE / policy engine | none | IMPLEMENTED (engineering / simulation only) | [ADR-0006-policy-engine-language.md](./ADR-0006-policy-engine-language.md) |
| 0007 | Identity and authentication stack (earlier draft) | PROPOSED | not a legal opinion; no counsel review | IDENTITY | none | NOT_IMPLEMENTED | [ADR-0007-identity-stack.md](./ADR-0007-identity-stack.md) |
| 0007 | Identity and Authentication Stack (later revision) | PROPOSED | not a legal opinion; no counsel review | IDENTITY | ADR-0006, ADR-0008 | NOT_IMPLEMENTED | [ADR-0007-identity-and-authentication-stack.md](./ADR-0007-identity-and-authentication-stack.md) |
| 0006 | Policy Engine Language | PROPOSED | RESEARCH_REQUIRED — no counsel review; no pack is confirmed | COMPLIANCE / policy engine | none | NOT_IMPLEMENTED | [ADR-0006-policy-engine-language.md](./ADR-0006-policy-engine-language.md) |
| 0007 | Identity and authentication stack (earlier draft) | PROPOSED | not a legal opinion; no counsel review | IDENTITY | none | PARTIAL | [ADR-0007-identity-stack.md](./ADR-0007-identity-stack.md) |
| 0007 | Identity and Authentication Stack (later revision) | PROPOSED (Addendum A: in-house domain engineered; vendor not selected; not counsel) | not a legal opinion; no counsel review | IDENTITY | ADR-0006, ADR-0008 | PARTIAL | [ADR-0007-identity-and-authentication-stack.md](./ADR-0007-identity-and-authentication-stack.md) |
| 0008 | Persistence Layer for Phase 1 | PROPOSED (Addendum A: engineering-accepted Option A; not counsel) | not a legal opinion | persistence / BANKING / Evidence durability | ADR-0006, ADR-0007 | PARTIAL | [ADR-0008-persistence-layer.md](./ADR-0008-persistence-layer.md) |
| 0009 | Canonical cryptographic infrastructure | ACCEPTED | not a legal opinion; no counsel review | SECURITY | none | IMPLEMENTED | [ADR-0009-cryptographic-infrastructure.md](./ADR-0009-cryptographic-infrastructure.md) |
| 0010 | Canonical compliance screening fabric | PROPOSED | RESEARCH_REQUIRED — simulation only; no counsel review | COMPLIANCE / screening | ADR-0006 | PARTIAL | [ADR-0010-compliance-screening-fabric.md](./ADR-0010-compliance-screening-fabric.md) |
| 0011 | Personal Economic Graph | PROPOSED | not a legal opinion; no counsel review | PERSONAL_ECONOMIC_GRAPH | identity, events, persistence | PARTIAL | [ADR-0011-personal-economic-graph.md](./ADR-0011-personal-economic-graph.md) |
| 0012 | Machine-verifiable mandates and Growth Orchestrator | PROPOSED | not a legal opinion; no counsel review | GROWTH_ORCHESTRATOR / PERSONAL_ECONOMY_AGENT | identity, PEG, events, evidence | PARTIAL | [ADR-0012-mandates-and-growth-orchestrator.md](./ADR-0012-mandates-and-growth-orchestrator.md) |
| 0013 | Regulatory Digital Twin | PROPOSED | RESEARCH_REQUIRED — simulation only; no counsel review | REGULATORY_DIGITAL_TWIN | ADR-0006, identity, events, evidence | IMPLEMENTED (engineering / simulation only) | [ADR-0013-regulatory-digital-twin.md](./ADR-0013-regulatory-digital-twin.md) |
| 0013 | Personal Economic Value Engine | PROPOSED | not a legal opinion; no counsel review | PERSONAL_ECONOMIC_VALUE_ENGINE | identity, PEG, agent, growth, events, evidence | PARTIAL | [ADR-0013-personal-economic-value-engine.md](./ADR-0013-personal-economic-value-engine.md) |
| 0014 | Investment Risk Engine and Model Registry | PROPOSED | RESEARCH_REQUIRED — simulation/engineering limits only; no counsel review | RISK / MODEL_REGISTRY | ADR-0006, investments, kernel, events, evidence | IMPLEMENTED (engineering / simulation only) | [ADR-0014-investment-risk-and-model-registry.md](./ADR-0014-investment-risk-and-model-registry.md) |

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
