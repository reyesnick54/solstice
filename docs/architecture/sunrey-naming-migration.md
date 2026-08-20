# Chunk 142 — SunRey runtime and public naming migration

Chunk 142 migrates **current public runtime and display identity** to
SunRey. It does not rewrite history and does not change protocol
identity.

## What moved

| Surface | Canonical | Compatibility |
| --- | --- | --- |
| Root workspace name | `sunrey` | Repository path unchanged |
| Root description / README / AGENTS header | SunRey | Historical Solstice mentions stay where they are history |
| Persistence / CI env | `SUNREY_PERSISTENCE_TEST`, `SUNREY_PG_*` | `SOLSTICE_*` aliases through `resolveCanonicalEnv` |
| Identity ID type | `SunReyIdentityId` / `asSunReyIdentityId` | Deprecated aliases `SolsticeIdentityId` / `asSolsticeIdentityId` |
| Persistence diagnostics | `sunrey.persistence` | No secret values |
| SDK / Explorer / CLI display | SunRey SDK, SunRey Chain, SunRey Exchange, SunRey Explorer | Command flags and machine IDs unchanged |
| New event schema refs | `sunrey.<namespace>.<event>/<version>` | Stored `solstice.*` v1 refs unchanged |

## What did not move

- Protocol asset IDs, network IDs, chain IDs, address HRP
- Hash domains
- Legal-entity catalog IDs (`le_solstice_*`, `SOLSTICE_UK`)
- Database names and already-applied migrations
- npm scope `@solstice/*`
- GitHub repository `reyesnick54/solstice`
- WebAuthn relying-party ID `simulation.solstice.local` (manual review)
- Personal Data Vault export format `SolsticePersonalDataExportV1`
- PEG / consent taxonomy tokens such as `SOLSTICE_HOLDING`

## Env policy

`packages/config` is the only name-resolution authority.

```
SUNREY_*  →  SOLSTICE_* alias  →  documented default
```

Contradictory values throw `LegacyEnvConflictError` with code
`LEGACY_ENV_CONFLICT`. The error names the two variables and never
includes their values.

No removal date is declared for the aliases.

## Compatibility report

`buildSunReyLegacyCompatibilityReport()` returns
`SunReyLegacyCompatibilityReport`. Public current-product Solstice
display names remaining must be `0`.

## Audit

`scripts/sunrey-naming-audit.mjs` regenerates the inventory and fails
if a current public display surface still says Solstice outside an
explicitly reviewed exception.

## Demo

```
npm run demo:sunrey-naming-migration
```
