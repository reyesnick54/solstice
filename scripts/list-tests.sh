#!/usr/bin/env bash
# Enumerate current-architecture tests. Skip leftover Phase 0 files that
# import vitest or the historical src/ tree (parameter properties / old runtime).
set -euo pipefail
cd "$(dirname "$0")/.."
find packages tests -name '*.test.ts' 2>/dev/null | sort | while read -r file; do
  if grep -qE "from ['\"]vitest['\"]" "$file"; then
    continue
  fi
  if grep -qE "from ['\"]\\.\\./src/" "$file"; then
    continue
  fi
  printf '%s\n' "$file"
done
