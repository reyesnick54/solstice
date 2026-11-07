# Alternative Data Signal Validation

**Marker:** `HELIOS_ALTERNATIVE_DATA_INTELLIGENCE_V1_QUALIFIED`

## AAF-certified Strategy Genome features

- `workforce_expansion_state`
- `digital_demand_acceleration`
- `pricing_power_state`
- `port_congestion_exposure`
- `physical_activity_change`
- `innovation_momentum`
- `procurement_demand_state`
- `supply_chain_risk_state`

## Incremental information

Holdout incremental lift is required before `AAFQualification=CERTIFIED`. Features with excellent in-sample fit but no holdout information are rejected (`holdout_incremental_reject` scenario).

## Adversarial harness

Fourteen simulation scenarios in `adversarial-qualification.ts` guard entity mapping, deduplication, coverage bias, vintage preservation, cloud obscuration, night-lights calibration, AIS cargo unknown, contract ceiling vs obligation, patent-without-commercialization, weak supply-chain edges, modality dropout, multiple-testing correction, and entitlement revocation.
