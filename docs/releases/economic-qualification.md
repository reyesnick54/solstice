# Economic qualification

The economic qualification matrix has these categories:

`MONETARY_POLICY`, `SUNREY_SUPPLY`, `MOONREY_SUPPLY`, `GENESIS_POLICY`,
`VALIDATOR_ECONOMICS`, `FEE_MARKET`, `MOONREY_ISSUANCE`, `ORACLES`,
`PROTOCOL_TREASURY`, `EXCHANGE_SETTLEMENT`, `MACHINE_ECONOMY`,
`DUAL_ECONOMY`, `FORMAL_ASSURANCE`, `PROPERTY_TESTING`,
`ADVERSARIAL_STRESS`, `PERFORMANCE`, `RECOVERY`, `GOVERNANCE`,
`SUPPLY_CHAIN`, `SDK`, `EXPLORER`.

States are `PASS`, `FAIL`, `PENDING_EXTENDED_TEST`, and
`NOT_APPLICABLE`. They are engineering results. They do not imply
regulatory approval.

## Campaigns

- Monetary: no hidden genesis, supply identity, issuance authority,
  burn accounting, policy history, SunRey/MoonRey separation.
- Validator: bond lock, reward reconciliation, penalty evidence,
  unbond delay, customer-asset isolation, policy history.
- Fees: resource-meter determinism, base-price bounds, max-fee
  authorization, reservation, disposition, validator-reward / burn /
  treasury integration.
- MoonRey: oracle fact dependency, productive eligibility,
  normalization, anti-double-count, caps, policy activation, supply
  reconciliation.
- Treasury: fee-funded provenance, no supply creation, customer-asset
  separation. Production budget and disbursement stay `UNCONFIGURED`.
- Dual-economy: Chunk 75 baseline plus rapid automation, energy
  scarcity, compute abundance, and high concentration.
- Stress: existing critical safety/accounting failures are included
  in the outcome. Known failures are not hidden.
- Formal: Chunk 61 economic models
  `NATIVE_MONETARY_POLICY`, `GENESIS_ALLOCATION_CONSERVATION`,
  `VALIDATOR_ECONOMICS`, `ADAPTIVE_FEE_MARKET`,
  `MOONREY_POLICY_GOVERNANCE`, plus registry equivalents
  `FEE_CONSERVATION` (treasury) and `NATIVE_ASSET_CONSERVATION`
  (cross-economic invariants).
- Property: deterministic seed `78` and corpus
  `tests/assurance/corpus`.
- Seven-validator: SunRey transfer, MoonRey issuance, fees, rewards,
  penalty, treasury funding/disbursement, Exchange DVP, machine
  commerce, oracle degradation.
- Recovery: Chunk 67 snapshot, PostgreSQL, and Explorer rebuild.
  Economic invariants must remain identical.
- Upgrade: harmless governed policy version rehearsal. Old policy
  before activation, new policy after, historical interpretation
  preserved, lagging node catches up.

Extended qualification may run longer dual-economy, stress, formal,
or soak campaigns. The manual/scheduled workflow is
`.github/workflows/sunrey-economic-rc-extended.yml`. It records that
the `extended` profile ran. Do not claim an extended wall-clock
duration unless that duration actually completed.
