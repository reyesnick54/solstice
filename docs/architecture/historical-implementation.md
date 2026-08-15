# Historical and open PR guidance

Older branches and currently open feature PRs are **not** automatically
canonical.

The consolidated `main` tree is the architectural foundation. Canonical
implementations already on `main` stay canonical:

- Money primitive — `packages/money`
- ActionIntent — `packages/permissions`
- Compliance Kernel — `packages/kernel`
- Execution Authority — `packages/permissions`
- Evidence Vault — `packages/evidence`
- Ledger — `packages/ledger`
- Account class taxonomy — `packages/domain`
- Domain types — `packages/domain`
- Accounts service authorization path — `services/accounts`

There must never be two implementations of these systems.

Open feature PRs inspected as historical context (not merged, not
copied, not closed by this work):

| PR | Branch | Why it is not automatically canonical |
| --- | --- | --- |
| #12 | `feat/phase-1-banking-simulation` | Predecessor of the authorization spine now on `main`. Salvage only after diffing against current `main`. |
| #16 | `cursor/phase-6-solstice-alpha-simulation-2166` | Later-phase portfolio / risk / paper-trading work. Must not replace Kernel, ledger, or Money. |
| #17 | `feat/phase-7-personal-data-fabric` | Planned PERSONAL DATA VAULT / CONSENT / CLEAN ROOM. PDV is now on `main` at `packages/personal-data-vault`. Consent and Clean Room from this PR were not copied. |
| #18 | `feat/phase-9-pyramid-exchange-simulation` | Historical PYRAMID EXCHANGE simulation. Inspected as idea material only. The reserved future context is now `SUNREY_EXCHANGE` at `packages/sunrey-exchange` and is not implemented. Chunk 30 stopped rather than copying this tree. |
| #19 | `cursor/phase-8-pyramid-economy-8977` | Historical PYR / Pyramid data-exchange work. Must not fork the ledger or Evidence Vault. Canonical coin reservation is now `SUNREY_COIN` at `packages/sunrey-coin` and is not implemented. Public ticker remains UNDECIDED. |

Merged PRs #11 and #14 landed later-phase code on older `main` tips.
The recovery merge that produced current `main` is the source of truth.
Do not resurrect those trees wholesale.

## How to salvage an older branch

1. Identify useful domain logic and tests. Quote the files. Do not
   assume the branch's package layout is still correct.
2. Compare that logic with latest `main`. If `main` already has a
   canonical owner for the same component, `main` wins.
3. Preserve the latest canonical interfaces: `Money`, `ActionIntent`,
   `ComplianceKernel.submit`, `AuthorityIssuer`, `EvidenceVault.seal`,
   `Ledger.postJournal`, `ACCOUNT_CLASSES`, `openAccount`.
4. Port only compatible functionality onto those interfaces.
5. Discard duplicate infrastructure: a second Kernel, a second ledger,
   a second Money type, a second Evidence Vault, a second account-class
   catalog, or a parallel intent envelope.
6. Run the entire architecture suite (`npm run ci`), including
   constitution checks.
7. Create a fresh, focused PR. Do not merge, cherry-pick, or copy an
   old PR wholesale.

If a salvaged task requires a protected capability that is not
`IMPLEMENTED` on `main`, stop. See
[chunk dependencies](./chunk-dependencies.md).
