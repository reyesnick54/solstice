# Runbook — Data / privacy incident

Simulation / preproduction only. SEV1.

1. Treat Vault access anomalies as policy failures, not as money movement.
2. PDV payloads, raw KYC, consent content, and HIN grant content stay out of logs, traces, and metrics.
3. Evidence Vault records remain hash-chained operational/financial evidence; they are not a dump of personal data.
4. Information-marketplace kill switch stops licensee access. It is not a second Evidence Vault.
5. Follow subject-rights process already owned by consent / PDV. Do not invent a parallel privacy engine.

Existing: `docs/runbooks/human-information-privacy-incident.md`, `docs/runbooks/evidence-investigation.md`.
