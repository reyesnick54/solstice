# Oracle conflict response (simulation)

Simulation / local development only.

## What a conflict is

Registered providers materially disagree inside a feed window. The
deterministic policy marks the window `CONFLICTED`. The engine does
not choose the most convenient value.

Typical triggers:

- observation spread exceeds `maxObservationSpread`
- `QUORUM_MATCH` values are not identical
- `CATEGORICAL_QUORUM` is tied or below quorum
- `TRIMMED_MEDIAN` removes the entire window

## Immediate response

1. Query quality and the fact:

```
sunrey-node oracle quality --data-dir /tmp/sunrey-oracle
sunrey-node oracle facts --feed <feed_id> --data-dir /tmp/sunrey-oracle
```

2. Do not use the fact for new economic eligibility. Fail closed.

3. File an `OracleDispute` with a reason code and evidence
   commitment. AI must not unilaterally invalidate the fact.

4. If a provider is compromised, suspend or revoke it. That affects
   future observations only. Finalized history stays in place.

## After resolution

Governance may record a resolution reference on the dispute. A later
window can produce a new `VerifiedEconomicFact`. The previous fact
becomes `SUPERSEDED` or remains historically valid at its original
time.

Stale facts are also unusable for new MoonRey eligibility. Historical
blocks retain them.
