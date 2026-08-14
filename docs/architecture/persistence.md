# PostgreSQL persistence fabric

PostgreSQL is the canonical durable adapter behind the existing domain
interfaces. It is not a second Ledger, a second Evidence Vault, or a new
Compliance Kernel. In-memory adapters remain the default for unit tests.

Engineering use of PostgreSQL is **not** regulatory or legal approval.

## Bounded databases

One PostgreSQL instance per simulation cell. Four databases, no cross-database
SQL joins, no `postgres_fdw`:

| Database | Runtime role | Durable contents |
| --- | --- | --- |
| `solstice_customer` | `customer_app` | customers, legal entities, policy packs/versions/rules, capabilities, source references, manual-review cases |
| `solstice_customer` | `customer_app` | customers, legal entities, identity schema (not a second customer) |
| `solstice_ledger` | `ledger_writer` / `ledger_reader` | accounts (no balance), journals, postings, intent/authority audit, domain events |
| `solstice_evidence` | `evidence_app` | evidence hash chain |
| `solstice_security` | `security_app` | key metadata and service-identity references only |

Cross-domain facts move as opaque identifiers (customer id, account id,
evidence id). A ledger session cannot `SELECT` a customer row.

## Transaction boundaries

A consequential operation (open, deposit, withdraw, transfer) is one
application unit of work:

1. Take the evidence-chain advisory lock.
2. Reload the evidence tip from PostgreSQL.
3. Run the existing Kernel → Execution Authority → service path in memory.
4. Commit the **customer** database (customer upserts).
5. Commit the **ledger** database in one transaction: accounts, ledger
   accounts, intents, authority audit (signature fingerprint only), journals,
   postings, open-account outcomes, domain events, **and outbox rows**.
   State and the publishable event commit together. The dispatcher is
   outside that transaction.
6. Commit the **evidence** database (new chain records, in seq order).
7. Release the lock.

A deposit does not update `account` (there is no balance column). The durable
money movement is the journal insert. That is why concurrent deposits do not
use last-write-wins on an account row.

Commit order is ledger then evidence for posted money. A crash after the
ledger commit and before the evidence commit leaves a durable journal. Restart
reconstructs the books. A replay of the same idempotency key posts no second
journal and seals an idempotent-replay evidence record. That crash window is
accepted until the Chunk 3 outbox can enlist both databases in one
coordinator log.

A crash after Kernel evaluation and before the ledger commit leaves decision
evidence only if that evidence transaction committed. The current flush writes
new evidence after the ledger unit, so a refused or failed post still persists
its in-memory evidence in the same evidence transaction as any later seals
from that call. Refusals that never reach a journal still persist evidence.

Invalid data is rejected. Triggers never rewrite an unbalanced journal.

## Database constraints

- Journals, postings, action intents, authority audit rows, domain events, and
  evidence records are insert-only for runtime roles (`SELECT` + `INSERT`).
- `BEFORE UPDATE OR DELETE` triggers raise if a grant mistake reintroduces
  mutation.
- `journal.idempotency_key` is unique.
- Posting `minor_units` is `NUMERIC(38, 0)` and must be strictly positive.
- A deferred constraint trigger requires each journal to have at least two
  postings and `sum(debit) = sum(credit)` at commit.
- A deferred trigger rejects CUSTOMER + CORPORATE commingling and unknown
  ledger-account references.
- Evidence `seq` must be contiguous; `prev_record_sha256` must match the tip.

## Concurrency

- Duplicate idempotency keys: return the existing journal, or refuse if the
  fingerprint differs. Never last-write-wins.
- Concurrent deposits: unique journal ids, account row lock during the ledger
  transaction, evidence advisory lock for the chain.
- Concurrent withdrawals: same account lock. Insufficient funds is evaluated
  against journals already committed.
- Evidence append: `pg_advisory_xact_lock` plus tip reload before seal.
  Journals are reloaded from PostgreSQL under that lock so NSF checks see
  committed books. Never last-write-wins.

## Idempotency

Idempotency keys live on the journal table. They survive process restart.
Conflicting reuse of a key is a deterministic `IDEMPOTENCY` failure.

Account opening is idempotent by intent id (`ledger.account_open_outcome`).

## Evidence chain

Each row stores `seq`, payload, payload hash, previous hash, and record hash.
The application verifier recomputes the same SHA-256 string as
`packages/evidence`. Restart reloads rows in `seq` order and verifies again.

## Read models

Balances are always `credits − debits` from postings. No `Account.balance`.
No persisted yield or percentage-return projection. If a projection is added
later it must be marked non-authoritative and rebuildable.

## Local commands

```bash
npm run db:up
npm run db:migrate
npm run test:persistence
npm run db:down
```

Credentials in `infra/postgres/` are local/simulated only.
