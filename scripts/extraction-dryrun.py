#!/usr/bin/env python3
"""Subsystem-boundary / extraction dry-run.

Checks that each package under packages/ can be treated as an extractable
unit: it must not import services, and it must not reach into another
package's src internals.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IMPORT_RE = re.compile(
    r"""(?:from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))"""
)
SKIP_DIR_NAMES = {".git", "node_modules", "dist", "build", "__pycache__"}

# Historical Phase 4/5 packages import sibling packages via relative paths.
# New packages (data-fabric, kernel, ledger, payments) must stay extractable.
LEGACY_RELATIVE_IMPORT_PACKAGES = {"agent", "platform", "domain", "permissions"}


def package_name_from_path(path: Path) -> str | None:
    try:
        rel = path.relative_to(ROOT / "packages")
    except ValueError:
        return None
    parts = rel.parts
    if not parts:
        return None
    return parts[0]


def main() -> int:
    packages_root = ROOT / "packages"
    if not packages_root.exists():
        print("Extraction dry-run: no packages/ directory; nothing to extract")
        return 0

    package_dirs = sorted(p for p in packages_root.iterdir() if p.is_dir())
    failures: list[str] = []

    for package_dir in package_dirs:
        name = package_dir.name
        print(f"Extraction dry-run: {name}")
        for path in package_dir.rglob("*"):
            if not path.is_file() or path.suffix not in {".ts", ".tsx", ".js", ".mjs", ".cjs"}:
                continue
            if any(part in SKIP_DIR_NAMES for part in path.parts):
                continue
            text = path.read_text(encoding="utf-8")
            rel = path.relative_to(ROOT).as_posix()
            for match in IMPORT_RE.finditer(text):
                spec = (match.group(1) or match.group(2) or "").replace("\\", "/")
                line = text.count("\n", 0, match.start()) + 1
                if spec.startswith("services/") or "/services/" in spec:
                    failures.append(
                        f"{rel}:{line}: package '{name}' imports service '{spec}'"
                    )
                if (
                    spec.startswith("../")
                    and "/packages/" in str(path.resolve())
                    and name not in LEGACY_RELATIVE_IMPORT_PACKAGES
                ):
                    # Cross-package relative import that walks out of this package.
                    try:
                        resolved = (path.parent / spec).resolve()
                        if (ROOT / "packages").resolve() in resolved.parents:
                            other = package_name_from_path(resolved)
                            if other and other != name:
                                failures.append(
                                    f"{rel}:{line}: package '{name}' reaches into package '{other}' via '{spec}'"
                                )
                    except OSError:
                        pass
                if "/src/" in spec and spec.startswith("@solstice/") and f"@solstice/{name}" not in spec:
                    failures.append(
                        f"{rel}:{line}: package '{name}' imports another package's internals '{spec}'"
                    )

    if failures:
        print("Extraction dry-run failed:", file=sys.stderr)
        for item in failures:
            print(item, file=sys.stderr)
        return 1

    print(f"Extraction dry-run: ok ({len(package_dirs)} package(s))")
    return 0


if __name__ == "__main__":
    sys.exit(main())
