# Runbook — MoonRey economic verification

Simulation / development only. Do not contact live energy, compute,
or manufacturing providers. Do not invent a public ticker.

## Verify a productive claim

```
sunrey-node productive object --data-dir <dir> [--id <objectId>]
sunrey-node productive claim --data-dir <dir>
sunrey-node productive verify --data-dir <dir> --id <claimId>
sunrey-node productive contribution --data-dir <dir> [--id <id>]
sunrey-node productive lineage --data-dir <dir> --id <contributionId>
sunrey-node productive graph --data-dir <dir>
```

TypeScript demo:

```
npm run demo:moonrey-productive
```

## Inspect issuance

```
sunrey-node moonrey policy --data-dir <dir>
sunrey-node moonrey issuance --data-dir <dir> [--id <issuanceId>]
sunrey-node moonrey attribution --data-dir <dir>
```

Confirm:

- receipt formula inputs reproduce the MoonRey quantity
- `issued − burned = holdings`
- duplicate claim / fingerprint is rejected
- capacity and delivery are not treated as independent output
  under the active development policy

## Required demos

1. Energy — solar facility, three-oracle output, issuance, supply
   reconcile, duplicate rejected, four validators agree.
2. Compute — GPU / AI cluster usage → contribution → issuance
   attribution.
3. Manufacturing — capacity, output, and delivery represented;
   policy does not sum them as 2,300 equivalent units.

## Incident notes

- Do not rewrite finalized issuance when later oracle data changes.
  File a correction record.
- Do not treat graph lag or a deleted graph as loss of blockchain
  state. Rebuild the projection.
- Do not enable `LIVE_*` flags or change `ENVIRONMENT`.
