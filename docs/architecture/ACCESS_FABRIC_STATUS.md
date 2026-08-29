# ACCESS-13 — SunRey Human Access Economy status report

Chunk: ACCESS-13, post-automation economic simulation, end-to-end
qualification, and architecture closure.
Classification: engineering simulation.

## Engineering state

| State | Value | Who may set it |
| --- | --- | --- |
| `ACCESS_FABRIC_CODE_COMPLETE_CANDIDATE` | true, as of this chunk | Engineering, from a passing qualification run |
| `PRODUCTION_READY` | false | Humans plus external gates. Not derived from tests. |
| `LIVE_CONNECTIVITY_ENABLED` | false | Humans plus signed provider contracts. Not derived from tests. |
| `PRODUCTION_ACTIVE` | false | Governance authorization ceremony. Not derived from tests. |

`ACCESS_FABRIC_CODE_COMPLETE_CANDIDATE` is a statement about this
repository: the Access Economy has an owner, a scenario catalog, permanent
invariants, deterministic behaviour, sealed evidence, and CI coverage. It is
not a statement that the Access Economy may serve a real person, connect to
a real provider, or move real value. A passing test run does not and must
not move any of the three production states above.

`ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains `false`.
No provider, bank, payment processor, or market data source is contacted.

## Prerequisite state on `main` at the time of writing

This is recorded because it affects how this chunk should be read.

- ACCESS-04 (`packages/access-fabric`, the canonical access entitlement
  engine) exists on branch `cursor/access-entitlement-engine-c6e6` and is
  open as a pull request. It is **not** merged into `main`.
- ACCESS-01 through ACCESS-03 and ACCESS-05 through ACCESS-12 have no
  branch, pull request, or code in this repository.
- ACCESS-13 is therefore stacked on the ACCESS-04 branch rather than
  branched from `main`, and it repairs two ACCESS-04 defects that were
  failing CI: `packages/access-fabric` was never registered in
  `docs/architecture/manifest.json` (architecture linter failure), and it
  carried seven TypeScript errors (repository typecheck failure).
- The qualification in this chunk covers the Access Economy capabilities
  that exist: entitlement eligibility, capacity allocation, refusal
  semantics, evidence, and the permanent invariants. It does not qualify
  chunks that were never written.

## Files and packages added

### New: `packages/sunrey-economics/src/access-economy/`

Owned by `packages/sunrey-economics`, the canonical economic simulation
laboratory. No second economics engine was created.

| File | Purpose |
| --- | --- |
| `ids.ts` | Schema and tool versions, 15 scenario ids, 16 invariant ids, decision outcomes, shock kinds, canonical integration map, forbidden asset and sensitive-key deny lists |
| `types.ts` | Capacity pools, capacity ledger rows, requests, decisions, policy changes, scenario, scenario result, qualification report |
| `branding.ts` | Deterministic branded fixture ids that reuse the canonical `packages/access-fabric` prefixes |
| `capacity.ts` | Derives capacity buckets from `DualEconomySimulationReport.productive.output`; generates the seeded request population |
| `allocation.ts` | Deterministic quote, reserve, confirm, hold, and refuse; integer-unit capacity accounting |
| `evidence.ts` | Seals scenario transitions into the canonical `packages/evidence` hash chain behind a frozen clock; refuses forbidden sensitive keys |
| `invariants.ts` | The 16 permanent invariants and their statements |
| `catalog.ts` | The 15 Access Economy scenarios, each pinned to a dual-economy macro scenario |
| `engine.ts` | Runs one scenario; computes per-group scarcity, outcome counts, fixture and result digests |
| `qualification.ts` | End-to-end qualification across all 15 scenarios; remaining dependencies, provider requirements, and legal gates |
| `cli.ts` | `access scenario`, `access run`, `access invariants`, `access qualify` |
| `demo.ts` | `npm run demo:sunrey-access-economy` |
| `index.ts` | Public surface |
| `access-economy.test.ts` | Package tests |
| `architecture-guards.test.ts` | Structural guards over the module source and the manifest |

### New: dual-economy macro scenarios

| File | Extends |
| --- | --- |
| `packages/sunrey-economics/config/scenarios/post-scarcity-abundance.json` | post-scarcity abundance under rapid automation |
| `packages/sunrey-economics/config/scenarios/human-access-demand-surge.json` | human demand shift concentrated on scarce experiences |
| `packages/sunrey-economics/config/scenarios/productive-capacity-collapse.json` | simultaneous energy, logistics, and manufacturing productivity shock |

### New: cross-package integration test

`tests/access-13-access-economy-qualification.test.ts`

### Modified

| File | Change |
| --- | --- |
| `packages/sunrey-economics/src/ids.ts` | Three new dual-economy scenario ids |
| `packages/sunrey-economics/src/cli.ts` | New `access` CLI plane |
| `packages/sunrey-economics/src/index.ts` | Re-export the Access Economy surface |
| `packages/sunrey-economics/src/stress/ids.ts` | `ACCESS` stress domain, 15 `ACCESS_*` shocks, 4 new economic invariants, `access-economy` campaign id |
| `packages/sunrey-economics/src/stress/catalog.ts` | `ECON-ACC-001..015`, `ACCESS_STRESS_IDS`, `access-economy` campaign, `ECON-ACC-002` added to the smoke campaign |
| `packages/sunrey-economics/src/stress/engine.ts` | `ACCESS_*` shocks drive Access Economy scenarios and record their outcome |
| `packages/sunrey-economics/src/stress/invariants.ts` | Four access invariant checks, extended `LabAuxState` |
| `packages/sunrey-economics/src/stress/property.ts` | Extended `LabAuxState` initializer |
| `packages/sunrey-economics/src/stress/stress.test.ts` | 18 invariants, access campaign coverage |
| `packages/access-fabric/src/ids.ts` | Use the canonical `Brand<>` helper (repairs typecheck) |
| `packages/access-fabric/src/engine.ts` | `UtcInstant` on internal slices (repairs typecheck) |
| `packages/access-fabric/src/demo.ts` | Build the policy decision from the entitlement id (repairs typecheck under `exactOptionalPropertyTypes`) |
| `docs/architecture/manifest.json` | Register `packages/access-fabric`, two components, two capabilities, one bounded context, eight forbidden roots; extend `packages/sunrey-economics` allowed dependencies |
| `docs/architecture/chunk-dependencies.md` | Two capability rows and the ACCESS-04 / ACCESS-13 notes |
| `package.json` | `demo:sunrey-access-economy`, access-economy test glob |
| `scripts/ci.sh`, `.github/workflows/ci.yml` | Access Economy demo, qualification, and stress campaign stages |

### New documentation

| File | Purpose |
| --- | --- |
| `docs/architecture/access-fabric-architecture.md` | Ownership table, three data flow diagrams, invariant table, scenario table |
| `docs/architecture/ACCESS_FABRIC_STATUS.md` | This report |

## Canonical integrations used

Every plane is consumed from its canonical owner. Nothing was reimplemented.

| Plane | Owner consumed |
| --- | --- |
| Access entitlement eligibility | `packages/access-fabric` — `AccessEntitlementEngine.evaluate()` is called per request; its refusal is honoured unchanged |
| Evidence | `packages/evidence` — `EvidenceVault.seal()` and `verifyChain()` |
| Clock | `packages/config` — `FrozenClock` for replayable instants |
| Deployment posture | `packages/config` — `ENVIRONMENT`, `SIMULATION_MODE` read, never written |
| Time and result types | `packages/domain` — `UtcInstant`, `Brand`, `Result` |
| Productive capacity context | `packages/sunrey-economics` — `DualEconomySimulationEngine` output per category |
| Economic invariants and stress harness | `packages/sunrey-economics/src/stress` — `ACCESS` domain scenarios and campaign |
| Execution Authority | `packages/permissions` — referenced by opaque authority reference only; the simulation never mints one (`issuedBySimulation: false`) |
| Ledger settlement | `packages/ledger` — attributed as `settlementOwner`; no journal is written by the simulation |
| Exchange pricing | `packages/sunrey-exchange` — attributed as the only quote source; absence refuses |
| Custody | `packages/custody` — attributed as the only custody plane |
| Monetary constitution | `packages/sunrey-chain` — the only mint; access activity issues nothing |

New allowed dependencies added to `packages/sunrey-economics` in the
manifest: `packages/access-fabric`, `packages/evidence`.

## Test counts

Measured on this branch with Node 22 and the repository test runner.

| Suite | Command | Tests |
| --- | --- | --- |
| Access Economy package tests | `node --test packages/sunrey-economics/src/access-economy/access-economy.test.ts` | 37 |
| Access Economy architecture guards | `node --test packages/sunrey-economics/src/access-economy/architecture-guards.test.ts` | 8 |
| ACCESS-13 cross-package integration | `node --test tests/access-13-access-economy-qualification.test.ts` | 14 |
| Access Fabric package tests (ACCESS-04) | `node --test packages/access-fabric/src/*.test.ts` | 13 |
| Dual-economy simulator | `node --test packages/sunrey-economics/src/dual-economy.test.ts` | 14 |
| Economic stress laboratory | `node --test packages/sunrey-economics/src/stress/stress.test.ts` | 14 |
| **ACCESS-13 relevant total** | | **100** |
| Repository suite | `npm test` | 3843 tests in 635 suites: 3842 pass, 0 fail, 1 skipped |

Scenario and invariant coverage:

- 15 Access Economy scenarios, each asserted against its expected scarcity
  mode and its expected outcome set.
- 16 permanent access invariants, asserted on all 15 scenarios (240
  invariant evaluations per qualification run).
- 15 `ECON-ACC-*` stress scenarios in the `access-economy` campaign.
- 4 access invariants reported on all 94 stress catalog scenarios.

## Gates run for this chunk

| Gate | Command | Result |
| --- | --- | --- |
| JSON, merge, and YAML integrity | `npm run integrity:check` | pass |
| Architectural invariants (Python) | `npm run lint:invariants` | pass |
| Extraction dry-run | `npm run check:extraction` | pass |
| Architecture linter and constitution | `npm run lint:architecture` | pass |
| Naming audit | `npm run naming:audit` | pass |
| Authority map | `node scripts/check-authority-map.mjs` | pass |
| Architecture freeze | `node scripts/check-architecture-freeze.mjs` | pass |
| Deployment posture | `npm run check:posture` | pass, simulation-only |
| Production safety | `npm run check:production-safety` | pass, all production flags false |
| Kernel gating | `npm run gate` | pass, no new ungated mutator |
| API and contract specs | `npm run check:api` | pass |
| Repository typecheck | `npm run typecheck` | pass |
| Secret scan | `npm run scan:secrets` | pass |
| Package, integration, and API tests | `npm test` | pass |
| End-to-end simulation qualification | `npm run sunrey-economics -- access qualify` | `ACCESS_FABRIC_CODE_COMPLETE_CANDIDATE` |
| Access stress campaign | `npm run sunrey-economics -- stress campaign --id access-economy` | 15 scenarios, 0 violations |

Rust: no chain code changed in this chunk, so
`packages/sunrey-chain/node` and `packages/sunrey-chain/rust` were not
modified. The Rust stage of CI is unaffected and runs unchanged.

## Remaining simulated dependencies

1. Productive capacity comes from the Chunk 75 dual-economy simulator, not
   from a metered provider feed.
2. Execution Authority references are fixtures standing in for authorities
   the Compliance Kernel issues elsewhere. The simulation verifies presence,
   scope, and provenance, but does not verify a real signature.
3. Provider availability, provider outage, and settlement failure are
   injected scenario conditions, not observed provider telemetry.
4. Exchange quote availability is a scenario switch, not a live canonical
   Exchange session.
5. Ledger and custody settlement are attributed to their canonical owners
   without executing a real journal or a real custody instruction.
6. Capacity evidence freshness is a scenario flag, not a signed oracle
   observation with a real timestamp and provider set.
7. Jurisdiction capability and policy eligibility are supplied per request
   rather than answered by the Regulatory Digital Twin at runtime.

## Remaining real-world provider requirements

1. Certified capacity providers per experience class, admitted through the
   Chunk 128 provider certification and conformance sandbox gate.
2. Per-location and per-date inventory feeds with freshness guarantees for
   every published capacity bucket, plus a defined staleness threshold.
3. Contractual overbooking, cancellation, and no-show terms per provider,
   expressed as policy rather than as code defaults.
4. Identity and residency verification providers able to answer the
   jurisdiction questions the policy plane asks.
5. Settlement rails bound to the canonical ledger and custody owners and
   executed only under signed Execution Authority.
6. An operational reconciliation path between provider-side inventory and
   the SunRey capacity ledger, including a documented divergence procedure.
7. Provider-side support and remedy obligations for a confirmed right the
   provider cannot honour.

## Remaining legal and regulatory gates

1. Counsel review of access entitlement provenance per corridor. Unknown
   corridors remain `RESEARCH_REQUIRED` and disabled. Nothing in this chunk
   marks any rule `CONFIRMED_BY_COUNSEL`.
2. Consumer-protection review of refusal reason codes and of what a person
   is told when access is refused.
3. Data-protection review of the evidence payload schema, including the
   sensitive-key deny list and the retention period for sealed decisions.
4. Non-discrimination review of the policy priority bands used for
   deterministic queue ordering, per jurisdiction.
5. Confirmation in each corridor that an access entitlement is not a payment
   instrument, deposit, security, e-money, voucher, or prepaid product.
6. Review of whether a confirmed access right creates a consumer contract,
   and if so who the counterparty is.
7. Competition review where a single provider holds a dominant share of a
   location or date bucket. The simulation reports concentration; it draws
   no antitrust conclusion.

## Unresolved architecture decisions

These are recorded rather than silently decided.

1. **ACCESS-04 merge order.** ACCESS-13 is stacked on an unmerged branch.
   Whether ACCESS-04 merges first or the two land together is a human
   decision. If ACCESS-04 is revised during review, the manifest entries and
   the branded-id helper in `branding.ts` may need to follow.
2. **Missing chunks ACCESS-01..03 and ACCESS-05..12.** No code exists for
   these. If they are later written, `ACCESS_FABRIC_CODE_COMPLETE_CANDIDATE`
   must be re-derived; it currently describes only the capabilities present.
3. **Partial grants.** The allocator refuses a request it cannot fill
   completely rather than granting part of it. This keeps
   `NO_OVERSOLD_PRODUCTIVE_CAPACITY` simple to prove, but a real product may
   want partial fills with an explicit remainder. Unresolved.
4. **Reservation expiry.** `AccessReservation` carries `expiresAt` in
   `packages/access-fabric`, but the simulation resolves each request within
   one pass and does not model a reservation timing out and returning units.
   A time-advancing reservation lifecycle is unresolved.
5. **Policy-change semantics.** Reservations opened after a policy change
   become `HELD_FOR_POLICY_REVIEW` and are never re-evaluated inside the
   scenario. Who re-evaluates a held reservation, on what clock, and what a
   person sees while it is held are unresolved.
6. **Queue fairness.** Ordering is policy band then request id. That is
   deterministic and auditable but favours whoever produced a
   lexicographically smaller id. Whether production should use arrival
   order, a lottery, or a policy-defined fairness rule is unresolved and is
   also a legal question (gate 4 above).
7. **Where the Access Economy is exposed.** No `services/api` surface was
   added. Publishing simulation output through the Consumer BFF would let a
   client read lab numbers as if they were product state. Which access
   endpoints belong in `services/api`, and what they may return before
   `LIVE_CONNECTIVITY_ENABLED`, is unresolved.
8. **Composite experience atomicity.** In `ACCESS-SIM-14`, each travel leg
   refuses independently, so a person can hold two of three legs. Whether a
   composite experience should be all-or-nothing, and if so how that
   interacts with per-provider settlement, is unresolved.
9. **Capacity share parameters.** `categoryShareBps` and `preCommittedBps`
   are engineering fixtures chosen to exercise abundance and scarcity. They
   carry no production meaning and must not be read as a capacity plan.

## Stop

ACCESS-13 is the final chunk in this sequence. Work stops here.
