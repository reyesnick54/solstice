# Market surveillance and case management

Deterministic detectors remain the source of candidate alerts.
Production-candidate export covers:

- wash / self-trading patterns
- spoof-like behavior
- layering-like behavior
- market-manipulation candidates
- capacity-market anomalies

Detector output is not legal guilt.

## Case management

`CaseManagementPort` is provider-neutral. A case includes case ID,
detector/fact references, customer/account references under access
control, priority, status, assigned human reviewer, and evidence
references.

The existing Kernel case model remains canonical. External case
systems accept or acknowledge cases; they do not replace Kernel
policy.
