# Chunk 63 — SunRey Testnet release candidate

This document describes the Testnet release-candidate control system.

It is **TESTNET** work. It does not activate mainnet or production
financial services. Public tickers remain `NOT_ASSIGNED`. Explorer,
SDK, and config banners remain `SUNREY TESTNET`.

## Identity

Release candidates use versioned ids such as `SUNREY_TESTNET_RC_1`.
A new software candidate does **not** change Testnet 1 network
identity (`net_sunrey_testnet_1` / `chn_sunrey_testnet_1`) unless
genesis or network identity actually changes.

## Owner

Canonical owner: `packages/sunrey-chain/src/release-candidate`.

CLI:

```
npm run sunrey-release -- rc create --profile smoke
npm run sunrey-release -- rc qualify --profile smoke
npm run sunrey-release -- rc status
npm run sunrey-release -- rc verify
npm run sunrey-release -- rc compare
npm run sunrey-release -- rc supersede
```

Profiles:

- `smoke` — bounded PR/CI qualification
- `full` — complete current-repository qualification at the RC commit
- `endurance` — configurable extended workflow; never claims a multi-day
  run unless that duration actually completed

## Signing

Chunk 59 `ReleaseAuthority` signs the RC manifest, artifact digests,
SBOM, provenance, and qualification report. Software release approval
does not activate protocol change and is not Execution Authority.

## Formal and known limitations

Chunk 61 (formal verification) and Chunk 62 (known-security-limitation
register) were not merged on the `main` this work started from. The RC
attaches property/invariant smoke as the formal adapter and imports
Chunk 62's register when present. Builtin limitations remain visible
in release notes either way.

See [rc-qualification.md](./rc-qualification.md),
[rc-freeze-policy.md](./rc-freeze-policy.md),
[rc-upgrade-rehearsal.md](./rc-upgrade-rehearsal.md), and
[rc-known-limitations.md](./rc-known-limitations.md).
