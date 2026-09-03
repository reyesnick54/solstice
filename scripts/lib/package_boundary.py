"""Package boundary and economic authority DAG enforcement.

Packages may consume another package only through its supported public API
(`@solstice/<package>` root export or an explicit package.json export subpath).
Cross-package imports that resolve into another package's `src/**` tree are
deep-import violations unless listed in the legacy baseline.

Services under `services/` are scanned for the same deep-import and undeclared
export violations when reaching into `packages/**/src/**`.

Information layers (Economic Awareness Fabric, information consensus, canonical
economic proof) must not import execution-authority, mint, ledger, custody, or
settlement implementation paths. Those violations are never grandfathered.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

IMPORT_RE = re.compile(
    r"""(?:from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\s*\(\s*['"]([^'"]+)['"]\s*\))"""
)

SKIP_DIR_NAMES = {".git", "node_modules", "dist", "build", "coverage", "__pycache__"}
CODE_SUFFIXES = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}

RULE_PACKAGE_DEEP_IMPORT = "package-deep-import"
RULE_SERVICE_DEEP_IMPORT = "service-deep-import"
RULE_UNDECLARED_PACKAGE_EXPORT = "package-undeclared-export"
RULE_ECONOMIC_AUTHORITY_DAG = "economic-authority-dag"
RULE_PACKAGE_IMPORTS_SERVICE = "package-imports-service"

# Information / observation layers — must not reverse-import execution authority.
INFORMATION_LAYER_PREFIXES = (
    "packages/economic-awareness-fabric/",
    "packages/sunrey-chain/src/economic-awareness-fabric/",
    "packages/sunrey-chain/src/economic-proof/",
)

# Execution / monetary authority targets forbidden from information layers.
FORBIDDEN_EXECUTION_TARGETS = (
    "packages/ledger/",
    "packages/permissions/",
    "packages/sunrey-coin/",
    "packages/custody/",
    "packages/payments/src/journals",
    "packages/sunrey-chain/src/economics/",
    "packages/sunrey-chain/src/productive/policy-governance/value-settlement/",
    "packages/sunrey-chain/src/productive/policy-governance/value-function/",
    "services/accounts/",
)


@dataclass(frozen=True)
class BoundaryViolation:
    file: str
    line: int
    rule: str
    message: str
    source_package: str | None
    target_package: str | None
    spec: str

    def key(self) -> str:
        return f"{self.file}:{self.line}:{self.rule}:{self.spec}"

    def to_dict(self) -> dict[str, str | int | None]:
        return {
            "file": self.file,
            "line": self.line,
            "rule": self.rule,
            "message": self.message,
            "sourcePackage": self.source_package,
            "targetPackage": self.target_package,
            "spec": self.spec,
        }


def package_name_from_path(path: Path, packages_root: Path) -> str | None:
    try:
        rel = path.relative_to(packages_root)
    except ValueError:
        return None
    parts = rel.parts
    return parts[0] if parts else None


def service_name_from_path(path: Path, services_root: Path) -> str | None:
    try:
        rel = path.relative_to(services_root)
    except ValueError:
        return None
    parts = rel.parts
    return parts[0] if parts else None


def _resolve_file_candidate(candidate: Path) -> Path | None:
    if candidate.is_file():
        return candidate
    for ext in (".ts", ".tsx", ".js", ".mjs", ".cjs"):
        with_ext = Path(f"{candidate}{ext}")
        if with_ext.is_file():
            return with_ext
    if candidate.is_dir():
        for name in ("index.ts", "index.js", "index.mjs"):
            index = candidate / name
            if index.is_file():
                return index
    return None


def load_package_exports_map(root: Path) -> dict[str, dict[str, str]]:
    exports_map: dict[str, dict[str, str]] = {}
    packages_root = root / "packages"
    if not packages_root.exists():
        return exports_map
    for package_dir in packages_root.iterdir():
        if not package_dir.is_dir():
            continue
        package_json = package_dir / "package.json"
        if not package_json.is_file():
            continue
        data = json.loads(package_json.read_text(encoding="utf-8"))
        exports = data.get("exports")
        if isinstance(exports, dict):
            exports_map[package_dir.name] = exports
    return exports_map


def is_declared_public_export(spec: str, exports_map: dict[str, dict[str, str]]) -> bool:
    """True when `@solstice/<pkg>` or a declared export subpath is used."""
    if not spec.startswith("@solstice/"):
        return False
    rest = spec[len("@solstice/") :]
    if "/src/" in f"/{rest}/":
        return False
    parts = rest.split("/")
    if not parts or not parts[0]:
        return False
    pkg = parts[0]
    pkg_exports = exports_map.get(pkg)
    if pkg_exports is None:
        return False
    if len(parts) == 1:
        return "." in pkg_exports
    export_key = f"./{'/'.join(parts[1:])}"
    return export_key in pkg_exports


def resolve_import_spec(importing_file: Path, spec: str, root: Path) -> Path | None:
    normalized = spec.replace("\\", "/")
    if normalized.startswith("node:"):
        return None

    packages_root = root / "packages"

    if normalized.startswith("@solstice/"):
        rest = normalized[len("@solstice/") :]
        parts = rest.split("/")
        if not parts or not parts[0]:
            return None
        pkg = parts[0]
        if len(parts) == 1:
            return _resolve_file_candidate(packages_root / pkg / "src" / "index")
        if parts[1] == "src":
            subpath = "/".join(parts[2:]) if len(parts) > 2 else ""
            return _resolve_file_candidate(packages_root / pkg / "src" / subpath)
        return _resolve_file_candidate(packages_root / pkg / "/".join(parts[1:]))

    if normalized.startswith("."):
        importing_resolved = importing_file.resolve()
        raw = (importing_resolved.parent / normalized).resolve()
        return _resolve_file_candidate(raw)

    return None


def is_deep_package_target(target_rel: str) -> bool:
    return target_rel.startswith("packages/") and "/src/" in target_rel


def is_information_layer_file(file_rel: str) -> bool:
    return any(file_rel.startswith(prefix) for prefix in INFORMATION_LAYER_PREFIXES)


def is_forbidden_execution_target(target_rel: str) -> bool:
    return any(target_rel.startswith(prefix) for prefix in FORBIDDEN_EXECUTION_TARGETS)


def is_test_or_demo(path: Path) -> bool:
    name = path.name.lower()
    parts = {part.lower() for part in path.parts}
    return (
        name.endswith(".test.ts")
        or name.endswith(".test.tsx")
        or name.endswith(".test.js")
        or name.endswith(".spec.ts")
        or name == "demo.ts"
        or "tests" in parts
    )


def iter_package_source_files(packages_root: Path) -> Iterable[Path]:
    if not packages_root.exists():
        return
    for package_dir in sorted(packages_root.iterdir()):
        if not package_dir.is_dir():
            continue
        for path in package_dir.rglob("*"):
            if not path.is_file() or path.suffix not in CODE_SUFFIXES:
                continue
            if any(part in SKIP_DIR_NAMES for part in path.parts):
                continue
            yield path


def iter_service_source_files(services_root: Path) -> Iterable[Path]:
    if not services_root.exists():
        return
    for path in services_root.rglob("*"):
        if not path.is_file() or path.suffix not in CODE_SUFFIXES:
            continue
        if any(part in SKIP_DIR_NAMES for part in path.parts):
            continue
        yield path


def scan_file_imports(
    root: Path,
    path: Path,
    file_rel: str,
    source_label: str | None,
    deep_import_rule: str,
    exports_map: dict[str, dict[str, str]],
    is_package_source: bool,
) -> list[BoundaryViolation]:
    packages_root = root / "packages"
    is_test = is_test_or_demo(path)
    text = path.read_text(encoding="utf-8")
    violations: list[BoundaryViolation] = []

    for match in IMPORT_RE.finditer(text):
        spec = (match.group(1) or match.group(2) or match.group(3) or "").replace("\\", "/")
        if not spec:
            continue
        line = text.count("\n", 0, match.start()) + 1

        if is_package_source and not is_test and (spec.startswith("services/") or "/services/" in spec):
            violations.append(
                BoundaryViolation(
                    file=file_rel,
                    line=line,
                    rule=RULE_PACKAGE_IMPORTS_SERVICE,
                    message=f"package '{source_label}' imports service module '{spec}'",
                    source_package=source_label,
                    target_package=None,
                    spec=spec,
                )
            )

        if spec.startswith("@solstice/"):
            rest = spec[len("@solstice/") :]
            if "/src/" in f"/{rest}/":
                target = resolve_import_spec(path, spec, root)
                if target is not None:
                    try:
                        target_rel = target.relative_to(root).as_posix()
                    except ValueError:
                        target_rel = None
                    if target_rel and is_deep_package_target(target_rel):
                        target_pkg = package_name_from_path(target, packages_root)
                        if target_pkg and (not is_package_source or target_pkg != source_label):
                            violations.append(
                                BoundaryViolation(
                                    file=file_rel,
                                    line=line,
                                    rule=deep_import_rule,
                                    message=(
                                        f"'{file_rel}' deep-imports '{target_pkg}' internals via '{spec}'"
                                    ),
                                    source_package=source_label,
                                    target_package=target_pkg,
                                    spec=spec,
                                )
                            )
                continue
            if not is_declared_public_export(spec, exports_map):
                parts = rest.split("/")
                pkg = parts[0] if parts else "unknown"
                violations.append(
                    BoundaryViolation(
                        file=file_rel,
                        line=line,
                        rule=RULE_UNDECLARED_PACKAGE_EXPORT,
                        message=f"'{file_rel}' imports undeclared package export '{spec}'",
                        source_package=source_label,
                        target_package=pkg,
                        spec=spec,
                    )
                )
            continue

        target = resolve_import_spec(path, spec, root)
        if target is None:
            continue
        try:
            target_rel = target.relative_to(root).as_posix()
        except ValueError:
            continue

        if is_information_layer_file(file_rel) and is_forbidden_execution_target(target_rel):
            violations.append(
                BoundaryViolation(
                    file=file_rel,
                    line=line,
                    rule=RULE_ECONOMIC_AUTHORITY_DAG,
                    message=(
                        f"information layer '{file_rel}' must not import execution authority "
                        f"target '{target_rel}'"
                    ),
                    source_package=source_label,
                    target_package=package_name_from_path(target, packages_root),
                    spec=spec,
                )
            )

        if not is_deep_package_target(target_rel):
            continue

        target_pkg = package_name_from_path(target, packages_root)
        if target_pkg is None:
            continue
        if is_package_source and target_pkg == source_label:
            continue

        violations.append(
            BoundaryViolation(
                file=file_rel,
                line=line,
                rule=deep_import_rule,
                message=f"'{file_rel}' deep-imports '{target_pkg}' internals via '{spec}'",
                source_package=source_label,
                target_package=target_pkg,
                spec=spec,
            )
        )

    return violations


def scan_package_boundaries(root: Path) -> list[BoundaryViolation]:
    root = root.resolve()
    packages_root = root / "packages"
    services_root = root / "services"
    exports_map = load_package_exports_map(root)
    violations: list[BoundaryViolation] = []

    for path in iter_package_source_files(packages_root):
        source_pkg = package_name_from_path(path, packages_root)
        if source_pkg is None:
            continue
        file_rel = path.relative_to(root).as_posix()
        violations.extend(
            scan_file_imports(
                root,
                path,
                file_rel,
                source_pkg,
                RULE_PACKAGE_DEEP_IMPORT,
                exports_map,
                is_package_source=True,
            )
        )

    for path in iter_service_source_files(services_root):
        source_svc = service_name_from_path(path, services_root)
        if source_svc is None:
            continue
        file_rel = path.relative_to(root).as_posix()
        violations.extend(
            scan_file_imports(
                root,
                path,
                file_rel,
                source_svc,
                RULE_SERVICE_DEEP_IMPORT,
                exports_map,
                is_package_source=False,
            )
        )

    deduped: dict[str, BoundaryViolation] = {}
    for v in violations:
        deduped.setdefault(v.key(), v)
    return sorted(deduped.values(), key=lambda v: (v.file, v.line, v.rule, v.spec))


def load_baseline(path: Path) -> set[str]:
    if not path.exists():
        return set()
    data = json.loads(path.read_text(encoding="utf-8"))
    keys: set[str] = set()
    for item in data.get("violations", []):
        file = item["file"]
        line = item["line"]
        rule = item["rule"]
        spec = item["spec"]
        keys.add(f"{file}:{line}:{rule}:{spec}")
    return keys


def build_dependency_inventory(root: Path, violations: list[BoundaryViolation]) -> dict:
    packages_root = root / "packages"
    package_dirs = sorted(p.name for p in packages_root.iterdir() if p.is_dir()) if packages_root.exists() else []
    edges: dict[str, set[str]] = {name: set() for name in package_dirs}

    package_deep = [v for v in violations if v.rule == RULE_PACKAGE_DEEP_IMPORT]
    service_deep = [v for v in violations if v.rule == RULE_SERVICE_DEEP_IMPORT]
    undeclared = [v for v in violations if v.rule == RULE_UNDECLARED_PACKAGE_EXPORT]
    relative = [v for v in package_deep if v.spec.startswith(".")]
    alias = [
        v
        for v in violations
        if v.rule in {RULE_PACKAGE_DEEP_IMPORT, RULE_SERVICE_DEEP_IMPORT, RULE_UNDECLARED_PACKAGE_EXPORT}
        and v.spec.startswith("@solstice/")
    ]

    for v in package_deep:
        if v.source_package and v.target_package:
            edges.setdefault(v.source_package, set()).add(v.target_package)

    dag = [v for v in violations if v.rule == RULE_ECONOMIC_AUTHORITY_DAG]

    return {
        "totalPackages": len(package_dirs),
        "packageNames": package_dirs,
        "dependencyEdges": {k: sorted(v) for k, v in sorted(edges.items()) if v},
        "violationCounts": {
            "packageDeepImport": len(package_deep),
            "serviceDeepImport": len(service_deep),
            "undeclaredPackageExport": len(undeclared),
            "relativeCrossPackage": len(relative),
            "aliasDeepImport": len(alias),
            "economicAuthorityDag": len(dag),
            "packageImportsService": sum(1 for v in violations if v.rule == RULE_PACKAGE_IMPORTS_SERVICE),
            "total": len(violations),
        },
    }


def write_baseline(path: Path, root: Path, violations: list[BoundaryViolation]) -> None:
    inventory = build_dependency_inventory(root, violations)
    payload = {
        "version": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "inventory": inventory,
        "violations": [v.to_dict() for v in violations if v.rule != RULE_ECONOMIC_AUTHORITY_DAG],
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def check_against_baseline(
    violations: list[BoundaryViolation],
    baseline_keys: set[str],
) -> tuple[list[BoundaryViolation], list[BoundaryViolation], set[str]]:
    """Return (new_violations, economic_dag_violations, non_dag_keys)."""
    economic = [v for v in violations if v.rule == RULE_ECONOMIC_AUTHORITY_DAG]
    non_dag_keys = {v.key() for v in violations if v.rule != RULE_ECONOMIC_AUTHORITY_DAG}
    new: list[BoundaryViolation] = []
    for v in violations:
        if v.rule == RULE_ECONOMIC_AUTHORITY_DAG:
            continue
        if v.key() not in baseline_keys:
            new.append(v)
    return new, economic, non_dag_keys
