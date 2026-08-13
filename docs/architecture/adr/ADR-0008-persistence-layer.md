# ADR-0008: Persistence Layer for Phase 1

- **Status:** PROPOSED
- **Date:** 2026-08-13
- **Deciders:** Architecture (this record); not yet accepted
- **Phase:** Phase 1 — Banking Simulation
- **Supersedes:** none
- **Related:** Phase 0 in-process runtime; Sovereign Cells; Evidence Vault hash chain; append-only ledger rule

---

## Context

Phase 0 of Solstice is specified to run entirely in-process with zero external
dependencies. Phase 1 (Banking Simulation) requires durable state for
customers, accounts, ledger postings, and evidence records.

Two Solstice rules constrain persistence absolutely:

1. **Ledger postings are append-only.** Corrections are compensating entries.
   There are no edits and no deletes of posted history.
2. **Each bounded domain owns its own storage.** No service may join directly
   across another regulated domain's tables.

The documented production baseline is PostgreSQL. Local development must remain
simple and runnable with no cloud account, managed database, or vendor SaaS.

This record chooses how Phase 1 stores that state, how the two rules are
enforced *in the database* (not only in application code), how the Evidence
Vault hash chain survives a process restart, and how the choice fits Sovereign
Cells (one database per cell, separate encryption keys, no global tables
holding raw customer data).

### Inspection of the current codebase

This repository was inspected before options were compared. Findings:

| Question | Finding |
| --- | --- |
| Does a storage abstraction already exist? | **No.** There are no repository interfaces, unit-of-work ports, mappers, or database drivers. |
| Is domain logic coupled to in-memory structures? | **Not yet — because there is no domain logic.** There are no ledger, account, customer, or evidence types to couple. |
| How hard is swapping in a real database? | **There is nothing to swap.** Persistence must be introduced with the first Phase 1 domain code. If that code is written against process-local maps, a later swap becomes a rewrite of every write path, every invariant check, and the hash-chain verifier. |

**Files read**

- [`README.md`](../../../README.md) — the only tracked application file; contents are the heading `# solstice`.
- Repository tree at `033b9ef` — no `src/`, `internal/`, `pkg/`, `app/`, `lib/`, tests, Compose files, SQL, or ORM config.

**Files that do not exist (and were therefore not readable)**

- Ledger posting model, posting service, or append-only collection
- Evidence Vault, hash-chain node, or verifier
- Repository / storage ports or adapters
- Prior ADRs under `docs/architecture/` (this file is the first)

There is no in-memory store to preserve and no interface to implement. The
cost of choosing a real database now is the cost of introducing persistence
once. The cost of deferring it is coupling the first banking simulation to
structures that vanish on restart and cannot enforce the two rules at the
storage layer.

---

## Decision drivers

- Append-only immutability of ledger postings must hold even if application
  code is buggy, a debugger is attached, or a compromised service account
  issues SQL.
- Cross-domain SQL joins must be *impossible*, not a lint rule.
- Evidence Vault hash chain must be bit-identical after a crash, stop, or
  machine reboot, and must be re-verifiable from durable bytes.
- Sovereign Cells require cell-local data, cell-local keys, and no global
  customer dump.
- Local developers must run Phase 1 without a cloud account.
- The documented baseline is PostgreSQL; local/prod dialect drift is a
  first-class risk.

---

## Options

### Option A — PostgreSQL from Phase 1, run locally in Docker

Stand up PostgreSQL 16+ in Docker Compose for every developer and CI job.
Phase 1 application services talk to that engine with the same SQL, roles,
and databases that later cells will use. No cloud. No managed offering.

This is a real PostgreSQL server, not an emulation.

#### Database-level ledger immutability

Enforcement is stacked. Application code still refuses `UPDATE`/`DELETE` on
postings; the database must refuse them too.

1. **Role separation.** Table owner is a migrator role
   (`solstice_migrator`), used only by the migration runner. Runtime services
   connect as `ledger_writer` or `ledger_reader`. Superuser is not used by
   the app, CI integration tests, or day-to-day ops scripts.
