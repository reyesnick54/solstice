# ADR-0006: Policy Engine Language

- **Status:** PROPOSED (Addendum A: engineering architecture implemented in simulation; not counsel acceptance)
- **Date:** 2026-08-13
- **Deciders:** Founders and architecture review. A human must accept or reject this record. This document is not an accepted decision.
- **Consulted:** None on file. No counsel review of this ADR has happened.
- **Informed:** Engineering, compliance, and any service that will call the Policy Engine.
- **Supersedes:** none. This file revises the earlier draft of ADR-0006 on `main` so the Context cites the repository as it actually is after the Customer domain landed. The recommended option is unchanged.

---

## Context

Solstice is meant to keep regulatory logic out of application services. The intended design is:

1. Rules live in versioned **Jurisdiction Packs** (United States, European Union, Saudi Arabia, United Arab Emirates, United Kingdom). A Jurisdiction Pack is a dated, named file of country rules — not a paragraph in a product service.
2. Packs are **default-deny**: if a pack does not clearly allow an action, the engine refuses it.
3. Packs are **restrict-only**: a pack may tighten what Solstice will do in that country. It may not invent a new permission that a safer default would have refused.
4. Every rule carries a **legal review state** (`legalReviewState`): `CONFIRMED_BY_COUNSEL`, `DRAFT`, or `RESEARCH_REQUIRED`. Those three labels are the vocabulary this platform already named. This ADR does not assign any of them to any rule.
5. A central **Policy Engine** is the only component that evaluates packs. A Policy Engine is the program that answers "may we do this, in this country, for this customer, right now?" Later services (on the order of a dozen) will call that engine. They must not embed country rules themselves.

That is the intended design. It is not what the repository contains today.

### What exists in the repository today

This ADR was written against git commit `de3c633` on `main` (merge of the Customer domain). Tracked application files:

| Path | What it actually is |
| --- | --- |
| [`README.md`](../../../README.md) | One-line title `# solstice`. |
| [`packages/domain/src/jurisdiction.ts`](../../../packages/domain/src/jurisdiction.ts) | Branded ISO 3166-1 alpha-2 country codes (`Jurisdiction`, `Residency`). Not a pack. Not an evaluator. |
| [`packages/domain/src/customer.ts`](../../../packages/domain/src/customer.ts) | In-memory Customer record that *carries* a jurisdiction and a residency. Status transitions do not consult a pack. |
| [`packages/domain/src/legal-entity.ts`](../../../packages/domain/src/legal-entity.ts) | Branded `LegalEntityId`. No country rules. |
| [`docs/architecture/adr/ADR-0008-persistence-layer.md`](./ADR-0008-persistence-layer.md) | Proposed persistence decision. Does not define a policy language. |

Searches that returned no files and no matches:

| What was searched | Result |
| --- | --- |
| Policy engine source (`*policy*`, `evaluate`, `default-deny`) | None |
| Jurisdiction pack files (`*pack*`, `*.rego`, US/EU/SA/AE/GB rule files) | None |
| `legalReviewState` anywhere in the tree | No matches |
| OPA, Rego, Cedar | No matches, no dependency |
| ADR-0001 through ADR-0005 | Not in the repository |

There is no TypeScript evaluator to "keep." There is no OPA or Rego installation to extend. There is no pack for US, EU, Saudi Arabia, UAE, or UK. The domain package is TypeScript, so the temptation to write the first country `if` next to `customer.ts` is now real.

### How the evaluator works today

It does not. There is no evaluator process, no function, and no interface. No service can ask "may we do this in this country?" and get an answer from this codebase.

What exists instead is a **country code on the customer**. `asJurisdiction` and `asResidency` in `packages/domain/src/jurisdiction.ts` (lines 11–23) only check that a string looks like two uppercase letters:

```11:23:packages/domain/src/jurisdiction.ts
export function asJurisdiction(countryCode: string): Jurisdiction {
  if (!ISO_3166_ALPHA_2.test(countryCode)) {
    throw new TypeError(`Invalid jurisdiction country code: ${countryCode}`);
  }
  return brandAs<string, 'Jurisdiction'>(countryCode);
}
```

`US`, `GB`, and `IE` in tests are labels. They do not load rules. They do not default-deny. A later service that writes `if (customer.jurisdiction === 'US')` would be embedding regulatory logic in application code — the failure this ADR exists to prevent.

### How packs are structured today

