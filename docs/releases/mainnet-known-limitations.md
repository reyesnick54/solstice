# Mainnet RC known limitations

Release notes list unresolved relevant limitations. Hidden limitations
are a verify failure.

Current limitations actually present in this repository:

- Production tickers are not assigned
- Production tokenomics values remain `UNCONFIGURED`
- External HSM evidence is absent; simulation/software HSM cannot
  satisfy externally verified hardware policy
- Provider agreements are absent; no provider is production eligible
- Independent external audit is incomplete; engineering preparation
  is not an audit pass
- Legal and regulatory evidence remains incomplete and stays missing
- Production root-of-trust ceremony evidence remains separate until
  Chunk 85
- ReleaseAuthority signature cannot activate the network
- CI and AI actors cannot synthesize human release approval
- `ENVIRONMENT` stays `simulation`; every `LIVE_*` flag stays false
- Extended soak / fuzz / formal / range / long-horizon economics are
  not claimed unless executed

Open critical findings, when present, remain blockers. Fake audit
results are rejected.
