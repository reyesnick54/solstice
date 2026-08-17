#!/usr/bin/env bash
# Launch the SunRey developer environment: RPC, events, faucet, Exchange.
set -euo pipefail
cd "$(dirname "$0")/.."
exec npm run sunrey:dev
