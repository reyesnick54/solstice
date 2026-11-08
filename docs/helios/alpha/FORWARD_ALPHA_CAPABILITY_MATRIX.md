# Forward Alpha Capability Matrix (ALPHA01–ALPHA15)

**Qualification marker:** `HELIOS_FORWARD_ALPHA_EVIDENCE_V1_BLOCKED` (**engineering architecture qualified** — not investment-performance proof)

**Git SHA:** `4956abda11aa786d430c32d71c28cac368209768`

**Qualification timestamp (UTC):** `2026-11-08T12:49:40.142Z`

**Evidence-derived reality status:** `FORWARD_CAMPAIGN_READY`

**Subprocess gates:** BLOCKED (see gate table)

**Posture:** `ENVIRONMENT=simulation`; `LIVE_TRADING_ENABLED=false`; `LIVE_INVESTMENT_EXECUTION=false`; `LIVE_CUSTODY_ENABLED=false`; `production_authorized=false`



| ID | Status | Canonical owner | Entry module | Test |
|----|--------|-----------------|--------------|------|
| ALPHA01 | QUALIFIED | `packages/platform/src/helios/forward-alpha-evidence` | `packages/platform/src/helios/forward-alpha-evidence/alpha01-evidence-domain.ts` | `—` |
| ALPHA02 | QUALIFIED | `packages/platform/src/helios/forward-alpha/alpha02` | `packages/platform/src/helios/forward-alpha/alpha02/index.ts` | `tests/helios-alpha02-forward-preregistration.test.ts` |
| ALPHA03 | QUALIFIED | `packages/platform/src/helios/forward-alpha/alpha03` | `packages/platform/src/helios/forward-alpha/alpha03/index.ts` | `tests/helios-alpha03-prequential-engine.test.ts` |
| ALPHA04 | QUALIFIED | `packages/platform/src/helios/forward-alpha/alpha04-shadow-capital` | `packages/platform/src/helios/forward-alpha/alpha04-shadow-capital/index.ts` | `tests/helios-alpha04-shadow-capital.test.ts` |
| ALPHA05 | QUALIFIED | `packages/platform/src/helios/forward-alpha/alpha05` | `packages/platform/src/helios/forward-alpha/alpha05/index.ts` | `tests/helios-alpha05-benchmark-attribution.test.ts` |
| ALPHA06 | QUALIFIED | `packages/platform/src/helios/forward-alpha/alpha06` | `packages/platform/src/helios/forward-alpha/alpha06/index.ts` | `tests/helios-alpha06-forward-execution-realism.test.ts` |
| ALPHA07 | QUALIFIED | `packages/platform/src/helios/forward-alpha/alpha07-sequential-evidence` | `packages/platform/src/helios/forward-alpha/alpha07-sequential-evidence/index.ts` | `tests/helios-forward-alpha-alpha07-sequential-evidence.test.ts` |
| ALPHA08 | QUALIFIED | `packages/platform/src/helios/forward-alpha/alpha08` | `packages/platform/src/helios/forward-alpha/alpha08/index.ts` | `tests/helios-forward-alpha08-data-snooping-firewall.test.ts` |
| ALPHA09 | QUALIFIED | `packages/platform/src/helios/forward-alpha/alpha09` | `packages/platform/src/helios/forward-alpha/alpha09/index.ts` | `tests/helios-alpha09-risk-adjusted-evidence.test.ts` |
| ALPHA10 | QUALIFIED | `packages/strategy-lab/src/alpha10` | `packages/strategy-lab/src/alpha10/index.ts` | `tests/helios-alpha10-forward-regime-robustness.test.ts` |
| ALPHA11 | QUALIFIED | `packages/platform/src/helios/forward-alpha/alpha11` | `packages/platform/src/helios/forward-alpha/alpha11/index.ts` | `tests/helios-alpha11-alpha-decay.test.ts` |
| ALPHA12 | QUALIFIED | `packages/platform/src/helios/forward-alpha/alpha12` | `packages/platform/src/helios/forward-alpha/alpha12/index.ts` | `tests/helios-alpha12-capacity-engine.test.ts` |
| ALPHA13 | QUALIFIED | `packages/platform/src/helios/forward-alpha/alpha13` | `packages/platform/src/helios/forward-alpha/alpha13/index.ts` | `tests/helios-alpha13-portfolio-forward-evidence.test.ts` |
| ALPHA14 | QUALIFIED | `packages/agentic-capital-mesh/src/alpha-evidence-agentic-committee` | `packages/agentic-capital-mesh/src/alpha-evidence-agentic-committee/index.ts` | `tests/helios-alpha14-agentic-evidence-committee.test.ts` |
| ALPHA15 | QUALIFIED | `packages/platform/src/helios/forward-alpha-evidence` | `packages/platform/src/helios/forward-alpha-evidence/alpha15-qualification.ts` | `tests/helios-alpha15-forward-alpha-qualification.test.ts` |
| ALPHA22 | QUALIFIED | `packages/platform/src/helios/forward-alpha/alpha22-shadow-control-room` | `packages/platform/src/helios/forward-alpha/alpha22-shadow-control-room/index.ts` | `tests/helios-alpha22-shadow-control-room.test.ts` |

Architecture marker `HELIOS_FORWARD_ALPHA_EVIDENCE_V1_QUALIFIED` does **not** imply alpha proven.
