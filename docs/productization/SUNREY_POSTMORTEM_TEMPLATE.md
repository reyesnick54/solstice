# SunRey postmortem template

Blameless. Focus on systems, not people. Do not invent named staff.

`ENVIRONMENT` remains `simulation` unless a later authorized prompt says otherwise.

| Field | Value |
| --- | --- |
| incidentId | |
| severity | SEV1 / SEV2 / SEV3 / SEV4 |
| commander role | INCIDENT_COMMANDER (role, not a name unless the repository already names one) |
| startedAt (UTC) | |
| detectedAt (UTC) | |
| resolvedAt (UTC) | |
| customerImpact | NONE / DEGRADED / PARTIAL_OUTAGE / FULL_OUTAGE / DATA_EXPOSURE / FINANCIAL_INTEGRITY |

## 1. Impact

What customer, financial-integrity, and operator impact occurred? Use facts.

## 2. Timeline

UTC timeline from first precursor through `CLOSED`, including detection and mitigations.

## 3. Root cause

Which system condition made the impact possible? Name components, not people.

## 4. Contributing factors

What else narrowed the margin: telemetry gaps, missing runbooks, or degraded-mode design?

## 5. Detection

How was it detected? Which alert, SLI, or human observation? What was the detection lag?

## 6. Response

What did responders do? Which domain-scoped kill switch or degraded mode was used? What was correctly refused?

## 7. Corrective actions

Concrete system changes. Owners are roles from the on-call matrix.

## 8. Control improvements

Which Kernel, ledger, backup, or control-room controls should get stricter?

Logs are not canonical financial evidence. Production remains disabled until a later authorized prompt.
