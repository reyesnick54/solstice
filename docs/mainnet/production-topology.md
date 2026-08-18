# Production topology (Candidate V2)

`ProductionTopologyManifest` describes the candidate deployment
shape. It is not an activated network.

Included roles:

- validators
- sentries
- RPC nodes
- Explorer
- oracle collectors
- monitoring
- backup services
- database services (application PostgreSQL only)
- Exchange services
- custody services
- relayers where applicable (none enabled)

Every node carries an explicit failure domain:

| Field | Candidate V2 value |
| --- | --- |
| region | `UNKNOWN` unless a real operator region is supplied |
| availability/failure domain | simulated `sim-domain-1..3` |
| operator | candidate operator reference |
| provider | `LOCAL_INTEGRATION` |
| network zone | Chunk 66 zone or `UNKNOWN` |

Operator, cloud-provider, geographic, network, and HSM-provider
concentration is analyzed. Distinct validator IDs do not imply
organizational independence. Independence is not claimed.
