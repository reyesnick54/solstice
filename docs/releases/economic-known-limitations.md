# Economic known limitations

The economic RC imports Chunk 62 security limitations and adds
economic limitations. None may be hidden from the qualification
report.

| ID | Meaning |
| --- | --- |
| `NOT_MAINNET` | TESTNET / PRODUCTION-CANDIDATE only. Not mainnet authorization. |
| `ENGINEERING_NOT_REGULATORY` | Qualification is not regulatory or counsel approval. |
| `PRODUCTION_PARAMETERS_UNCONFIGURED` | Production quantities stay `UNCONFIGURED`. |
| `TICKERS_NOT_ASSIGNED` | Public tickers remain `NOT_ASSIGNED`. |
| `SIMULATION_ENVIRONMENT` | `ENVIRONMENT` stays `simulation`. `LIVE_*` stay false. |
| `EXTERNAL_ORACLE_AGREEMENTS_ABSENT` | External oracle agreements are absent. |
| `PRODUCTION_HSM_EVIDENCE_ABSENT` | Production HSM evidence is absent. |
| `EXTERNAL_AUDIT_ABSENT` | Independent external audit is absent. |
| `LEGAL_REGULATORY_INCOMPLETE` | Legal/regulatory evidence is incomplete. |
| `PROTOCOL_TREASURY_PRODUCTION_UNCONFIGURED` | Production treasury budget/disbursement stay `UNCONFIGURED`. |
| `RELEASE_AUTHORITY_NOT_POLICY_ACTIVATION` | Signing does not activate economic policy. |
| `EXTENDED_DURATION_NOT_CLAIMED` | Do not claim a soak/long-horizon run unless it completed. |
