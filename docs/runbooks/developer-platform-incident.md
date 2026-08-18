# Developer platform incident runbook

Owner: `packages/sunrey-sdk` Chunk 94 control plane.

## Immediate actions

1. Confirm `ENVIRONMENT=simulation` and no `LIVE_*` flag is true.
2. Collect `sunrey-dev status` (network, faucet, RPC, Explorer).
3. If credentials leaked: revoke the credential, rotate webhook signing
   keys, and inspect the audit log. Audit rows must not contain secrets.
4. If webhooks misfire: disable the endpoint, check SSRF rejects, and
   confirm deliveries entered `PERMANENTLY_FAILED` instead of looping.
5. If faucet abuse: developer quota and Testnet faucet anti-abuse both
   apply. Do not point the faucet at a production network.

## Do not

- Sign user funds with a developer API key
- Replay a Kernel refusal
- Treat sandbox identities as production
- Promote a developer RBAC role into protocol governance
- Create unauthorized customer charges through the billing port

## Evidence

Seal control-plane actions in the existing audit trail (no secret
values). Canonical financial evidence remains the Evidence Vault and
ledger, not this developer control plane.
