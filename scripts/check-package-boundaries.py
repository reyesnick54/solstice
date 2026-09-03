#!/usr/bin/env python3
"""Enforce package boundaries with a frozen legacy baseline.

Fails CI when:
- a new deep-import or service-import violation appears
- the total non-DAG violation count exceeds the baseline
- any economic-authority DAG violation exists (never grandfathered)
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "lib"))

from package_boundary import (  # noqa: E402
    check_against_baseline,
    load_baseline,
    scan_package_boundaries,
)

BASELINE_PATH = ROOT / "docs" / "architecture" / "package-boundary-baseline.json"


def main() -> int:
    violations = scan_package_boundaries(ROOT)
    baseline_keys = load_baseline(BASELINE_PATH)
    new_violations, economic_dag, non_dag_keys = check_against_baseline(
        violations, baseline_keys
    )

    failures = False
    if economic_dag:
        failures = True
        print("Economic authority DAG violations (not grandfathered):", file=sys.stderr)
        for v in economic_dag:
            print(f"{v.file}:{v.line}: {v.rule}: {v.message}", file=sys.stderr)

    if new_violations:
        failures = True
        print("New package boundary violations:", file=sys.stderr)
        for v in new_violations:
            print(f"{v.file}:{v.line}: {v.rule}: {v.message}", file=sys.stderr)

    if len(non_dag_keys) > len(baseline_keys):
        failures = True
        print(
            f"package-boundary: violation count increased "
            f"({len(non_dag_keys)} > baseline {len(baseline_keys)})",
            file=sys.stderr,
        )

    if failures:
        print(
            f"package-boundary: failed ({len(new_violations)} new, "
            f"{len(economic_dag)} economic-dag, "
            f"{len(non_dag_keys)} total non-dag vs {len(baseline_keys)} baseline)",
            file=sys.stderr,
        )
        return 1

    print(
        f"package-boundary: ok ({len(non_dag_keys)} grandfathered, "
        f"baseline {len(baseline_keys)}, 0 new, 0 economic-dag)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
