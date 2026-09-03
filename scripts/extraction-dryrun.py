#!/usr/bin/env python3
"""Subsystem-boundary / extraction dry-run.

Checks that each package under packages/ can be treated as an extractable
unit: it must not import services, and it must not reach into another
package's src internals via alias, relative, or resolvable deep paths.

Legacy deep-import violations are tracked in
docs/architecture/package-boundary-baseline.json and enforced by
scripts/check-package-boundaries.py. This dry-run still fails immediately
on service imports and economic-authority DAG violations.
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "lib"))

from package_boundary import (  # noqa: E402
    RULE_ECONOMIC_AUTHORITY_DAG,
    RULE_PACKAGE_DEEP_IMPORT,
    RULE_PACKAGE_IMPORTS_SERVICE,
    scan_package_boundaries,
)


def main() -> int:
    packages_root = ROOT / "packages"
    if not packages_root.exists():
        print("Extraction dry-run: no packages/ directory; nothing to extract")
        return 0

    package_dirs = sorted(p for p in packages_root.iterdir() if p.is_dir())
    violations = scan_package_boundaries(ROOT)

    immediate = [
        v
        for v in violations
        if v.rule in {RULE_PACKAGE_IMPORTS_SERVICE, RULE_ECONOMIC_AUTHORITY_DAG}
    ]

    deep_count = sum(1 for v in violations if v.rule == RULE_PACKAGE_DEEP_IMPORT)

    for name in (p.name for p in package_dirs):
        print(f"Extraction dry-run: {name}")

    if immediate:
        print("Extraction dry-run failed:", file=sys.stderr)
        for item in immediate:
            print(f"{item.file}:{item.line}: {item.message}", file=sys.stderr)
        return 1

    print(
        f"Extraction dry-run: ok ({len(package_dirs)} package(s), "
        f"{deep_count} grandfathered deep-import(s) tracked in baseline)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
