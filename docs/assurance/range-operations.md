# SunRey adversarial range operations

The range is local/testnet only. Credentials and assets are
development fixtures. Do not point it at external hosts.

## Environment

`createRangeEnvironment(seed)` builds:

- 7 equal-power validators (`val_range_a` … `val_range_g`)
- sentries (signing disabled)
- RPC, Explorer, faucet
- Exchange and custody simulation
- oracle providers (including a shared-controller pair used only to
  surface concentration warnings)
- machine actors and an isolated relayer
- observability (alerts, metrics, security log)

Set `SUNREY_FIXTURE_ENV=local` so testnet genesis stays on the
development fixture path.

## Commands

```
sunrey-range run
sunrey-range scenario <id>
sunrey-range campaign
sunrey-range campaign --smoke
sunrey-range report
sunrey-range replay [id]
```

Red actions are deterministic in-process actors. Blue is the current
SunRey control and alert surface.

## Evidence

Campaign artifacts land under `artifacts/sunrey-range/`. Each record
links:

- scenario id
- source commit
- testnet genesis hash
- results, invariants, alerts, recovery

Secret fields (`privateKey`, mnemonic, raw KYC/PDV, HSM material,
private mandate fields) are stripped. Historical evidence is
preserved across recovery paths (rotation, freeze, reconcile, hold).

## Recovery catalog

| Kind | Typical scenarios |
| --- | --- |
| VALIDATOR_ROTATION | BFT equivocation / power-boundary liveness |
| SIGNER_FENCING | compromise, rollback, regional compound |
| WALLET_RECOVERY / KEY_ROTATION | delegated-key abuse, multi-sig rotation |
| ORACLE_SUSPENSION | manipulation and concentration warnings |
| SNAPSHOT_RESTORE | graph tamper, network partition |
| EXCHANGE_RECONCILIATION | settlement attacks and compound backlog |
| CUSTODY_SECURITY_HOLD | dual-control and destination attacks |
| INTEROP_CLIENT_FREEZE | malicious relayer / conservation races |

## Out of scope

Live internet scanning, production payment providers, mainnet, and
legal-guilt labeling. Those scorecard categories stay `OUT_OF_SCOPE`.
