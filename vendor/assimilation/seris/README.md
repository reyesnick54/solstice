# Seris assimilation reference

HELIOS does **not** run the Seris desktop gateway or Tauri shell as a production runtime for capital research.

| Field | Value |
| --- | --- |
| Repository | [aowang-ai/seris](https://github.com/aowang-ai/seris) |
| License | Apache-2.0 |
| Reference SHA | `f73dbbb0cd7e3b52601abf905bb871cdb9098550` |

Inspect locally (reference clone only — do not commit the upstream tree into Solstice):

```bash
git clone --depth 1 https://github.com/aowang-ai/seris.git /tmp/seris-ref
cd /tmp/seris-ref && git fetch --depth 1 origin f73dbbb0cd7e3b52601abf905bb871cdb9098550
git checkout f73dbbb0cd7e3b52601abf905bb871cdb9098550
```

Native TypeScript ports live under canonical HELIOS owners (NATIVE11 agent runtime, NATIVE12 strategy + research autopilot). See `docs/helios/open-source/upstream-lock.json`.
