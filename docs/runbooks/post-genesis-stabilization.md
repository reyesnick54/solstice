# Post-genesis stabilization runbook

Environment: rehearsal / simulation only.

1. Confirm `ENVIRONMENT=simulation` and every `LIVE_*` flag remains false.
2. Run `sunrey-mainnet stabilization status`.
3. Capture a protocol checkpoint:
   `sunrey-mainnet stabilization checkpoint <height> <epoch> <finalizedStateRoot>`.
4. Run `sunrey-mainnet stabilization audit` for supply, validator
   economics, fee market, MoonRey, and treasury.
5. Treat conflicting finality as a critical protocol incident. Do not
   classify it as availability noise. Do not rewrite finalized blocks.
6. Verify backups on an isolated clone. Do not restore onto the active
   network.
7. Keep high-risk financial capabilities independently disabled until
   each has its own accepted capability package.

`realProductionCapabilitiesActivated` remains false in CI.