2. **Insert-only grants.** After each ledger table is created:

   ```sql
   REVOKE ALL ON TABLE ledger.posting FROM PUBLIC;
   GRANT SELECT, INSERT ON TABLE ledger.posting TO ledger_writer;
   GRANT SELECT ON TABLE ledger.posting TO ledger_reader;
   -- UPDATE, DELETE, TRUNCATE are never granted to runtime roles.
   ```

   PostgreSQL will reject `UPDATE`/`DELETE`/`TRUNCATE` from `ledger_writer`
   with a permission error. That is the primary control.
3. **Mutation-rejecting triggers.** Owned by the migrator, not the app:

   ```sql
   CREATE FUNCTION ledger.forbid_posting_mutation()
   RETURNS trigger LANGUAGE plpgsql AS $$
   BEGIN
     RAISE EXCEPTION 'ledger postings are append-only; post a compensating entry'
       USING ERRCODE = 'read_only_sql_transaction';
   END;
   $$;

   CREATE TRIGGER posting_append_only
     BEFORE UPDATE OR DELETE ON ledger.posting
     FOR EACH ROW EXECUTE FUNCTION ledger.forbid_posting_mutation();
   ```

   Triggers fire even if a future grant mistake reintroduces `UPDATE`. They
   do not replace revoked grants; they catch the grant mistake.
4. **No truncating rewrite paths.** `TRUNCATE` is not granted. Event triggers
   on `ddl_command_start` reject `DROP TABLE` / `ALTER TABLE` against ledger
   posting relations except from the migrator role during a reviewed
   migration. Table clustering / `VACUUM FULL` that would rewrite heap files
   is an ops procedure, not an app capability.
5. **Balanced-entry constraints** (application still checks; database also
   checks) so a posting batch cannot commit with unbalanced debit/credit.
   Corrections insert new rows that reference the original posting id; they
   never mutate it.

Compensating entries are ordinary `INSERT`s. They are the only legal
correction mechanism.

#### Per-domain storage ownership (joins impossible)

Schemas in one database are **not** sufficient. PostgreSQL allows
cross-schema joins inside a single database for any role that can `SELECT`
both relations. Foreign Data Wrapper (`postgres_fdw`) and `dblink` can also
stitch databases together if they are installed and reachable.

Phase 1 therefore uses **separate PostgreSQL databases per bounded domain,
on a cell-local instance**, with no FDW:

| Database (illustrative) | Owner domain | Runtime role |
| --- | --- | --- |
| `solstice_customer` | Customer | `customer_app` |
| `solstice_ledger` | Accounts / ledger | `ledger_writer` / `ledger_reader` |
| `solstice_evidence` | Evidence Vault | `evidence_app` |

- Each service's connection string points at **one** database. Credentials
  for that role exist only on that database (`GRANT CONNECT` is not issued
  elsewhere).
- `postgres_fdw` and `dblink` are not installed. `CREATE EXTENSION` is
  revoked from runtime roles. `ATTACH`-style stitching does not exist.
- Cross-domain facts move as **domain events or explicit API calls** carrying
  opaque identifiers (account id, customer ref, evidence id). No SQL view
  spans two regulated databases.

A developer who writes `SELECT ... FROM customer.party JOIN ledger.posting`
cannot run it: those relations are not in the same catalog, and the session
cannot see the other catalog.

#### Evidence Vault hash chain across restart

Each evidence record is an append-only row in `solstice_evidence`:

- monotonic `seq`
- `payload_sha256`
- `prev_record_sha256` (genesis uses 32 zero bytes)
- `record_sha256 = SHA-256(seq || payload_sha256 || prev_record_sha256 || canonical metadata)`
- optional signer / key id (cell-local)

PostgreSQL `INSERT` plus WAL makes the chain durable. On process start, and
on a periodic verifier job, the Evidence Vault:

1. Reads rows in `seq` order (the only allowed access pattern besides
   point lookup by id).
2. Recomputes each `record_sha256`.
3. Asserts `prev_record_sha256` equals the previous row's `record_sha256`.
4. Refuses to serve evidence if the chain is broken.

A restart does not rebuild the chain from memory. It re-reads durable rows
and re-verifies. A signed tip checkpoint (same database, also append-only)
gives a fast integrity pin without changing the full-chain verify path.

