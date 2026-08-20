# Architecture merge-integrity policy

This policy stops parallel feature work from silently corrupting the
files that define how the repository is built and owned.

It is not a Git tutorial. Contributors do not need to know how merges
are implemented internally. They need to know which files cannot absorb
two independent edits at once.

## Protected shared files

Update from latest `main` before the final merge when the branch
touches any of:

- `package.json`
- `docs/architecture/manifest.json`
- `AGENTS.md`
- `.github/workflows/ci.yml`
- `docs/architecture/chunk-dependencies.md`

These files are shared ledgers of scripts, owners, layout, CI stages,
and capability status. JSON silently keeps the last duplicate key.
Markdown tables can list the same capability twice with different
status. CI can drop a job. None of those failures look like a Git
conflict in the GitHub UI.

## One architecture-affecting chunk at a time

Architecture-affecting chunks must merge **one at a time**.

A later chunk that needs a new capability, a new `package.json` test
glob, or a new CI stage rebases onto the chunk that just landed. It
must not independently append a second `"test"` script, a second
capability object, or a second copy of a layout bullet.

## Do not append competing JSON fragments

Parallel feature branches must not independently append competing JSON
fragments to the same protected object. Examples of damage this causes:

- four `"test"` keys under `package.json` `scripts`
- two capability records concatenated into one object
- a `PARTIAL` documentation row stacked on an `IMPLEMENTED` row

There is no auto-fixer that chooses the owner. Failure requires an
explicit repair that preserves the strongest current canonical owner
and the **superset** of intended test coverage.

## Checks

`npm run integrity:check` runs:

- `node scripts/check-json-integrity.mjs`
- `node scripts/check-merge-integrity.mjs`

CI and the scheduled full-platform workflow run both scripts after Node
setup and before `npm ci`. A mechanically corrupted repository must not
install or burn in.

`docs/architecture/manifest.json` remains architecture authority.
`docs/architecture/integrity-baseline.json` is informational and
regression-oriented. It is not a second constitution.
