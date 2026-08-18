# Human Information privacy incident

Use this runbook for unauthorized request, policy bypass, raw-data
exposure attempt, query abuse, re-identification signal, wrong
recipient, or consent mismatch.

## Immediate actions

1. Open a `PrivacyIncident` on the Human Information Network engine.
2. Apply emergency restriction if market activity must pause. Emergency
   control cannot grant broader access.
3. Revoke affected future-use rights. Do not erase historical
   settlement or evidence records.
4. Preserve usage receipts, consent hashes, and on-chain anchors.

## Classification

| Kind | Typical signal |
| --- | --- |
| `UNAUTHORIZED_REQUEST` | Use without an active permission |
| `POLICY_BYPASS` | Arbitrary code or output tamper |
| `RAW_DATA_EXPOSURE_ATTEMPT` | Raw PDV / export request |
| `QUERY_ABUSE` | Repeated-query extraction |
| `REIDENTIFICATION_SIGNAL` | Small-cohort aggregate |
| `WRONG_RECIPIENT` | Requester impersonation |
| `CONSENT_MISMATCH` | Purpose substitution |

## Follow-up

Notify the subject through a privacy-minimized mobile/security event.
Record the incident in the rights audit. Production activation remains
blocked until privacy review, legal analysis, jurisdiction policy,
terms, requester controls, and human authorization exist.