Same insert-only grants and mutation triggers as the ledger apply to
evidence rows. The hash chain is only as trustworthy as the inability to
rewrite a prior row.

#### Sovereign Cells

- **One PostgreSQL instance per cell.** Phase 1 ships a single-cell Compose
  file (`postgres` + app). Adding a second cell is a second instance with
  its own volume, port, and credentials — not a new schema on a shared
  cluster.
- **Separate encryption keys.** At rest: cell-local volume encryption
  (dev: file-backed; later: KMS-wrapped data keys). In column: pgcrypto /
  application envelope encryption for raw customer attributes, using a key
  that does not leave the cell. No cell can decrypt another cell's volume
  or customer columns.
- **No global tables of raw customer data.** A routing / directory component,
  if needed, stores only `cell_id` plus a non-reversible customer reference
  (hash of a cell-issued identifier). Name, address, tax id, and account
  balances do not exist outside the owning cell's databases.
- Shared *code* and shared *migration files* are allowed. Shared *data* is
  not.

#### Local development

```text
docker compose up postgres   # one cell, three databases, migrator + app roles
```

No cloud project, no SaaS database, no vendor CLI. CI uses the same Compose
file.

#### Costs

- Docker is a local dependency.
- Developers need a short bootstrap (Compose + migrate).
- Slightly heavier than a single SQLite file.

These costs are accepted so that immutability, isolation, and the hash chain
are the same mechanisms in development that they will be in a cell.

---

### Option B — SQLite locally with a Postgres-compatible interface; PostgreSQL later

Use SQLite (one file per domain, or one file per cell) for Phase 1. Hide it
behind a repository port or a "Postgres-compatible" driver/ORM. Switch the
adapter to PostgreSQL when durability and isolation "become real."

#### Database-level ledger immutability

SQLite can reject mutations with triggers:

```sql
CREATE TRIGGER posting_no_update BEFORE UPDATE ON posting
BEGIN
  SELECT RAISE(ABORT, 'ledger postings are append-only');
END;
```

That is real, and it is the strongest SQLite-native control.

What SQLite **cannot** do in a way that matches the PostgreSQL baseline:

- **Insert-only roles.** SQLite has no PostgreSQL `ROLE` / `GRANT` /
  `REVOKE` model. A connection that can `INSERT` can typically `UPDATE` and
  `DELETE` unless an authorizer callback is installed in the embedding
  process. The authorizer is C-level, easy to omit, and is not the same
  artifact as the production grant set.
- **Separate catalog permissions.** File mode bits (`chmod`) protect the
  whole file, not `INSERT` vs `UPDATE` on one table.
- **TRUNCATE / rewrite.** Replacing the file, copying a mutated file into
  place, or opening the DB with a tool that does not register triggers
  bypasses application controls. PostgreSQL still requires a superuser (or
  table owner) to do the equivalent, and those principals are out of the
  runtime grant set.

A "Postgres-compatible interface" does not create Postgres-compatible
*authorization*. ORMs that emit both dialects still leave SQLite enforcing
a weaker policy than production. The grant/trigger pair of Option A would
be tested only after the switch — i.e. after Phase 1 has already written
the ledger.

#### Per-domain storage ownership

Separate SQLite files per domain make cross-file `JOIN` impossible unless
the connection `ATTACH`es another database. An authorizer can deny
`ATTACH`. That is a credible local isolation story.

It is still a different mechanism from production (separate PostgreSQL
databases + no FDW + per-database `CONNECT`). Tests that pass on SQLite
do not prove that the PostgreSQL grant topology works. The day the adapter
flips, join-impossibility has to be re-proven.

#### Evidence Vault hash chain across restart

A SQLite file survives restart. A hash chain stored as append-only rows can
be re-verified. Durability is real for a single process on one disk.

Caveats: one writer, WAL/lock behaviour unlike PostgreSQL, and a file that
is trivial to copy, truncate, or hex-edit outside the engine. The chain is
verifiable *if* the file is intact; the engine does not match PostgreSQL's
role and WAL story for "who was allowed to write these bytes."

#### Sovereign Cells

