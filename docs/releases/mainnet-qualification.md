# Mainnet RC qualification

Qualification is an engineering result. It is not launch
authorization, legal approval, or an independent audit pass.

## Categories

BUILD, PROTOCOL, ENCODING, CONSENSUS, VALIDATORS, GOVERNANCE,
CRYPTOGRAPHY, PQC, WALLETS, NATIVE_ASSETS, MONETARY_POLICY,
VALIDATOR_ECONOMICS, FEE_MARKET, MOONREY_ISSUANCE, TREASURY, ORACLES,
MACHINE_ECONOMY, EXCHANGE, CUSTODY, INTEROPERABILITY, PRIVACY,
STORAGE, DATABASE, INFRASTRUCTURE, PROVIDER_ACCEPTANCE,
FORMAL_ASSURANCE, FUZZING, ADVERSARIAL_SECURITY, ECONOMIC_STRESS,
PERFORMANCE, DISASTER_RECOVERY, SUPPLY_CHAIN, SDK, EXPLORER,
OBSERVABILITY, EXTERNAL_SECURITY_REVIEW, LEGAL_REGULATORY,
HUMAN_AUTHORIZATION.

## States

`PASS`, `FAIL`, `PENDING`, `EXTERNAL_EVIDENCE_REQUIRED`,
`HUMAN_AUTHORIZATION_REQUIRED`, `NOT_APPLICABLE`.

## Executed in smoke/CI

- Formal smoke models with stated bounds
- Bounded required fuzz smoke (corpus hash and campaign bound)
- Chunk 57 critical adversarial scenarios
- Chunk 76 critical and compound economic campaigns (via Chunk 78)
- Chunk 58 performance sanity against the stored baseline
- Seven-validator rehearsal: BFT finality, state-root agreement,
  signer safety, catch-up, governed upgrades, snapshot recovery
- Economic end-to-end: SunRey transfer, MoonRey issuance, FeePolicyV2,
  validator reward/penalty, treasury, DVP, machine commerce
- Storage: redb atomicity, snapshot restore, corruption detection,
  schema compatibility, PostgreSQL recovery, Explorer rebuild
- Disaster recovery: validator/signer/failure-domain loss, database
  recovery, storage restore, RPC failover, Explorer rebuild, oracle
  degradation
- Supply chain: SBOM, provenance, dependency policy, two-builder
  comparison, signed manifest, immutable image digests
- PQC policy recorded without requiring unsupported production HSM PQ
- Provider and audit snapshots
- Secret scan remains a CI stage

## Manual extended workflows

Soak, extended fuzz, formal extended, full adversarial range, and
long-horizon economics are listed as manual workflows. They are not
claimed unless actually executed.

Regulated services run sandbox-only unless genuine production
provider evidence is intentionally supplied. CI does not activate
live regulated flows.

See [../runbooks/mainnet-rc-qualification.md](../runbooks/mainnet-rc-qualification.md).
