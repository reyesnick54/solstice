# Runbook — public RPC incident

1. `sunrey-ops rpc health` — confirm healthy endpoints and that public
   RPC still cannot reach the signer.
2. `sunrey-ops rpc endpoints` — identify stale, unsynced, or down
   nodes. Stale nodes must stay excluded from submission routes.
3. `sunrey-ops rpc limits` — confirm quota and cost-unit policy. A
   flood should produce rate-limit events, not signer or validator
   admin exposure.
4. `sunrey-ops rpc status` — publish only `PublicNetworkStatus`. Do
   not disclose private operational details.
5. If cache is unavailable, continue serving deterministic reads from
   healthy RPC nodes. Do not fail over onto a stale node for
   mutation-eligibility decisions.
6. Subscription surges are bounded. Close exhausted subscriptions
   rather than widening the bound ad hoc.

Do not open validator admin, signer, or custody paths to restore
public RPC.
