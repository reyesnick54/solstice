# Runbook — production handoff

1. Confirm `ENVIRONMENT=simulation` and every `LIVE_*` flag is false
   unless a separately authorized production environment exists.
2. Bind the exact Mainnet RC and Candidate V2 hashes.
3. Inventory systems, access, and operator roles. No secrets.
4. Review engineering SLOs and economic integrity indicators.
5. Hash the approved configuration baseline.
6. Record provider renewal state. Expired Chunk 82 evidence is reported,
   never auto-renewed.
7. Query Chunk 83 findings. Unresolved critical findings remain visible.
8. Collect operator acceptance. Fixture records are rehearsal-only. AI
   cannot accept.
9. Seal the evidence set. Verify the seal hash.
10. Generate the readiness report. External and human gaps stay visible.

`observedProduction` remains false unless actual production evidence and
configured human authorization exist.
