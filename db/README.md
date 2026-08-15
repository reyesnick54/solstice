# Solstice database migrations

Versioned SQL for the four bounded-domain PostgreSQL databases.

| Directory | Database | Owner domain |
| --- | --- | --- |
| `customer/migrations/` | `solstice_customer` | Customer, Identity, and Personal Economic Graph schemas |
| `ledger/migrations/` | `solstice_ledger` | Accounts, journals, postings, intent/authority audit, domain events |
| `evidence/migrations/` | `solstice_evidence` | Evidence Vault hash chain |
| `security/migrations/` | `solstice_security` | Key metadata and service-identity references (never private keys) |

## Rules

- Files are named `V<number>__<slug>.sql` (example: `V001__customer.sql`).
- Numbers increase by one. Gaps are rejected.
- A file that has been applied is **immutable**. Fix mistakes with a new version.
- The migrator checksums every file. Editing an applied file fails CI.
- No ORM auto-sync. No destructive `DROP TABLE` of financial history.
- Ledger and evidence tables are created already insert-only (grants + triggers).
- There is no `account.balance` column. Balances are derived from postings.

## How to run

```bash
npm run db:up
npm run db:migrate
npm run test:persistence
npm run db:down
```

See `docs/architecture/persistence.md`.