One directory of SQLite files per cell, with file-level encryption (SQLCipher
or encrypted volumes), can mimic "one database per cell" locally.

The encryption key story, backup story, and operational unit then *change*
when PostgreSQL arrives (instance, `pg_basebackup`, TDE/volume, pgcrypto).
Cell topology would be redesigned, not flipped behind an interface.

#### Local development

No Docker. `sqlite3` files in `./var/`. Attractive until the first dialect
bug (types, `JSONB`, `LISTEN`, transactional DDL, concurrent writers).

#### Costs

- Apparent speed of Phase 1, paid back as a persistence rewrite.
- Immutability and isolation tests exercise the wrong engine.
- "Compatible interface" is an application fiction; authorization is not
  portable.

---

### Option C — Keep in-memory for Phase 1; defer persistence

Retain Phase 0's in-process maps for customers, accounts, postings, and
evidence. Add a database in a later phase.

#### Database-level ledger immutability

**There is no database.** Immutability can only be an application
convention: frozen records, no setters, copy-on-write lists, code review.

A debugger, a reflection call, a missed clone, or a test helper that
mutates a posting in place will succeed. Compensating entries are a
policy, not a storage law. This option **cannot** meet the requirement that
immutability be enforced at the database level.

#### Per-domain storage ownership

Separate in-memory maps per package discourage joins; they do not prevent
them. Any code in the same process can hold two references and correlate
rows. There is no catalog boundary and no credential boundary.

#### Evidence Vault hash chain across restart

The chain lives in heap. A restart yields an empty vault. Verification
after reboot is vacuously true and operationally useless. Phase 1 cannot
demonstrate crash-safe evidence, audit replay, or "stop the process and
prove the books still balance."

#### Sovereign Cells

A single process heap is one cell by accident, not by construction. There
are no per-cell encryption keys, no per-cell catalogs, and nothing to stop
a "global" `HashMap` of customers. Introducing cells later means introducing
persistence *and* tenancy at the same time.

#### Local development

`go test` / `npm test` with no Docker. Fast, and it does not satisfy Phase 1
durable-state scope.

#### Costs

Phase 1 becomes a disposable prototype. The two Solstice rules are
unenforceable where they matter. The hash chain cannot be a Phase 1
acceptance criterion.

---

## Comparison

| Concern | A — PostgreSQL + Docker | B — SQLite now, Postgres later | C — In-memory |
| --- | --- | --- | --- |
| Ledger `UPDATE`/`DELETE` refused by storage | Roles + `REVOKE` + triggers | Triggers only; no insert-only roles | No |
| Cross-domain joins impossible | Separate DBs, no FDW, no `CONNECT` | Separate files + deny `ATTACH` (different later) | No |
| Hash chain survives restart and re-verifies | Yes, WAL-backed | Yes, file-backed (weaker integrity story) | No |
| One DB instance per cell, distinct keys | Yes, from the first Compose file | File mimic; engine change later | No |
| Local, no cloud | Docker Compose | Files on disk | Process only |
| Matches documented Postgres baseline | Yes | Not until the switch | No |
| Risk of persistence rewrite | Low | High | Certain |

---

## Recommendation

**Option A: PostgreSQL from Phase 1, run locally in Docker.**

Phase 1 is a banking simulation with an append-only ledger and an evidence
hash chain. Those are storage properties. They are not application
conventions to be "made real" after the simulation has already posted
history into maps or SQLite.

Option B looks simpler and fails the grant-level immutability test and the
"same engine as the cell" test. Option C fails durability, immutability,
isolation, and cells simultaneously.

Accepting A now means the first posting table is created already insert-only,
the first evidence row is already chained on disk, and the first customer
row already lives in a database that a ledger session cannot `JOIN`.

This record remains **PROPOSED** until it is explicitly accepted. It does
not authorise installing a driver, ORM, or migration tool, and it does not
authorise committing schema.

---

## How this is enforced (summary)

