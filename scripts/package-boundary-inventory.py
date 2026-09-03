#!/usr/bin/env python3
"""Emit package boundary dependency inventory (stdout JSON)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "lib"))

from package_boundary import build_dependency_inventory, scan_package_boundaries  # noqa: E402


def main() -> int:
    violations = scan_package_boundaries(ROOT)
    inventory = build_dependency_inventory(ROOT, violations)
    print(json.dumps(inventory, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