They are not. The five named jurisdictions exist only as an intention, not as files. There is no pack version field, no rule list, and no default-deny document to load. `Customer.jurisdiction` (`packages/domain/src/customer.ts` lines 46–55) is a field on a person record, not a pack reference.

### How `legalReviewState` is declared and enforced today

It is not declared. The three allowed values (`CONFIRMED_BY_COUNSEL`, `DRAFT`, `RESEARCH_REQUIRED`) do not appear anywhere in the repository. Nothing can refuse a `DRAFT` or `RESEARCH_REQUIRED` rule in production, because nothing loads rules.

This ADR does not assign a legal review state to any rule. It does not claim that any country rule is confirmed, draft, or in research. Those labels are for counsel. This record only decides how rules will be written and evaluated once packs exist.

### Why this decision is blocking

If each future service invents its own way to encode a country rule, Solstice will have regulatory logic scattered through the product. The engine's language is the contract those services will depend on. Changing it later means touching every caller. The Customer domain already stores a jurisdiction; the next merge can accidentally become the first unofficial pack. That is why this decision comes before implementation.

**Question this record answers:** Should Solstice express Jurisdiction Packs and evaluate them with a typed TypeScript engine, with OPA/Rego, or with a third approach?

---

## Option A — Typed TypeScript evaluator (rules as TypeScript)

Build (there is nothing to "keep") a Policy Engine in TypeScript. Country rules would be TypeScript types and functions in versioned modules. Callers pass a structured question; the engine returns allow or deny plus reasons.

OPA is not involved. The same language as `packages/domain` would own both the engine and the packs.

### Pros

- Types catch many mistakes before a pack is deployed: a missing field, a wrong country code, a rule that returns the wrong shape. **Type safety** here means the compiler refuses a rule that does not match the agreed shape, before it ever runs.
- Engineers can debug with ordinary breakpoints, stack traces, and unit tests. No second language. The existing test runner in `packages/domain/package.json` (`node --test`) would work.
- No extra running process. If the service is up, the engine is up. That avoids a class of "policy server is down, so we either halt the bank or skip the check" failures.
- `legalReviewState` can be a required field on the TypeScript type. The compiler can refuse a rule that omits it.
- From today's tree this is a new package and a new interface, not a rewrite of working evaluation code. The Customer domain would call it; it would not have to be rewritten.

### Cons

- TypeScript is a programming language. A compliance officer or outside counsel cannot be expected to author or confidently review it.
- "Restrict-only" and "default-deny" become conventions in code. A well-meaning engineer can write a function that *permits* something the default would have blocked. The type system will not stop that unless the packs are data, not programs.
- Rules-as-code tempts later services to import a helper "just this once" instead of calling the engine. `packages/domain` already exports `Jurisdiction`. The next `if (jurisdiction === 'SA')` is one pull request away.
- Pack versioning gets tangled with application versioning. Shipping a US pack change looks like shipping a product release.
- Solstice would be maintaining a policy language of its own, even if it pretends the language is "just TypeScript."

---

## Option B — Adopt OPA / Rego

