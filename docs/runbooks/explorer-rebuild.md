# Runbook — Explorer rebuild

1. `sunrey-ops explorer status` — inspect HA state, healthy members,
   and divergence.
2. `sunrey-ops explorer lag` — confirm indexed vs finalized height.
3. `sunrey-ops explorer verify` — compare members against canonical
   chain. Divergence is not repaired by editing the index.
4. `sunrey-ops explorer rebuild` — rebuild the lagged or corrupt
   member from finalized chain data.
5. Fail public queries over to a healthy projection until rebuild
   completes. The missing Explorer never blocks the chain.

Never treat Explorer as authoritative. Never rewrite chain history
from a projection.
