# Geospatial, Maritime, and Logistics Providers (Wave 5 Prompt 21)

Date: 2026-08-31  
Status: **Simulation — ready for merge**

## Scope

Wave 5 Prompt 21 completes the physical-economy data plane with geospatial,
maritime, and logistics providers, plus Wave 5 hardening across energy,
resources, weather, water/environment, aviation, and transit.

All integrations use fixture transport only. No live HTTP to public APIs in CI.

## Canonical geography model

Shared type: `CanonicalGeography` in `packages/external-data/src/wave5-models.ts`

Used across World, MoonRey, Travel, Resources, and Real Estate contexts:

- `locationId` — disambiguated canonical ID (e.g. `loc:us:il:springfield:62701`)
- Country, ISO code, region, city, postal area
- Latitude, longitude, timezone
- Administrative hierarchy
- Provider-native IDs preserved in provenance

Springfield, Illinois and Springfield, Massachusetts are never conflated.

## Services

| Service | Path | Capabilities |
| --- | --- | --- |
| `GeospatialService` | `packages/external-data/src/wave5-services.ts` | geocode, reverseGeocode, lookupCountry, lookupRegion, lookupTimezone, getElevation, isLandOrWater, IP geolocation |
| `MaritimeDataService` | same | vessel observations, shipping flow |
| `LogisticsDataService` | same | shipment status, fuel prices, transport network |
| `EnergyDataService` | same | energy metrics |
| `ResourceDataService` | same | mineral/resource observations |
| `WeatherDataService` | same | current weather |
| `EnvironmentalOracleService` | same | water, air quality |
| `TravelIntelligenceService` | same | aviation positions, transit routes |

## Geospatial providers

| Provider | ID | Status | Notes |
| --- | --- | --- | --- |
| Nominatim (OSM) | `nominatim` | Preview | 1 req/s; User-Agent required; public instance not for production bulk geocoding |
| OpenStreetMap | `openstreetmap` | Preview | Reference data; no live Overpass in simulation |
| REST Countries | `rest-countries` | Production candidate | Country metadata, ISO codes, currencies |
| Open Topo Data | `open-topo-data` | Production candidate | Elevation; 1 req/s |
| GeoJS | `geojs` | Preview | IP geolocation — APPROXIMATE only |
| ipapi.co | `ipapi` | Preview | IP geolocation — APPROXIMATE only |
| ipwhois.app | `ipwhois` | Preview | IP geolocation — APPROXIMATE only |

## Maritime providers

| Provider | ID | Status | Notes |
| --- | --- | --- | --- |
| OnWater | `onwater` | Preview | Land/water classification |
| Strait of Hormuz Ship Monitor | `hormuz-ship-monitor` | Preview | Corridor flow intelligence; fixture only |

## Logistics providers

| Provider | ID | Status | Notes |
| --- | --- | --- | --- |
| OpenVan | `openvan` | Preview | Parcel tracking, fuel prices |

## Caching

Geocoding uses longer TTL policies (`geocoding.forward`, `geocoding.reverse`,
`geospatial.country_metadata`) in
`packages/sunrey-chain/src/provider-runtime/data-delivery/policies.ts`.

Cache keys are normalized; personal addresses are not persisted beyond query scope.

## Query safety

`enforceQueryLimits()` caps result count (max 50), bounding-box area, and date range.
No generic upstream URL proxying.

## BFF routes

| Route | Schema |
| --- | --- |
| `GET /api/v1/world/physical-economy` | `sunrey.world.physical-economy.v1` |
| `GET /api/v1/world/energy` | `sunrey.bff.energy.v1` |
| `GET /api/v1/world/weather` | `sunrey.bff.weather.v1` |
| `GET /api/v1/world/geospatial` | `sunrey.bff.geospatial.v1` |
| `GET /api/v1/world/maritime` | `sunrey.bff.maritime.v1` |
| `GET /api/v1/world/logistics` | `sunrey.bff.logistics.v1` |
| `GET /api/v1/world/productive-graph` | `sunrey.productive-economic-graph.v1` |
| `GET /api/v1/travel/context` | `sunrey.travel.context.v1` |
| `GET /api/v1/world/provider-risk` | `sunrey.provider-risk-monitor.v1` |
| `GET /api/v1/world/wave5-coverage` | coverage report |

## MoonRey authority separation

External physical-economy data is available for MoonRey analytics only.
`issuanceAuthority: false` and `mintsMoonRey: false` on all bridges.
No minting, burning, or ledger changes.

## Related

- `docs/providers/WAVE_5_COMPLETION_REPORT.md`
- `config/providers/wave5-physical-economy-catalog-entries.yaml`
- `packages/external-data/src/wave5-*.ts`