[Open Policy Agent (OPA)](https://www.openpolicyagent.org/) is a widely used policy engine. Packs would be written in **Rego**, OPA's policy language. Application services would send facts to OPA (or to an OPA library) and receive a decision.

This is the usual industry move when teams want policy outside application code.

### Pros

- Policy is physically separate from product code. That matches "no regulatory logic in application services."
- OPA can emit a decision log: what was asked, which policy version answered, and what the answer was. That is useful after the fact.
- Independent pack deploys are a documented OPA pattern (policy **bundles** — packaged sets of policy files). A country pack could move on a different cadence than a feature release, if the operating process is disciplined.
- A large ecosystem, books, and hiring market exist around OPA. Solstice would not be inventing a policy runtime.
- Default-deny can be expressed in Rego if every pack is written that way and reviews catch exceptions.

### Cons

- Rego is another programming language. It is harder for most engineers than TypeScript. It is not a language counsel can author or reliably read.
- Type safety is weaker than TypeScript. Many mistakes show up only when a decision is evaluated, not when a pack is compiled, unless Solstice invests in extra tests and linters.
- Debugging Rego is famously painful: traces, partial evaluation, and "why did this rule not fire?" sessions. Explainability to a customer or a regulator suffers unless Solstice builds a translation layer on top.
- OPA is an operational dependency: a sidecar, a daemon, or a library with its own release clock. If OPA is unavailable and Solstice fails closed, customers cannot transact. If it fails open, Solstice may break the law. Neither is acceptable; the first is the only honest choice, and it couples bank availability to a third-party policy process.
- **Bundle-version drift** is a real regulatory failure mode: service A evaluates US pack 3, service B still has US pack 2, and the Evidence Vault cannot explain why two customers got different answers. OPA bundles make this easy to cause and hard to notice. There is no crash signal when a service quietly keeps an old bundle.
- OPA has no native `legalReviewState`. Solstice would still build a wrapper that refuses `DRAFT` and `RESEARCH_REQUIRED` in production. The "standard tool" does not give Solstice that control for free.
- From today's tree this is not a migration. It is a decision to stand up a second runtime, a pack pipeline, and a new language before the first pack exists, next to a TypeScript domain that already compiles with zero extra tools.

---

## Option C — Declarative packs (data) plus a small typed TypeScript engine

Keep the Policy Engine as a small TypeScript program, but **do not write rules as TypeScript functions**. Each Jurisdiction Pack is a versioned data file (JSON or YAML) that must match a published schema.

The schema, not engineer discipline, enforces the important properties:

- Default deny: the engine starts at deny. A pack may only add named restrictions and named, counsel-confirmed exceptions that the schema allows.
- Restrict-only: the schema has no field that means "permit something the platform default forbids." Packs can lower limits, forbid products, require extra checks, and name data-residency constraints. They cannot grant a new power.
- `legalReviewState` is a required field on every rule. The production loader refuses the whole pack if any rule is `DRAFT` or `RESEARCH_REQUIRED`. This ADR does not decide which future rules will be confirmed; it only decides that unconfirmed rules cannot go live.

Callers still see one function: given this customer, this country, this intended action, return allow or deny with the pack version, the rule identifiers, and a plain-language reason.

This is not OPA. It is also not "rules as TypeScript." It is the option that treats a Jurisdiction Pack as a legal artifact that happens to be machine-readable.

A related industry tool, AWS Cedar, was considered and set aside. Cedar is a strong default-deny language for "who may do what to which resource." Solstice's packs are country restrictions on products, limits, and duties. Cedar would add a second language without fitting that shape.

### Pros

- Counsel and a compliance officer can read a pack as a structured list: country, rule id, what is forbidden or capped, review state, pack version. They cannot be expected to write the schema, but they can review the contents.
- Restrict-only and default-deny can be true by construction, not by hope.
- TypeScript still checks the engine and the schema. Pack files that do not match the schema never load. That reuses the toolchain already in `packages/domain`.
- Debugging is ordinary: print the pack version, the rule that fired, and the input. No Rego trace.
- No extra process. No OPA bundle clock. The running service and the pack version it loaded are one deploy artifact, which is the simplest way to prevent silent drift.
- Later services depend on a stable question/answer interface, not on Rego or on ad-hoc TypeScript helpers. `Customer.jurisdiction` becomes an *input* to the engine, not a place to hide rules.
- If Solstice ever outgrows data-only packs, JSON can be *compiled* into Rego. Starting in Rego and later extracting data is much harder. Option C keeps that door open without walking through it.

### Cons

- A data schema cannot express every hypothetical future rule. If Solstice later needs open-ended logic ("allow if this formula over market data is true"), the schema must grow, or Solstice must reopen this ADR.
- Someone still has to write and maintain the evaluator. It is small, but it is Solstice's code, not a vendor's.
- Compliance officers still should not *author* packs unattended. They can read and comment. An engineer still types the file. That is honest; Options A and B do not actually give counsel a safe authoring environment either.
- JSON/YAML is verbose. Without a simple review UI, a large pack is tedious to read. The UI is extra work. It is still easier than asking counsel to learn Rego.

---

## Evaluation against Solstice priorities

Priorities are listed in the order Solstice stated. Earlier rows outrank later ones. "Best" means best among these three options, not perfect.

| Priority | Option A (TypeScript rules) | Option B (OPA / Rego) | Option C (data packs + small engine) |
| --- | --- | --- | --- |
| **Asset safety** | Weak. A function can accidentally permit a movement of money. Types help shape, not intent. | Mixed. OPA can fail closed, but a Rego bug or a drifted bundle can permit or halt incorrectly. | **Best.** Default deny and restrict-only can be schema rules. The engine has a small surface. |
| **Regulatory control** | Weak. Review state can be typed, but packs are code. Counsel cannot truly own them. | Mixed. Separation of policy is real; Rego opacity and missing native review state are not. | **Best.** Packs are reviewable artifacts. Unconfirmed rules can be refused at load. |
| **Data privacy** | Neutral. Country data-residency rules can be encoded, but only as more TypeScript. | Neutral. Same, in Rego, with more operating parts that may see decision inputs. | **Better.** Residency and purpose limits are data. The engine need not send pack evaluation to a sidecar. |
| **Accounting correctness** | Neutral. The engine should not do accounting. Risk is leaking exceptions into posting paths. | Worse. A second runtime in the posting path is another way for "denied" and "posted" to disagree. | **Better.** One in-process decision, recorded, then the ledger. Fewer moving parts. |
| **Security** | Mixed. No extra daemon. Rules-as-code is a larger attack and mistake surface. | Worse. Extra process, extra language, extra supply chain (OPA releases). | **Better.** Small engine, no sidecar, packs are data so they can be signed and hashed. |
| **Operational resilience** | **Better.** In-process. | Worst. OPA down = fail closed = outage, or a temptation to fail open. | **Best among honest choices.** In-process, pack pinned to the deploy. |
| **Explainability** | Mixed. Stack traces are for engineers, not customers or regulators. | Weak. Rego traces are not a customer explanation. | **Best.** Named rule, pack version, plain-language reason. |
| **Customer experience** | Neutral. Fast enough. Wrong denies/allows hurt trust. | Worse if OPA latency or outages appear. | **Better** if denies are explainable and packs do not drift. |
| **Performance** | **Good.** In-process typed code. | Usually good; another hop and a larger engine. | **Good.** In-process, often faster than OPA for small packs. |
| **Feature velocity** | Fast for engineers who know TypeScript; slow when counsel cannot review. Made *more* tempting now that `packages/domain` is TypeScript. | Slowest to start: new language, new ops, new CI. | Fast enough: schema plus files. Slower than "just write a function," which is the point. |

Feature velocity is last on purpose. A slower, reviewable pack format is the correct trade against the earlier priorities.

---

## Cross-cutting analysis

### Type safety

- **A:** Strong for shapes. Weak for "this rule must only restrict."
- **B:** Weak unless Solstice adds its own tests and wrappers.
- **C:** Strong for shapes (schema + TypeScript engine). Stronger than A for intent, because illegal pack constructs cannot be expressed.

### Debuggability

- **A:** Ordinary engineering tools. Hard for non-engineers.
- **B:** Poor. Rego debugging is a specialist skill.
- **C:** Ordinary engineering tools plus a readable pack file. Best shared picture for engineer and counsel.

### Could a non-engineer author or read rules?

- **Author:** None of the three is safe for unattended authoring by counsel. Anyone who claims otherwise is selling a myth.
- **Read:** C is the only option where a compliance officer can sit with a pack and check rule ids, limits, and `legalReviewState` without learning a programming language. A is unreadable to them. B is worse.

### Testability

- **A:** Easy unit tests, but every pack is code, so tests tend to follow implementation, not legal intent. The existing `packages/domain` test style (tables of legal vs illegal transitions in `customer.test.ts`) would work, but would test *functions*, not legal artifacts.
- **B:** `opa test` exists. Fixtures are extra work. Subtle rule interaction is hard to cover.
- **C:** Easiest to test as tables: given this pack version and this question, expect deny with rule `X`. Packs can be tested without executing product services.

### Auditability of a decision after the fact

What a later investigator needs: the question, the pack version, the rule ids that fired, the review state of those rules at the time, and the answer. **Auditability** here means a past decision can be reconstructed and explained, not merely that a log line exists.

- **A:** Possible if Solstice remembers to log it. Easy to forget, because the "policy" is just a function call.
- **B:** OPA decision logs help, *if* bundle version is in the log and *if* every service uses the same bundle. Drift breaks the story. A stale bundle typically does **not** crash the service.
- **C:** Natural: hash the pack file, store pack version + rule ids + input hash + output on every decision. That matches an Evidence Vault when one exists (it does not yet; see ADR-0008).

### Deployment of new packs

- **A:** A code release. Counsel review is a pull request of TypeScript.
- **B:** A bundle publish, plus whatever pins each service to a bundle. Independent deploys are possible and dangerous.
- **C:** A versioned pack file in the same release as the engine, or a signed pack artifact the engine verifies. Independent hot-reload is possible but should be refused until counsel has confirmed the pack. Prefer pack and engine to move together until Solstice has an Evidence Vault and a pin.

### Bundle-version drift risk

- **A:** Drift looks like different service versions. Still real, but it shows up in ordinary deploy diffs.
- **B:** Highest. Bundles, sidecars, caches, and partial rollouts can silently disagree. **No crash signal** is the failure mode that matters: the bank keeps answering, with the wrong law.
- **C:** Lowest if the pack hash is part of the service build, and the process **refuses to start** if the loaded hash is not the pinned hash. Becomes like B if Solstice later hot-loads packs without pinning.

### Operational dependency added

- **A:** None beyond the application runtime (already Node 22 for `packages/domain`).
- **B:** OPA (or `opa` as a library) plus bundle storage plus a fail-closed story. This is the large new dependency.
- **C:** None beyond the application runtime. Schema files are data, not a service.

---

## Migration cost, given the code that exists today

There is still no Policy Engine, no pack, and no caller of an evaluate interface. Migration cost is "what must be created," not "what must be rewritten." No running customer traffic is at risk from this choice.

What *has* changed since the first draft of this ADR: `packages/domain` now stores `jurisdiction` and `residency` on `Customer`. That is an input shape, not an engine. The migration risk is social, not technical: engineers will reach for TypeScript `if` statements because that is the language already in the tree.

### Option A

- New Policy Engine module and public interface.
- TypeScript modules for five jurisdictions.
- Load-time (or type-level) `legalReviewState` checks.
- Tests and a decision log format.
- Discipline so `packages/domain` does not grow country branches.
- **Invasiveness:** medium. The hidden cost is unbounded: every future rule is more TypeScript, and later services will be tempted to import it. That temptation is higher now than when the tree was empty.
- **Dependencies:** none beyond the TypeScript toolchain already used by `@solstice/domain`.
- **Risk:** choosing A now makes Option C painful later, because functions do not turn back into data cleanly.

### Option B

- Everything in A that is still needed as a wrapper (interface, review-state gate, audit record).
- Plus OPA in CI, in production, and in local development.
- Plus Rego packs, bundle publishing, version pinning, and fail-closed behavior when OPA is missing.
- **Invasiveness:** high. Solstice would take on a second language and a second runtime before the first rule exists, beside a TypeScript domain that does not need it.
- **Dependencies:** OPA releases, bundle storage, and whoever understands Rego at 2 a.m.
- **Risk:** bundle drift; availability coupled to OPA; counsel cannot read the source of truth.

### Option C

- JSON/YAML schema for a Jurisdiction Pack (version, jurisdiction, rules, `legalReviewState` on every rule).
- Small TypeScript loader and evaluator that default-denies and refuses non-confirmed rules in production.
- Five pack files that start empty of permissions (deny everything until counsel-confirmed restrictions and exceptions are added). This ADR does not fill those files with legal content.
- Decision record: pack hash, rule ids, input, output.
- A hard rule: `packages/domain` and every later service may pass `Customer.jurisdiction` *into* the engine; they may not switch on it themselves.
- **Invasiveness:** lowest that still matches Solstice's rules. The engine is small. The packs are data. Later services depend only on the evaluate interface.
- **Dependencies:** none beyond the TypeScript toolchain already present.
- **Risk:** the schema will need careful design so it cannot express grants. That is a design risk, not an operating risk.

---

## Recommendation

**Propose Option C:** versioned, schema-validated Jurisdiction Packs as data, evaluated by a small in-process typed TypeScript Policy Engine.

Option A is the wrong default even though the prompt described a "hand-rolled typed TypeScript evaluator." That evaluator is not in the repository. Building it as *rules-as-TypeScript* would make counsel a spectator and would make restrict-only a hope. The new Customer domain makes Option A *more* dangerous, not less: the first country `if` will look consistent with `customer.ts`. Option B would buy a real policy ecosystem at the price of a language nobody in compliance can read, an extra runtime Solstice does not have staff to operate, and bundle-version drift that can become a regulatory incident with no crash. Option C is the only option that makes default-deny, restrict-only, and `legalReviewState` properties of the pack format, which is what Solstice claimed it wanted.

This remains **PROPOSED**. Engineering must not treat packs as confirmed by counsel. Humans accept or reject this ADR. If accepted, freeze the evaluate interface next, then the pack schema, then empty default-deny packs — in that order — before any product service embeds a country rule.

---

## Consequences if accepted

- Application services may not contain country-specific regulatory branches. They ask the Policy Engine. `Customer.jurisdiction` and `Customer.residency` are inputs, not policy.
- Packs are data files that match the schema. They are not TypeScript modules and not Rego.
- Production loads only packs whose every rule is `CONFIRMED_BY_COUNSEL`. `DRAFT` and `RESEARCH_REQUIRED` may exist in non-production fixtures only. A missing or unpinned pack hash is a **startup failure**, not a warning.
- Every decision stores pack version (and hash), rule identifiers, and the answer, so an investigator can replay what happened.
- OPA/Rego is not introduced. Revisit this ADR only if a schema cannot express a counsel-required rule after a genuine attempt to extend the schema.

## Consequences if rejected

- If humans choose A, write the engine in TypeScript and immediately ban other packages from importing pack modules. Expect counsel review to be slow and shallow.
- If humans choose B, budget for OPA operations, Rego skill, fail-closed outages, and a bundle pin that is as strict as a code pin. Still wrap `legalReviewState` outside OPA. Treat a stale bundle as a crash, not a log line.

---

## Confirmation

This ADR is confirmed as *written* when this file exists at `docs/architecture/adr/ADR-0006-policy-engine-language.md` with **Status: PROPOSED**.

This ADR is confirmed as *accepted* only when a human changes the status. Agents must not do that.

This ADR is confirmed as *implemented* only when all of the following exist: a pack schema, a default-deny evaluator, a production gate on `legalReviewState`, a decision record that includes pack hash, a startup refusal on hash mismatch, and no country rules in application services. Addendum A records the engineering implementation of those artifacts in simulation. That is not counsel review and is not `CONFIRMED_BY_COUNSEL`.

---

## Addendum A — Engineering implementation (simulation)

**Date:** 2026-08-14

**Engineering disposition:** Option C is implemented inside the existing Compliance Kernel at `packages/kernel/src/policy/`. This addendum does **not** change the ADR to ACCEPTED. A human still accepts or rejects the record. It does **not** mark any legal rule `CONFIRMED_BY_COUNSEL`.

What exists after Chunk 6:

- Versioned JSON jurisdiction packs for US, GB, EU, SA, and AE. They are engineering shells and safe simulation rules.
- A typed in-process evaluator (`PolicyEngine`) that default-denies, is restrict-only for unconfirmed grants, and is deterministic for the same facts + version.
- Legal-confidence field `legalReviewStatus` on every rule and version (`DRAFT`, `RESEARCH_REQUIRED`, `COUNSEL_REVIEWED`, `CONFIRMED_BY_COUNSEL`). The loader refuses `CONFIRMED_BY_COUNSEL` because this repository has no documented counsel confirmation.
- Simulation-only legal-entity capabilities. Live capabilities exist as explicit disabled records. Solstice does not claim licenses.
- Policy snapshots (pack id, version, content hash, facts hash, evaluated rule ids, reason codes) sealed on every Kernel decision.
- Manual-review cases that an AI/agent cannot approve. HARD_BLOCK cannot be overridden.
- PostgreSQL persistence of packs, versions, rules, sources, capabilities, and review cases.

What this does **not** mean:

- Solstice is not legally approved in any jurisdiction.
- Unconfirmed rules are not legal fact.
- Production/live evaluation remains fail-closed (`ENVIRONMENT=simulation`, every `LIVE_*` flag false).

---

## Inspection notes (for the record)

- Repository: `github.com/reyesnick54/solstice`
- Commit inspected: `de3c633` (`main`)
- Files read: `README.md`; `packages/domain/package.json`; `packages/domain/tsconfig.json`; `packages/domain/src/index.ts`; `packages/domain/src/brand.ts`; `packages/domain/src/result.ts`; `packages/domain/src/time.ts`; `packages/domain/src/jurisdiction.ts`; `packages/domain/src/legal-entity.ts`; `packages/domain/src/customer.ts`; `packages/domain/src/customer.test.ts`; `packages/domain/src/demo.ts`; `docs/architecture/adr/ADR-0006-policy-engine-language.md` (previous draft); `docs/architecture/adr/ADR-0008-persistence-layer.md`
- Existing ADRs read: ADR-0006 (this slot, previous inspection claimed an empty tree); ADR-0008 (persistence, PROPOSED). ADR-0007 was not on `main`.
- Policy engine files read: none (none exist)
- Jurisdiction pack files read: none (none exist). `jurisdiction.ts` is a country-code brand, not a pack.
- `legalReviewState`: not declared, not enforced, not assigned
- Tests run: `npm test` in `packages/domain` (existing suite). No new tests added. No OPA, Rego, or other policy dependency was installed. No engine, pack, or `legalReviewState` value was modified.
