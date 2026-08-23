# Runbook — Security incident

Simulation / preproduction only. SEV1.

1. Preserve evidence. Seal through the Evidence Vault. Do not put secrets in logs or metric labels.
2. Credential misuse, unexpected endpoints, signature failures, and SSRF rejections are fail-closed.
3. Rotate credentials through the secret system. Do not copy raw secrets into a backup archive.
4. Control room cannot modify provider credentials, issue Execution Authority, or enable `LIVE_*`.
5. Engage only the domain-scoped kill switch that matches the blast radius. There is no global destructive off switch.

Existing: `docs/runbooks/emergency-security-coordination.md`, `docs/runbooks/launch-security-incident.md`.
