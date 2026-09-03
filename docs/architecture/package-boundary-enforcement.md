# Package boundary enforcement

Machine-enforceable package and economic-authority boundaries keep the SunRey
monorepo extractable and prevent information layers from acquiring execution
authority.

## Allowed dependencies

- **Public package API** — import another workspace package through its published
  export surface, for example `@solstice/domain` or another subpath declared in
  that package's `package.json` `exports` field (never through `/src/`).
- **Same-package relatives** — files under `packages/<name>/src/**` may import
  siblings with relative paths (`./foo.ts`, `../bar.ts`) as long as resolution
  stays inside the same package.
- **Services** — application services under `services/` orchestrate packages;
  package libraries must not import `services/**`.

## Prohibited dependencies

- **Deep cross-package imports** — any import that resolves to
  `packages/<other>/src/**` from a different package, whether written as:
  - `@solstice/other/src/internal.ts`
  - `../../other/src/internal.ts`
  - deeper relative paths
  - or another resolvable alias form
- **Package → service** — `packages/**` must not import `services/**`.
- **Economic authority reversal** — information layers must not import execution,
  mint, ledger, custody, or settlement implementation paths (see DAG below).

## Public package API policy

Each package exposes a single supported surface via `package.json` `exports`.
Consumers use `@solstice/<package>` (root) or an explicitly exported subpath.
Reaching into `src/**` of another package bypasses the export contract and is a
boundary violation.

## Economic authority DAG

Dependency direction is enforced for information layers:

```
OBSERVATION / EXTERNAL DATA
  → ECONOMIC AWARENESS FABRIC
  → INFORMATION CONSENSUS
  → CANONICAL ECONOMIC CLAIM
  → GOVERNED POLICY / VALUATION / ELIGIBILITY
  → AUTHORIZED ECONOMIC ACTION
```

Paths under:

- `packages/economic-awareness-fabric/`
- `packages/sunrey-chain/src/economic-awareness-fabric/`
- `packages/sunrey-chain/src/economic-proof/`

must not import:

- `packages/ledger/`
- `packages/permissions/` (execution authority)
- `packages/sunrey-coin/`
- `packages/custody/`
- `packages/payments/src/journals`
- `packages/sunrey-chain/src/economics/`
- productive value-settlement / value-function execution paths
- `services/accounts/`

These violations are **never grandfathered**.

## Temporary legacy exemptions

The repository still contains thousands of historical deep imports (mostly
relative `../../domain/src/...` style). They are enumerated in
[`package-boundary-baseline.json`](./package-boundary-baseline.json).

Policy:

- existing baseline entries are frozen;
- CI fails on **any new** deep-import or package→service violation;
- the total non-DAG violation count must not exceed the baseline;
- economic-authority DAG violations always fail immediately.

Regenerate the baseline only during an intentional cleanup sprint:

```bash
python3 - <<'PY'
from pathlib import Path
import sys
sys.path.insert(0, 'scripts/lib')
from package_boundary import scan_package_boundaries, write_baseline
root = Path('.')
write_baseline(root / 'docs/architecture/package-boundary-baseline.json', root, scan_package_boundaries(root))
PY
```

## How CI enforces it

Stage 1 architectural checks run, in order:

1. `python3 scripts/lint-architectural-invariants.py`
2. `python3 scripts/extraction-dryrun.py` — immediate fail on service imports
   and economic DAG violations
3. `python3 scripts/check-package-boundaries.py` — baseline regression gate
4. `npm run lint:architecture` — includes `lintPackageBoundary` in the
   architectural linter

Inventory (read-only):

```bash
python3 scripts/package-boundary-inventory.py
```

## How developers fix a violation

1. **Prefer the public API** — replace
   `../../domain/src/time.ts` with `@solstice/domain` and use exported types.
2. **Move shared code** — if multiple packages need the same helper, lift it
   into the owning package's public `index.ts` export or the canonical owner
   package per `docs/architecture/manifest.json`.
3. **Do not add blanket allowlists** — fix the import or complete a baseline
   cleanup PR that shrinks `package-boundary-baseline.json`.
4. **Information layers** — never wire EAF/consensus/claim code to ledger,
   mint, custody, or settlement modules; pass intents upward to governed
   execution paths instead.

## Checker implementation

- Shared scanner: `scripts/lib/package_boundary.py`
- Baseline gate: `scripts/check-package-boundaries.py`
- TypeScript mirror + unit tests: `tools/architectural-linter/src/package-boundary-guards.ts`
