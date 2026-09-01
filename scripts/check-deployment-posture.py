#!/usr/bin/env python3
"""Fail CI when deployment posture leaves simulation / live-money flags unsafe.

Scans tracked-style source for capability flags. Real money and live trading
must stay off. Simulation must stay on.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKIP_DIR_NAMES = {".git", "node_modules", "dist", "build", "__pycache__"}
SCAN_SUFFIXES = {".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".yml", ".yaml", ".env"}

LIVE_FLAGS = (
    "REAL_MONEY_ENABLED",
    "LIVE_TRADING_ENABLED",
    "LIVE_CRYPTO_ENABLED",
    "LIVE_EXCHANGE_ENABLED",
    "LIVE_DATA_MARKET_ENABLED",
    "LIVE_INVESTMENT_EXECUTION",
    "LIVE_INFORMATION_RIGHTS_MARKETPLACE",
    "LIVE_DATA_MONETIZATION_ENABLED",
    "LIVE_HIN_BASED_ISSUANCE_ENABLED",
    "LIVE_MOONREY_PRODUCTIVE_ISSUANCE_ENABLED",
    "LIVE_INTEROP_ENABLED",
    "LIVE_INTEROP_RELAYERS_ENABLED",
    "LIVE_INTEROP_WATCHERS_ENABLED",
    "LIVE_EXTERNAL_CHAIN_INTERACTION_ENABLED",
    "LIVE_CUSTODY_ENABLED",
    "LIVE_AGENT_FINANCIAL_EXECUTION_ENABLED",
    "LIVE_CONNECTIVITY_ENABLED",
)

ASSIGN_RE = re.compile(
    r"\b("
    + "|".join(("SIMULATION_MODE", "ENVIRONMENT") + LIVE_FLAGS)
    + r")\b\s*=\s*([^\n;]+)"
)


def iter_files() -> list[Path]:
    files: list[Path] = []
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        if any(part in SKIP_DIR_NAMES for part in path.parts):
            continue
        if path.suffix not in SCAN_SUFFIXES:
            continue
        files.append(path)
    return sorted(files)


def normalize(value: str) -> str:
    return value.strip().strip(",").split(" as ")[0].strip().strip("'").strip('"').lower()


def main() -> int:
    failures: list[str] = []
    seen: dict[str, list[tuple[str, str, int]]] = {name: [] for name in ("SIMULATION_MODE", "ENVIRONMENT") + LIVE_FLAGS}

    for path in iter_files():
        text = path.read_text(encoding="utf-8")
        rel = path.relative_to(ROOT).as_posix()
        for match in ASSIGN_RE.finditer(text):
            name = match.group(1)
            raw = match.group(2)
            value = normalize(raw)
            line = text.count("\n", 0, match.start()) + 1
            seen[name].append((rel, value, line))

            if name in LIVE_FLAGS and value in {"true", "1", "yes", "on"}:
                failures.append(
                    f"{rel}:{line}: {name} is {raw.strip()} — live money/trading must stay disabled"
                )
            if name == "SIMULATION_MODE" and value in {"false", "0", "no", "off"}:
                failures.append(
                    f"{rel}:{line}: SIMULATION_MODE is {raw.strip()} — Phase 1 must remain a simulation"
                )
            if name == "ENVIRONMENT" and value in {"production", "prod", "live"}:
                failures.append(
                    f"{rel}:{line}: ENVIRONMENT is {raw.strip()} — production posture is not allowed while simulation-only"
                )

    if not seen["SIMULATION_MODE"] and not seen["REAL_MONEY_ENABLED"]:
        failures.append(
            "deployment posture: no SIMULATION_MODE or REAL_MONEY_ENABLED assignment found; flags must exist so they cannot be silently omitted"
        )

    if failures:
        print("Deployment posture check failed:", file=sys.stderr)
        for item in failures:
            print(item, file=sys.stderr)
        return 1

    print("Deployment posture: ok (simulation-only, live flags off)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
