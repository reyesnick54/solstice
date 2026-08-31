# Energy and Resource Providers (Wave 5 Prompt 18)

Date: 2026-08-31  
Status: **Implemented in simulation**

## Purpose

Wave 5 Prompt 18 integrates eligible free energy, natural resource, commodity-supply,
carbon, electricity, and productive-economy providers from the partial Wave 0 catalog
into SunRey's shared provider infrastructure. External observations support MoonRey
analytics, the Productive Economic Graph, World, Grow, and Financial Agent research —
they do **not** mint MoonRey, change SunRey Coin supply, or drive Exchange execution.

## Integrated providers

| Provider ID | Classification | Category | Geographic coverage |
| --- | --- | --- | --- |
| `national-grid-eso` | PRODUCTION_CANDIDATE | energy | GB |
| `uk-carbon-intensity` | PRODUCTION_CANDIDATE | energy | GB |
| `energi-data-service` | PRODUCTION_CANDIDATE | energy | DK |
| `fred-commodity` | PRODUCTION_CANDIDATE | commodities | US, global |
| `indian-mandi-prices` | PRODUCTION_CANDIDATE | food_nutrition | IN |
| `co2-offset` | PREVIEW_ONLY | environmental | global |
| `website-carbon` | PREVIEW_ONLY | environmental | global |
| `tilth` | BLOCKED | food_nutrition | US |

**Total integrated:** 7 adapters (6 new + `fred-commodity` extended)  
**Total in Wave 5 catalog:** 8 (including blocked `tilth`)

## Energy categories covered

- Electricity generation (MW) — National Grid ESO, Energi Data Service, UK Carbon mix
- Electricity demand / consumption (MW) — National Grid ESO, Energi Data Service
- Carbon intensity (gCO2/kWh) — UK Carbon Intensity, Website Carbon (preview)
- Generation mix / renewable share (percent) — UK Carbon Intensity
- Energy prices (USD/barrel oil via FRED commodity)

## Resource coverage

| Resource | Status | Provider |
| --- | --- | --- |
| Oil (WTI) | Available | fred-commodity |
| Wheat | Available | indian-mandi-prices |
| Carbon offsets | Preview | co2-offset |
| Gold | No eligible live source | — |
| Silver | No eligible live source | — |
| Copper | No eligible live source | — |
| Lithium | No eligible live source | — |
| Water | No eligible live source | — |
| Hydrogen | No eligible live source | — |
| Natural gas (spot) | No eligible live source | — |

## Units

All observations carry explicit units. Normalization preserves source value/unit:

| Metric | Source units | Normalized unit |
| --- | --- | --- |
| Generation / demand | MW, kW, GW | MW |
| Energy | Wh, kWh, MWh, GWh | MWh |
| Carbon intensity | gCO2/kWh | gCO2/kWh |
| Commodity price | USD/barrel, INR/quintal | identity or currency/unit |
| Agriculture price | INR/quintal | INR/quintal |

Incompatible units are rejected — no silent conversion.

## Cache policies

| Capability | TTL | Notes |
| --- | ---: | --- |
| `grid_load` | 120s | Real-time grid |
| `electricity_demand` | 300s | 5 min |
| `electricity_generation` | 300s | 5 min |
| `carbon_intensity` | 600s | 10 min |
| `energy_mix` | 900s | 15 min |
| `energy_prices` | 3600s | Hourly |
| `agriculture_prices` | 14400s | 4 hours |
| `resource_data` | 86400s | Daily |

## Architecture

```
External Provider (fixture in simulation)
    ↓
Wave 5 adapter (packages/sunrey-chain/src/productive-economy-providers/adapters)
    ↓
Provider Registry + reliability controls (packages/provider-sdk)
    ↓
EnergyObservation / ResourceObservation / ProductiveEconomicObservation
    ↓
ExternalDataPlane.productiveEconomy (packages/external-data)
    ↓
World BFF / Grow / Agent / Exchange / MoonRey bridges
```

## Productive Economic Graph integration

Time-series observations are stored separately. Stable nodes projected:

- `COUNTRY`, `GRID`, `ENERGY_SOURCE`, `RESOURCE`, `COMMODITY`, `REGION`

Relationships: `POWERS`, `CONSUMES`, `LOCATED_IN`, `PRODUCES`, `SUPPLIES`

## MoonRey boundary

```
ExternalObservation → MoonRey analytics / dashboards / index research
ExternalObservation ↛ MoonRey issuance
ExternalObservation ↛ SunRey Coin supply
ExternalObservation ↛ Exchange order book
```

`mintsMoonRey: false` and `issuanceAuthority: false` on every observation model.

## Financial Agent boundary

Agent receives `agentEvidenceBundleWithProductiveEconomy()` — evidence references only.
`grantsExecutionAuthority: false`. Agent does not trade on resource signal changes.

## Known missing coverage

Resources listed in SunRey UI but without a valid free Wave 0 provider:

- Gold, Silver, Copper, Lithium, Water, Hydrogen, Natural gas spot

These return `NO_ELIGIBLE_LIVE_SOURCE` rather than fabricated values.

## Tests

- `tests/wave-5-prompt-18-energy-resources.test.ts`
- `packages/sunrey-chain/src/productive-economy-providers/` (runtime + adapters)

## Related files

- `config/providers/wave5-energy-resource-catalog-entries.yaml`
- `packages/sunrey-chain/src/productive-economy-providers/`
- `packages/external-data/src/productive-economy.ts`
- `services/api/src/consumer/world-external-data-adapter.ts`
