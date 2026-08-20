#!/usr/bin/env python3
"""Architectural invariant linter for SunRey.

Reports every violation as: <path>:<line>: <RULE>: <message>
Exit status 1 if any violation is found.

This is the single architectural invariant linter. Do not add a second one.
Phase 0 baseline rules and Phase 1 extensions live here together.
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

SKIP_DIR_NAMES = {
    ".git",
    "node_modules",
    "dist",
    "build",
    "coverage",
    "__pycache__",
}

CODE_SUFFIXES = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".sql"}

MONEY_PATH_HINTS = (
    "money",
    "ledger",
    "journal",
    "posting",
    "deposit",
    "balance",
    "currency",
    "fx",
    "exchange",
    "attribution",
    "growth",
    "wealth",
    "settlement",
    "transfer",
    "withdraw",
    "payment",
)

GROWTH_OR_BALANCE_HINTS = (
    "growth",
    "attribution",
    "balance",
    "position",
    "wealth",
    "yield",
    "read-model",
    "read_model",
    "readmodel",
)

AUTHORIZED_JOURNAL_PATH_HINTS = (
    "/ledger/",
    "/compliance-kernel/",
    "/kernel/",
    "/execution-authority/",
    "/authority/",
)

AUTHORIZED_JOURNAL_FILENAMES = {
    "journal.ts",
    "journal.js",
    "journals.ts",
    "ledger.ts",
    "ledger.js",
    "banking-operations.ts",
}

LIVE_FLAG_NAMES = (
    "REAL_MONEY_ENABLED",
    "LIVE_TRADING_ENABLED",
    "LIVE_CRYPTO_ENABLED",
    "LIVE_EXCHANGE_ENABLED",
    "LIVE_DATA_MARKET_ENABLED",
)

ACCOUNT_CONSTRUCT_RE = re.compile(
    r"""(?x)
    (?<![A-Za-z0-9_])
    (?:
        new\s+Account
        | Account\s*\.\s*(?:create|open|construct|build|new)
        | (?:createAccount|openAccount|constructAccount|buildAccount|openCustomerAccount)
    )
    \s*\(
    """
)

JOURNAL_WRITE_CALL_RE = re.compile(
    r"""(?x)
    (?<![A-Za-z0-9_])
    (?:
        postJournal | writeJournal | appendJournal | commitJournal | recordJournal
        | insertJournal | persistJournal | saveJournal
    )
    \s*\(
    """
)

JOURNAL_DIRECT_WRITE_RE = re.compile(
    r"""(?x)
    (?<![A-Za-z0-9_])
    (?:
        journals | journalEntries | postings | ledgerPostings | postingStore
    )
    \s*\.\s*(?:push|unshift|splice|insert|add|set|put|write|append)\s*\(
    """
)

SQL_LEDGER_WRITE_RE = re.compile(
    r"(?i)\binsert\s+into\s+(?:\w+\.)?(journal|posting|ledger_posting|ledger)\b"
)

ACCOUNT_TYPE_RE = re.compile(
    r"(?:export\s+)?(?:type|interface|class)\s+Account\b(?![A-Za-z0-9_])"
)

ACCOUNT_BALANCE_FIELD_RE = re.compile(
    r"(?m)^\s*(?:readonly\s+|public\s+|private\s+|protected\s+|static\s+)*(?:#)?balance\b\s*[?!]?\s*[:=]"
)

SQL_ACCOUNT_BALANCE_RE = re.compile(
    r"(?i)\bcreate\s+table\s+(?:\w+\.)?accounts?\b[\s\S]{0,2000}?\bbalance\b"
)

YIELD_IDENTIFIER_RE = re.compile(
    r"""(?x)
    (?<![A-Za-z0-9_])
    (
        blendedReturn | blended_return | blendedYield | blended_yield
        | yieldRate | yield_rate | percentReturn | percent_return
        | returnPercentage | return_percentage | annualizedReturn | annualized_return
        | growthRate | growth_rate | blendedApy | blendedAPY | blendedApr | blendedAPR
        | \bAPY\b | \bAPR\b | \bROI\b | roiPercent | apyRate | aprRate
    )
    (?![A-Za-z0-9_])
    """
)

FLOAT_CALL_RE = re.compile(
    r"(?<![A-Za-z0-9_])(?:parseFloat|Number\s*\.\s*parseFloat)\s*\("
)

FLOAT_LITERAL_RE = re.compile(r"(?<![A-Za-z0-9_])\d+\.\d+(?:[eE][+-]?\d+)?")

MONEY_TYPED_AS_NUMBER_RE = re.compile(
    r"(?<![A-Za-z0-9_])(?:amount|balance|money|cents|debit|credit|principal|minorUnits|minor_units)\s*\??\s*:\s*number\b"
)

SERVICES_IMPORT_RE = re.compile(
    r"""(?:from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))"""
)

DOMAIN_INFRA_IMPORT_RE = re.compile(
    r"""from\s+['"](node:fs|node:http|node:net|fs|http|net|express|pg|postgres|sqlite|prisma)['"]"""
)

LIVE_FLAG_TRUE_RE = re.compile(
    r"\b(" + "|".join(LIVE_FLAG_NAMES) + r")\b\s*=\s*true\b"
)

AUTHORITY_HINT_RE = re.compile(
    r"ExecutionAuthority|executionAuthority|execution_authority|VerifiedExecutionAuthority|PostJournalRequest"
)


@dataclass(frozen=True)
class Violation:
    path: Path
    line: int
    rule: str
    message: str

    def format(self) -> str:
        rel = self.path.relative_to(ROOT).as_posix()
        return f"{rel}:{self.line}: {self.rule}: {self.message}"


def iter_code_files() -> list[Path]:
    files: list[Path] = []
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        if any(part in SKIP_DIR_NAMES for part in path.parts):
            continue
        if path.suffix not in CODE_SUFFIXES:
            continue
        files.append(path)
    return sorted(files)


def _scan_js(source: str, *, blank_comments: bool, blank_strings: bool) -> str:
    """Rewrite comments and/or string contents to spaces; keep newlines."""
    out: list[str] = []
    i = 0
    n = len(source)
    in_sq = in_dq = in_bt = False
    in_line = in_block = False
    while i < n:
        ch = source[i]
        nxt = source[i + 1] if i + 1 < n else ""
        if in_line:
            if ch == "\n":
                in_line = False
                out.append(ch)
            else:
                out.append(" " if blank_comments else ch)
            i += 1
            continue
        if in_block:
            if ch == "*" and nxt == "/":
                out.append("  " if blank_comments else "*/")
                i += 2
                in_block = False
                continue
            out.append("\n" if ch == "\n" else (" " if blank_comments else ch))
            i += 1
            continue
        if in_sq or in_dq or in_bt:
            closer = "'" if in_sq else '"' if in_dq else "`"
            if ch == "\\" and i + 1 < n:
                out.append("  " if blank_strings else ch + source[i + 1])
                i += 2
                continue
            if ch == closer:
                in_sq = in_dq = in_bt = False
                out.append(ch)
                i += 1
                continue
            out.append("\n" if ch == "\n" else (" " if blank_strings else ch))
            i += 1
            continue
        if ch == "/" and nxt == "/":
            in_line = True
            out.append("  " if blank_comments else "//")
            i += 2
            continue
        if ch == "/" and nxt == "*":
            in_block = True
            out.append("  " if blank_comments else "/*")
            i += 2
            continue
        if ch == "'":
            in_sq = True
            out.append(ch)
            i += 1
            continue
        if ch == '"':
            in_dq = True
            out.append(ch)
            i += 1
            continue
        if ch == "`":
            in_bt = True
            out.append(ch)
            i += 1
            continue
        out.append(ch)
        i += 1
    return "".join(out)


def strip_js_comments_preserve_lines(source: str) -> str:
    return _scan_js(source, blank_comments=True, blank_strings=False)


def strip_js_comments_and_strings(source: str) -> str:
    return _scan_js(source, blank_comments=True, blank_strings=True)


def line_number_at(source: str, index: int) -> int:
    return source.count("\n", 0, index) + 1


def extract_paren_group(source: str, open_paren_index: int) -> str | None:
    if open_paren_index >= len(source) or source[open_paren_index] != "(":
        return None
    depth = 0
    i = open_paren_index
    while i < len(source):
        ch = source[i]
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth == 0:
                return source[open_paren_index : i + 1]
        i += 1
    return None


def extract_brace_group(source: str, open_brace_index: int) -> str | None:
    if open_brace_index >= len(source) or source[open_brace_index] != "{":
        return None
    depth = 0
    i = open_brace_index
    while i < len(source):
        ch = source[i]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return source[open_brace_index : i + 1]
        i += 1
    return None


def path_is_test(path: Path) -> bool:
    parts = {p.lower() for p in path.parts}
    name = path.name.lower()
    return (
        "tests" in parts
        or name.endswith(".test.ts")
        or name.endswith(".test.js")
        or name.endswith(".spec.ts")
        or name.endswith(".spec.js")
        or name.endswith(".test.tsx")
    )


def path_looks_like(path: Path, hints: tuple[str, ...]) -> bool:
    needle = path.as_posix().lower()
    return any(hint in needle for hint in hints)


def is_authorized_journal_file(path: Path) -> bool:
    posix = "/" + path.relative_to(ROOT).as_posix().lower()
    if path.name.lower() in AUTHORIZED_JOURNAL_FILENAMES:
        return True
    return any(hint in posix for hint in AUTHORIZED_JOURNAL_PATH_HINTS)


def is_flag_source_of_truth(path: Path) -> bool:
    rel = path.relative_to(ROOT).as_posix().lower()
    return rel in {
        "config/capabilities.ts",
        "src/flags/capabilities.ts",
        "packages/flags/src/capabilities.ts",
        "packages/config/src/flags.ts",
    } or rel.endswith("/capabilities.ts")


def has_authority_argument(args: str) -> bool:
    return AUTHORITY_HINT_RE.search(args) is not None


def check_account_requires_authority(path: Path, source: str) -> list[Violation]:
    violations: list[Violation] = []
    for match in ACCOUNT_CONSTRUCT_RE.finditer(source):
        open_paren = source.find("(", match.start())
        args = extract_paren_group(source, open_paren)
        if args is None:
            args = source[match.start() : match.end() + 80]
        if has_authority_argument(args):
            continue
        violations.append(
            Violation(
                path,
                line_number_at(source, match.start()),
                "ACCOUNT_REQUIRES_EXECUTION_AUTHORITY",
                "Account is constructed without an Execution Authority argument",
            )
        )
    return violations


def check_journal_authorized_path(path: Path, source: str) -> list[Violation]:
    if path_is_test(path):
        return []
    violations: list[Violation] = []
    authorized_file = is_authorized_journal_file(path)

    for match in JOURNAL_WRITE_CALL_RE.finditer(source):
        # Function definitions that implement the authorized sink are allowed
        # only inside the ledger/kernel path, and they must take Authority.
        prefix = source[max(0, match.start() - 80) : match.start()]
        is_definition = bool(
            re.search(r"(?:function|const|let|var|export|async)\s*$", prefix.rstrip())
            or re.search(r"\b(?:function|async)\s+$", prefix)
            or re.search(r"=\s*$", prefix)
        )
        open_paren = source.find("(", match.start())
        args = extract_paren_group(source, open_paren) or ""
        if is_definition:
            if not authorized_file:
                violations.append(
                    Violation(
                        path,
                        line_number_at(source, match.start()),
                        "LEDGER_JOURNAL_AUTHORIZED_PATH",
                        "Ledger journal writer defined outside the authorized execution path",
                    )
                )
            elif not has_authority_argument(args):
                violations.append(
                    Violation(
                        path,
                        line_number_at(source, match.start()),
                        "LEDGER_JOURNAL_AUTHORIZED_PATH",
                        "Journal writer in the authorized path must take an Execution Authority argument",
                    )
                )
            continue
        if not has_authority_argument(args):
            violations.append(
                Violation(
                    path,
                    line_number_at(source, match.start()),
                    "LEDGER_JOURNAL_AUTHORIZED_PATH",
                    "Ledger journal written without an Execution Authority argument",
                )
            )

    if not authorized_file:
        for match in JOURNAL_DIRECT_WRITE_RE.finditer(source):
            violations.append(
                Violation(
                    path,
                    line_number_at(source, match.start()),
                    "LEDGER_JOURNAL_AUTHORIZED_PATH",
                    "Direct journal/posting mutation outside the authorized execution path",
                )
            )
        for match in SQL_LEDGER_WRITE_RE.finditer(source):
            violations.append(
                Violation(
                    path,
                    line_number_at(source, match.start()),
                    "LEDGER_JOURNAL_AUTHORIZED_PATH",
                    "SQL insert into ledger/journal/posting outside the authorized execution path",
                )
            )
    return violations


def check_no_persisted_account_balance(path: Path, source: str) -> list[Violation]:
    violations: list[Violation] = []
    for match in ACCOUNT_TYPE_RE.finditer(source):
        brace_at = source.find("{", match.end())
        if brace_at == -1:
            continue
        body = extract_brace_group(source, brace_at)
        if body is None:
            continue
        field = ACCOUNT_BALANCE_FIELD_RE.search(body)
        if field:
            violations.append(
                Violation(
                    path,
                    line_number_at(source, brace_at + field.start()),
                    "NO_PERSISTED_ACCOUNT_BALANCE",
                    "Balance stored as a persisted field on an Account entity",
                )
            )
    if path.suffix == ".sql":
        for match in SQL_ACCOUNT_BALANCE_RE.finditer(source):
            violations.append(
                Violation(
                    path,
                    line_number_at(source, match.start()),
                    "NO_PERSISTED_ACCOUNT_BALANCE",
                    "Balance stored as a persisted column on an account table",
                )
            )
    return violations


def check_no_blended_yield(path: Path, source: str) -> list[Violation]:
    if not path_looks_like(path, GROWTH_OR_BALANCE_HINTS):
        return []
    violations: list[Violation] = []
    for match in YIELD_IDENTIFIER_RE.finditer(source):
        violations.append(
            Violation(
                path,
                line_number_at(source, match.start()),
                "NO_BLENDED_YIELD_IDENTIFIER",
                f"Identifier '{match.group(1)}' suggests a blended return or yield rate in a growth-attribution or balance read path",
            )
        )
    return violations


def check_no_float_in_money_path(path: Path, source: str) -> list[Violation]:
    if not path_looks_like(path, MONEY_PATH_HINTS):
        return []
    violations: list[Violation] = []
    for match in FLOAT_CALL_RE.finditer(source):
        violations.append(
            Violation(
                path,
                line_number_at(source, match.start()),
                "NO_FLOAT_IN_MONEY_PATH",
                "Floating-point arithmetic (parseFloat) appears in a money path",
            )
        )
    for match in FLOAT_LITERAL_RE.finditer(source):
        violations.append(
            Violation(
                path,
                line_number_at(source, match.start()),
                "NO_FLOAT_IN_MONEY_PATH",
                f"Floating-point literal '{match.group(0)}' appears in a money path",
            )
        )
    for match in MONEY_TYPED_AS_NUMBER_RE.finditer(source):
        violations.append(
            Violation(
                path,
                line_number_at(source, match.start()),
                "NO_FLOAT_IN_MONEY_PATH",
                "Money amount typed as floating-point number in a money path",
            )
        )
    return violations


def check_subsystem_boundary(path: Path, raw_source: str) -> list[Violation]:
    rel = path.relative_to(ROOT).as_posix()
    if not rel.startswith("packages/"):
        return []
    violations: list[Violation] = []
    for match in SERVICES_IMPORT_RE.finditer(raw_source):
        spec = match.group(1) or match.group(2) or ""
        if "services/" in spec.replace("\\", "/") or spec.startswith("@solstice/services"):
            violations.append(
                Violation(
                    path,
                    line_number_at(raw_source, match.start()),
                    "SUBSYSTEM_BOUNDARY",
                    f"Package imports a service module ('{spec}'); packages must not depend on services",
                )
            )
    if rel.startswith("packages/domain/"):
        for match in DOMAIN_INFRA_IMPORT_RE.finditer(raw_source):
            violations.append(
                Violation(
                    path,
                    line_number_at(raw_source, match.start()),
                    "SUBSYSTEM_BOUNDARY",
                    f"Domain package imports infrastructure module '{match.group(1)}'",
                )
            )
    return violations


def check_live_flag_assignment(path: Path, source: str) -> list[Violation]:
    if is_flag_source_of_truth(path):
        return []
    violations: list[Violation] = []
    for match in LIVE_FLAG_TRUE_RE.finditer(source):
        violations.append(
            Violation(
                path,
                line_number_at(source, match.start()),
                "NO_LIVE_FLAG_ASSIGNMENT",
                f"{match.group(1)} is assigned true outside the capability-flag source of truth",
            )
        )
    return violations


def lint_file(path: Path) -> list[Violation]:
    rel = path.relative_to(ROOT).as_posix()
    # The TypeScript architectural linter embeds violation fixtures as strings.
    if rel.startswith("tools/architectural-linter/"):
        return []
    raw = path.read_text(encoding="utf-8")
    if path.suffix == ".sql":
        stripped = raw
        code_only = raw
    else:
        stripped = strip_js_comments_preserve_lines(raw)
        code_only = strip_js_comments_and_strings(raw)
    violations: list[Violation] = []
    if not path_is_test(path) and path.name != "demo.ts":
        violations.extend(check_subsystem_boundary(path, raw))
    violations.extend(check_live_flag_assignment(path, stripped))
    if not path_is_test(path):
        violations.extend(check_account_requires_authority(path, stripped))
    violations.extend(check_journal_authorized_path(path, stripped))
    violations.extend(check_no_persisted_account_balance(path, stripped))
    violations.extend(check_no_blended_yield(path, code_only))
    violations.extend(check_no_float_in_money_path(path, code_only))
    return violations


def main() -> int:
    all_violations: list[Violation] = []
    for path in iter_code_files():
        all_violations.extend(lint_file(path))
    all_violations.sort(key=lambda v: (v.path.as_posix(), v.line, v.rule))
    if all_violations:
        print("Architectural invariant violations:", file=sys.stderr)
        for violation in all_violations:
            print(violation.format(), file=sys.stderr)
        print(f"{len(all_violations)} violation(s)", file=sys.stderr)
        return 1
    print("Architectural invariants: ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
