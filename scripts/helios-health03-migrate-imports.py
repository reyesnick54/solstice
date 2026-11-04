#!/usr/bin/env python3
"""One-shot HELIOS HEALTH03 deep-import → public API migration (audit packages)."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

AUDIT_PREFIXES = (
    "packages/platform/src/helios",
    "packages/strategy-lab/src",
    "packages/agentic-capital-mesh/src",
    "packages/external-data/src",
    "packages/provider-sdk/src",
)

IMPORT_RE = re.compile(
    r"""(?P<prefix>from\s+['"]|import\s*\(\s*['"])(?P<spec>[^'"]+)(?P<suffix>['"])"""
)

REL_CROSS_PKG = re.compile(
    r"^(?:\.\./)+(?P<pkg>[a-z0-9-]+)/src/(?P<subpath>.+)$"
)

# Map deep platform/helios paths to declared @solstice/platform export subpaths.
PLATFORM_HELIOS_SUBPATH: dict[str, str] = {
    "helios/adaptive-alpha-fabric/aaf08-external-equities/provider-port.ts": "helios/aaf08-external-equities",
    "helios/market-observation/types.ts": "helios/market-observation",
    "helios/feature-fabric/feature-coverage/index.ts": "helios/feature-coverage",
    "helios/feature-fabric/compiler/strategy-lab-bridge.ts": "helios/strategy-lab-bridge",
}

SUNREY_EXCHANGE_SUBPATH = "capital-market"


def rewrite_spec(spec: str) -> str | None:
    m = REL_CROSS_PKG.match(spec)
    if not m:
        return None
    pkg = m.group("pkg")
    subpath = m.group("subpath")

    if pkg == "platform":
        for suffix, export_sub in PLATFORM_HELIOS_SUBPATH.items():
            if subpath == suffix or subpath.endswith("/" + suffix):
                return f"@solstice/platform/{export_sub}"
        return None

    if pkg == "sunrey-exchange" and subpath.startswith("capital-market/"):
        return f"@solstice/sunrey-exchange/{SUNREY_EXCHANGE_SUBPATH}"

    # Workspace packages expose a single root export surface.
    return f"@solstice/{pkg}"


def migrate_file(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    changed = False

    def repl(match: re.Match[str]) -> str:
        nonlocal changed
        spec = match.group("spec")
        if spec.startswith("@solstice/"):
            return match.group(0)
        new_spec = rewrite_spec(spec)
        if new_spec is None or new_spec == spec:
            return match.group(0)
        changed = True
        return f"{match.group('prefix')}{new_spec}{match.group('suffix')}"

    new_text = IMPORT_RE.sub(repl, text)
    if changed:
        path.write_text(new_text, encoding="utf-8")
    return changed


def main() -> int:
    touched = 0
    for prefix in AUDIT_PREFIXES:
        base = ROOT / prefix
        if not base.exists():
            continue
        for path in sorted(base.rglob("*.ts")):
            if migrate_file(path):
                touched += 1
    print(f"migrated {touched} files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
