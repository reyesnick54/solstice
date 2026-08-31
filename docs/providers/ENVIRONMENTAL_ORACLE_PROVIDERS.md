# Environmental Oracle Providers

Wave 5 Prompt 19 — canonical Environmental Oracle layer for weather, water,
air quality, seismic, wildfire, and physical-risk observations.

## Purpose

Environmental observations are **reference / evidence only**. They do not
autonomously modify financial positions, MoonRey issuance, insurance decisions,
or asset valuations.

## Provider coverage

| Provider ID | Name | Category | Capabilities | Geographic scope |
| --- | --- | --- | --- | --- |
| `open-meteo` | Open-Meteo | weather | weather, precipitation, environmental | Global |
| `open-meteo-ensemble` | Open-Meteo Ensemble | weather | weather, precipitation, environmental, climate | Global |
| `nws` | U.S. National Weather Service | weather | weather, environmental, environmental_risk, wildfire | US |
| `aviationweather-noaa` | AviationWeather.gov (NOAA) | aviation | weather, environmental, environmental_risk | Global (airports) |
| `pirate-weather` | Pirate Weather | weather | weather, precipitation | Global |
| `met-norway` | MET Norway | weather | weather, precipitation, environmental | Global |
| `meltema` | Meltemi | weather | weather, precipitation | Global |
| `usgs-water` | USGS Water Services | water | water_data, environmental | US |
| `epa` | U.S. EPA Air Quality System | environmental | air_quality, environmental | US |
| `kanari` | Kanari | environmental | air_quality, environmental | Global |
| `usgs-earthquake` | USGS Earthquake Hazards Program | environmental | earthquake, environmental, environmental_risk | Global |
| `openaq` | OpenAQ | environmental | air_quality, environmental | Global |
| `purpleair` | PurpleAir | environmental | air_quality, environmental | Global |

**Total integrated providers: 13**

All providers are registered in `packages/sunrey-chain/src/environmental/catalog-entries.ts`
and validated against the Wave 0 catalog framework.

## Weather coverage

- **Current observations** (`WeatherObservation`): temperature, feels-like,
  humidity, pressure, wind speed/direction, precipitation, cloud cover,
  visibility, weather condition, snow, UV index, observation time, location,
  provider, freshness, provenance.
- **Forecasts** (`WeatherForecast`): separate schema from observations; includes
  `generatedAt`, `validFrom`, `validTo`, horizon, hourly/daily resolution,
  forecast variables, model/source, confidence where available.
- **Ensemble forecasts**: Open-Meteo Ensemble retains per-model identity
  (`modelId`, `modelRun`); models are not collapsed without explicit methodology.

## Water coverage

`WaterObservation` supports: streamflow, water level, groundwater, reservoir
level, water temperature, water quality, availability, usage, drought indicators.

USGS Water Services covers **United States gauge network only** — do not imply
global water coverage.

## Air quality coverage

`AirQualityObservation` supports PM2.5, PM10, NO2, SO2, CO, O3, AQI with explicit
units and AQI standard metadata per source. Incompatible AQI standards are not
compared without normalization metadata.

## Seismic coverage

`SeismicObservation` provides event observations (not predictions): event ID,
magnitude, magnitude type, depth, coordinates, place, event time, provider,
provenance.

## Wildfire coverage

`WildfireObservation` normalizes fire/event ID, location, detection time, status,
confidence, affected area (when supplied), satellite/source metadata. Fire
perimeters are not fabricated.

## Physical risk semantics

`PhysicalRiskObservation` classifies observed signals into types such as FLOOD,
DROUGHT, WILDFIRE, EARTHQUAKE, EXTREME_HEAT, EXTREME_COLD, HIGH_WIND,
POOR_AIR_QUALITY, WATER_STRESS. Derived risk is distinct from raw observations;
`prediction` is always `false`.

## Units

All measurements carry explicit units:

- Temperature: `celsius`, `fahrenheit`, `kelvin`
- Wind: `m/s`, `km/h`, `mph`, `knots`
- Precipitation: `mm`, `in`, `cm`
- Pressure: `hPa`, `inHg`, `mb`

Conversion helpers live in `packages/sunrey-chain/src/environmental/location.ts`.

## Freshness and cache

Capability-specific TTLs (no global single TTL):

| Capability | Fresh TTL | Notes |
| --- | --- | --- |
| `weather.current` | 5 min | Current conditions |
| `weather.forecast.hourly` | 10 min | Hourly forecast |
| `weather.forecast.daily` | 30 min | Daily forecast |
| `water.gauge` | 15 min | Based on publication frequency |
| `air_quality.current` | 10 min | Short/moderate |
| `seismic.event` | 60 min | Longer after final update |
| `wildfire.event` | 30 min | Event observations |

Forecasts preserve `generatedAt`, `validFrom`, `validTo`, `retrievedAt`. Expired
forecasts (`validTo` passed) are marked `expired: true` and not served as current.

## Provider disagreement

Multiple weather providers may disagree. The service retains source-specific
observations and records `ProviderDisagreementEvent` when temperature divergence
exceeds threshold. Observations are never silently averaged.

## Architecture

```
External Provider (fixture in simulation)
    ↓
EnvironmentalOracleProvider adapter
    ↓
EnvironmentalOracleService
    ↓
Integrations (World, Grow, Travel, Real Estate, Agent, MoonRey)
    ↓
Consumer BFF (services/api)
    ↓
SunRey Application
```

Service owner: `packages/sunrey-chain/src/environmental/`

Key types: `packages/sunrey-chain/src/environmental/types.ts`

## Product integrations

| Product | Integration | Authority |
| --- | --- | --- |
| World | `buildWorldEnvironmentalSnapshot` | Read-only display |
| Grow / PEG | `buildGrowEnvironmentalContext` | Reference context; no graph writes |
| MoonRey | `buildMoonReyEnvironmentalContext` | `issuanceAuthority: false` |
| Travel | `buildTravelEnvironmentalContext` | `bookingAuthorized: false` |
| Real Estate | `buildRealEstateEnvironmentalContext` | `automatedValuation: false` |
| Financial Agent | `buildEnvironmentalAgentEvidence` | `grantsExecutionAuthority: false` |

## BFF routes

- `GET /api/v1/world/environmental` — environmental snapshot
- `GET /api/v1/world/environmental/weather` — current weather
- `GET /api/v1/world/environmental/forecast` — forecasts
- `GET /api/v1/world/environmental/air-quality` — air quality
- `GET /api/v1/world/environmental/water` — water state
- `GET /api/v1/environmental/separation-proof` — separation proof
- `GET /api/v1/environmental/agent-evidence` — agent research evidence
- `GET /api/v1/environmental/travel-context` — travel environmental context

Query parameters: `lat`, `lon` (required for location-scoped routes).

## Simulation posture

`ENVIRONMENT=simulation`. All adapters use fixture transports. No live network
calls. `LIVE_*` flags remain `false`.

## Known gaps

- Wave 0 catalog YAML not yet populated with environmental entries (catalog
  entries live in TypeScript until master list merge).
- Wildfire coverage limited to NWS fire weather alerts in simulation.
- Pirate Weather and PurpleAir require API keys for live mode (not enabled).
- No dedicated global wildfire perimeter provider in current 13-provider set.

## Recommendation for Prompt 20

Prompt 20 should wire environmental observations into the Productive Economy Data
Platform ingestion path (`ProductiveEconomyDataPlatform.ingest`) with verified
observation drafts, extend economic-data-fabric routing for environmental source
categories, and add data-quality scoring / trust-engine comparison across
disagreeing weather models.
