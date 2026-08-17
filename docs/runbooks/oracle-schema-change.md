# Oracle schema change

External provider schema drift is an explicit incompatibility. Do not
silently reinterpret fields.

## Detection

- `ORACLE_SCHEMA_CHANGED` when the schema id or version does not match
- Wrong numeric representation, unit, missing source timestamp,
  invalid identifier, oversized record, or unbounded arrays are
  rejected

## Response

1. Stop collecting the incompatible version
2. Record the incompatibility; do not coerce floats or rename fields
3. Create a new feed / schema version for a breaking normalization or
   schema change
4. Re-onboard providers against the new version
5. Historical observations remain verifiable under the prior version

```
sunrey-oracle feed validate
sunrey-oracle feed create <new-feed-id>
```