| Rule | Mechanism under Option A |
| --- | --- |
| Append-only ledger | Migrator owns tables; runtime roles get `SELECT`+`INSERT` only; `UPDATE`/`DELETE`/`TRUNCATE` revoked from `PUBLIC` and app roles; `BEFORE UPDATE OR DELETE` trigger raises; compensating `INSERT` only |
| No cross-domain joins | One PostgreSQL database per bounded domain; runtime role `CONNECT`s to exactly one; `postgres_fdw`/`dblink` not installed; events/APIs for cross-domain facts |
| Hash chain after restart | Evidence rows durable in `solstice_evidence`; boot + scheduled verifier recomputes SHA-256 links from genesis; append-only grants on the chain table |
| Sovereign Cells | One Postgres instance and volume per cell; cell-local at-rest and column keys; no cluster-global customer table; directory holds opaque refs only |

---

## Migration tooling and review

**Tool:** [Flyway](https://documentation.red-gate.com/flyway) with **versioned
SQL** (not ORM auto-migrate, not Hibernate `hbm2ddl`, not Prisma unattended
apply). Flyway checksums every applied script, which is the property we want
for a regulated ledger: a silent edit of an already-applied migration fails
CI. Run Flyway as the `solstice_migrator` role from its Docker image so the
application language need not be chosen first.

If the implementation language later makes Atlas a better fit, Atlas may
replace Flyway **only if** it still executes reviewed SQL files with
checksums and never generates grant/trigger DDL from an undocumented ORM
model. The invariant is "SQL in git, checksummed, migrator-only," not the
vendor name.

**Layout (illustrative, not created by this ADR)**

```text
db/
  customer/migrations/V001__...sql
  ledger/migrations/V001__...sql
  evidence/migrations/V001__...sql
```

Each bounded domain has its own migration stream against its own database.
No migration in `ledger/` may create objects in `solstice_customer`.

**Review**

1. Every migration is a pull request of its own or a clearly isolated commit.
   Domain owner and architecture review.
2. Ledger and evidence PRs must include the `REVOKE`/`GRANT` statements and
   the append-only trigger in the **same** version that creates the table.
   A table that exists for one commit without those controls is a defect.
3. Applied files are immutable. A mistake is a new `V00n__` that adds a
   compensating constraint or a new table. Rewriting `V001` after apply is
   forbidden (Flyway checksum will fail, and review must reject the rewrite).
4. CI starts Compose Postgres from scratch, applies migrations, then runs
   *invariant probes*: `UPDATE`/`DELETE` on `ledger.posting` as
   `ledger_writer` must fail; a cross-database `JOIN` must be unexpressible;
   evidence verifier must pass after a container restart.
5. `CREATE EXTENSION`, `GRANT ... TO PUBLIC`, and FDW remain on a deny list
   in review.

This ADR does not add those migrations or CI jobs.

---

## Consequences

### Positive

- Phase 1 durable state, ledger law, domain isolation, and evidence
  verifiability are the same mechanisms that Sovereign Cells will run.
- Local development stays offline: Docker, not a cloud database.
- Swapping engines later is unnecessary.

### Negative

- Docker is required to run the simulation.
- Three databases and several roles are more bootstrap than a single file.
- Engineers must write SQL migrations instead of dumping an object graph.

### Neutral

- Application repositories should still exist as ports so domain tests can
  use a fake. The fake is not the system of record. The Docker PostgreSQL
  is.

---

## Rejected alternatives (short)

- **One PostgreSQL database, many schemas.** Cross-schema joins remain
  possible; fails rule 2.
- **Row-Level Security as the only isolation.** RLS is a predicate, not a
  catalog boundary, and it does not stop a role that can `SELECT` two
  tables from joining them. RLS may later refine *intra*-domain access; it
  is not the cell or domain boundary.
- **Application-only immutability** (Option C, or Option A without
  `REVOKE`). Insufficient against bugs and compromised app credentials.
- **ORM as source of schema.** Hides grants and triggers; incompatible with
  migration review as specified.

---

## Recommended next task

Accept or reject this ADR explicitly (do not silently treat PROPOSED as
ACCEPTED). If accepted, the next change is a **documentation-only** Compose
and role/database topology note — still no application driver — or, once
implementation is authorised, the first Flyway SQL for `solstice_ledger`
that creates `posting` already insert-only, plus a CI probe that `UPDATE`
fails. Do not write domain services against in-memory maps in the meantime;
that path is Option C by stealth.
)
