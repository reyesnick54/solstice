# ACCESS Wave 2 Prompt 31 — Free/Open Access Discovery Providers

SunRey Access discovery consumes **canonical domain services** and the existing **126-API provider platform**. Discovery providers supply reference inventory, availability hints, schedules, and reference prices. They do **not** settle payments, issue virtual cards, or increase funded Access capacity.

## Architecture

```
External Provider (fixture/live)
        ↓
SunRey Provider Platform (provider-sdk + catalog)
        ↓
Canonical Domain Service (TravelIntelligenceService, AccessDiscoveryDataService, EnvironmentalOracleService)
        ↓
Access Discovery Adapter (human-access-economy/discovery-bridge.ts)
        ↓
AccessDiscoveryService (packages/access-economy/src/discovery)
        ↓
AccessOpportunity / AccessCapacityCandidate
```

Access code must **not** call vendor HTTP directly. Adapters live under `packages/sunrey-chain` and are consumed through ports.

## Connected discovery providers

| Provider ID | Source | Access categories | Integration |
|---|---|---|---|
| `gbfs` | GBFS shared mobility feeds | TRANSPORTATION, VEHICLE_HOURS | New fixture adapter |
| `transitland` | Transitland | TRANSPORTATION, TRAVEL | Reused via `TravelIntelligenceService` |
| `transport-rest` | Transport REST | TRANSPORTATION | Reused via `TravelIntelligenceService` |
| `open-charge-map` | Open Charge Map | ENERGY, VEHICLE_HOURS | Reused via `TravelIntelligenceService` |
| `national-park-service` | U.S. NPS Developer API | EXPERIENCES, TRAVEL | New fixture adapter |
| `recreation-gov-ridb` | Recreation.gov RIDB | EXPERIENCES, TRAVEL | New fixture adapter |

Weather, geocoding, and entry-requirement context reuse `EnvironmentalOracleService` and `TravelIntelligenceService` — Access does not duplicate OpenWeatherMap, Nominatim, or Can-I-Enter adapters.

## Capabilities by provider

Discovery capabilities (`AccessProviderCapability`):

- `DISCOVER`, `SEARCH`, `AVAILABILITY`, `LOCATION`, `STATUS`, `SCHEDULE`, `REFERENCE_PRICE`, `INVENTORY_METADATA`

Explicitly **not** declared for open-data providers:

- `BOOK`, `PAY`, `REFUND`, `SETTLE`

See `packages/access-economy/src/discovery/capabilities.ts` for the per-provider matrix.

## AccessOpportunity

Represents externally discovered access that **may** exist. Fields include category, provider identity, location/geography, optional units, availability window, optional `REFERENCE_PRICE`, provenance, freshness, and confidence.

Invariants:

- `discoveryOnly: true`
- `fundedCapacity: false`
- `bookingSupported: false`
- `provenance.referenceOnly: true`

`AccessOpportunity` is **not** `AccessCapacity` and does not reserve funding.

## AccessCapacityCandidate

Represents potential capacity that could later become real `AccessCapacity` after explicit commercial/program approval.

Invariants:

- `fundedCapacity: false`
- `requiresExplicitApproval: true`

Candidates never auto-convert to funded capacity.

## Availability semantics

Normalized states:

| State | Meaning |
|---|---|
| `AVAILABLE` | Source indicates availability |
| `LIMITED` | Constrained availability |
| `UNAVAILABLE` | Source indicates none |
| `UNKNOWN` | Source did not supply availability |
| `STALE` | Cached/stale observation |

`UNKNOWN` is never upgraded to `AVAILABLE`.

## Pricing semantics

When a provider exposes price-like data, SunRey stores it as:

- `REFERENCE_PRICE` — informational only

Reference prices do **not** reserve funding and are not firm booking quotes unless a future booking-capable provider explicitly supports quoting (not in Prompt 31 scope).

## Canonical service reuse

| Need | Canonical service | Notes |
|---|---|---|
| Transit routes/departures | `TravelIntelligenceService.searchTransit` | Transitland + Transport REST fixtures |
| EV charging locations | `TravelIntelligenceService.findChargingLocations` | Open Charge Map fixture |
| GBFS stations | `AccessDiscoveryDataService.searchGbfsStations` | New GBFS fixture owner |
| Parks | `AccessDiscoveryDataService.searchParks` | NPS fixture |
| Recreation inventory | `AccessDiscoveryDataService.searchRecreationFacilities` | RIDB fixture |
| Environmental context | `EnvironmentalOracleService` via travel bridge | No direct weather provider calls from Access |
| Geography normalization | `GeospatialService` patterns via discovery geospatial port | No Access-specific city/airport tables |

## Cache / freshness

| Data class | Policy key | Fresh TTL | Stale TTL |
|---|---|---:|---:|
| GBFS vehicle availability | `vehicle_availability` | 30s | 90s |
| GBFS station metadata | `station_metadata` | 1h | 2h |
| Transit departures | `transit_departures` | 30s | 90s |
| Charger locations | `charger_locations` | 30m | 60m |
| NPS parks | `parks` | 24h | 48h |
| RIDB inventory | `recreation_inventory` | 1h | 2h |
| Search results | `search_results` | 60s | 180s |

Implemented in:

- `packages/access-economy/src/discovery/cache.ts`
- `packages/sunrey-chain/src/access-discovery/cache.ts`
- existing `TravelIntelligenceCache`

## Query bounds

`ACCESS_DISCOVERY_QUERY_LIMITS` enforces:

- max page size 50
- max radius 50 km
- max date range 90 days
- max page index 100
- filter key count limits

No unbounded global scans.

## Privacy controls

Discovery queries reject filters containing financial balances, HIN identifiers, vault content, or medical records. Location sent to providers is generalized (rounded coordinates). See `packages/access-economy/src/discovery/privacy.ts`.

## Geographic coverage

| Provider | Coverage |
|---|---|
| GBFS | City/operator feeds (fixture uses NYC-area coordinates) |
| Transitland / Transport REST | Global/regional transit feeds (fixtures) |
| Open Charge Map | Global charging POIs (fixtures) |
| NPS | U.S. National Park System |
| RIDB | U.S. federal recreation inventory |

## Discovery limitations

- Simulation-only fixtures in CI (`ENVIRONMENT=simulation`)
- No payment, settlement, virtual card, or SR/MR allocation changes
- No automatic capacity funding
- No booking execution for NPS/RIDB/GBFS/open-data providers
- Open Charge Map presence does not imply electricity purchase through SunRey

## Tests

Primary suite: `tests/access-31-discovery-providers.test.ts`

Package-local tests: `packages/access-economy/src/discovery/access-31-discovery.test.ts`

## Prompt 32 recommendation

Prompt 32 should focus on **commercial provider booking orchestration** and explicit **capacity candidate → funded capacity** conversion gates — keeping discovery reference data separate from entitlement issuance and preserving Kernel-gated funding flows.
