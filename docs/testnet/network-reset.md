# Network reset and versioning

A destructive reset produces a **new** network identifier.

| Current | Next |
| --- | --- |
| `net_sunrey_testnet_1` / `chn_sunrey_testnet_1` | `net_sunrey_testnet_2` / `chn_sunrey_testnet_2` |

Genesis is never silently replaced while retaining the same identity.
Nodes pin `genesis_hash`. A different genesis is a different network.

Protocol upgrades require the Chunk 40 accountable threshold and a
future activation height. A newer binary does not change consensus
rules.
