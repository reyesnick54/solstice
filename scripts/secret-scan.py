#!/usr/bin/env python3
"""High-confidence secret scan over repository files. No external service."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKIP_DIR_NAMES = {
    ".git",
    "node_modules",
    "build",
    "target",
    "__pycache__",
    "secret-scan-fixtures",
}
RELEASE_BUNDLE_DIR = "dist/testnet-release"
SKIP_SUFFIXES = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".woff", ".woff2"}
SKIP_PATH_PARTS = {"secret-scan-fixtures"}

PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("AWS access key", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("AWS secret access key assignment", re.compile(r"(?i)aws_secret_access_key\s*[:=]\s*['\"][A-Za-z0-9/+=]{30,}['\"]")),
    ("GitHub token", re.compile(r"\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b")),
    ("Google API key", re.compile(r"\bAIza[0-9A-Za-z\-_]{35}\b")),
    ("Slack token", re.compile(r"\bxox[baprs]-[0-9A-Za-z-]{10,}\b")),
    ("Private key block", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----")),
    ("Stripe live key", re.compile(r"\bsk_live_[0-9a-zA-Z]{16,}\b")),
    ("npm access token", re.compile(r"\bnpm_[A-Za-z0-9]{36,}\b")),
    ("Generic bearer token", re.compile(r"\bBearer [A-Za-z0-9._\-]{40,}\b")),
    ("Authorization Bearer literal", re.compile(r"(?i)authorization\s*[:=]\s*['\"]Bearer [A-Za-z0-9._\-]{16,}['\"]")),
    ("client_secret literal", re.compile(r"(?i)client_secret\s*[:=]\s*['\"][^'\"]{8,}['\"]")),
    ("api_key literal", re.compile(r"(?i)(?:api[_-]?key)\s*[:=]\s*['\"][A-Za-z0-9_\-]{16,}['\"]")),
    ("Database URL with password", re.compile(r"\b(?:postgres|mysql|mongodb)://[^:\s/]+:[^@\s/]{8,}@")),
]


def scan_text(text: str) -> list[tuple[str, int, str]]:
    hits: list[tuple[str, int, str]] = []
    for label, pattern in PATTERNS:
        for match in pattern.finditer(text):
            line = text.count("\n", 0, match.start()) + 1
            hits.append((label, line, match.group(0)[:24]))
    return hits


def should_skip(path: Path, root: Path) -> bool:
    if any(part in SKIP_DIR_NAMES or part in SKIP_PATH_PARTS for part in path.parts):
        return True
    if path.suffix.lower() in SKIP_SUFFIXES:
        return True
    try:
        rel = path.relative_to(root).as_posix()
    except ValueError:
        return False
    if rel.startswith("dist/") and not rel.startswith(RELEASE_BUNDLE_DIR):
        return True
    return "secret-scan-fixtures" in rel


def scan_tree(root: Path) -> list[str]:
    failures: list[str] = []
    for path in root.rglob("*"):
        if not path.is_file() or should_skip(path, root):
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        rel = path.relative_to(root).as_posix()
        for label, line, _snippet in scan_text(text):
            failures.append(f"{rel}:{line}: possible {label}")
    return failures


SELF_TEST_FIXTURES: list[tuple[str, str]] = [
    ("aws.txt", "aws_access_key_id = " + "AKIA" + "EXAMPLEKEY000000"),
    ("github.txt", "token = " + "ghp_" + ("x" * 36)),
    ("pem.txt", "-----BEGIN " + "RSA PRIVATE KEY-----\nMIIBOgIBAAJBAK8=\n-----END RSA PRIVATE KEY-----"),
    ("stripe.txt", "STRIPE_KEY=" + "sk_live_" + "testfixture00001"),
    ("dburl.txt", "DATABASE_URL=" + "postgres" + "://app:supersecretpass@localhost/db"),
    ("clientsecret.txt", "client_secret=" + "'" + ("fixturesecretvalue01") + "'"),
    ("apikey.txt", "api_key=" + "'" + ("fixtureapikeyvalue01") + "'"),
]


def run_self_test() -> int:
    missed: list[str] = []
    for name, body in SELF_TEST_FIXTURES:
        hits = scan_text(body)
        if not hits:
            missed.append(name)
    if missed:
        print("Secret scan self-test failed; no hit for:", ", ".join(missed), file=sys.stderr)
        return 1
    print("Secret scan self-test: ok")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Scan a tree for high-confidence secrets")
    parser.add_argument("--root", default=str(ROOT))
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args(argv)
    if args.self_test:
        return run_self_test()
    failures = scan_tree(Path(args.root))
    if failures:
        print("Secret scan failed:", file=sys.stderr)
        for item in failures:
            print(item, file=sys.stderr)
        return 1
    print("Secret scan: ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
