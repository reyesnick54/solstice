# Auditor reproduction environment

One command builds enough isolated, test-only infrastructure to
reproduce critical results:

```bash
npm run sunrey-audit -- reproduce
```

It uses:

- test-only keys (`FIXTURE_KEY_MARKER` / local ReleaseAuthority)
- local/testnet assets (`net_sunrey_testnet_1`)
- isolated in-process services
- pinned lockfiles (`package-lock.json`, Rust and node `Cargo.lock`)

No production secrets are loaded.

## Full smoke (optional)

```bash
npm run sunrey-audit -- reproduce --full
```

That additionally runs:

- `npm run test:fuzz-smoke`
- `npm run sunrey-range -- campaign --smoke`
- `npm run sunrey-bench -- sanity`

## Related commands

```bash
SUNREY_FIXTURE_ENV=local npm run sunrey-testnet -- bootstrap
npm run sunrey-explorer -- verify
npm run sunrey-release -- verify
```
