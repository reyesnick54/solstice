# Travel and Mobility Providers (Wave 5 Prompt 20)

## Purpose

SunRey Wave 5 Prompt 20 integrates eligible **free public travel, aviation, transit, and mobility-information providers** from the authoritative Wave 0 provider catalog. This is **information and discovery infrastructure** — not airline booking, GDS settlement, hotel reservation, or payment execution.

## Integrated providers (9)

| Provider ID | Name | Category | Capabilities |
| --- | --- | --- | --- |
| `opensky` | OpenSky Network | aviation | aircraft position, flight reference |
| `faa-registry` | FAA Aircraft Registry | aviation | aircraft registry |
| `aviationapi` | AviationAPI | aviation | airport information, flight reference |
| `can-i-enter` | Can I Enter | travel | entry requirements, visa/entry |
| `transport-rest` | Transport.rest | transportation | Swiss public transit |
| `transitland` | TransitLand | transportation | global transit routes/departures |
| `open-charge-map` | Open Charge Map | transportation | EV charging locations |
| `bc-ferries` | BC Ferries | transportation | ferry transit |
| `entur` | Entur | transportation | Norway public transport |

Catalog entries: `config/providers/wave5-travel-catalog-entries.yaml`

## Architecture

```
External Provider (fixture in simulation)
    ↓
TravelProvider adapter (packages/sunrey-chain/src/travel-intelligence/adapters)
    ↓
TravelIntelligenceService
    ↓
EnvironmentalOracleService (weather — no duplicate weather in Travel)
    ↓
Consumer BFF (services/api/src/consumer/travel.ts)
    ↓
Travel Agent tool: getTravelPlanningContext
```

**Owner package:** `packages/sunrey-chain/src/travel-intelligence`

## Capabilities

| Capability | Description | Booking? |
| --- | --- | --- |
| `aircraft_position` | ADS-B state vectors | No |
| `airport_information` | IATA/ICAO airport metadata | No |
| `flight_reference` | Flight status/reference | No |
| `aircraft_registry` | N-Number / registration lookup | No |
| `entry_requirements` | Visa/entry reference | No |
| `transit_route` | Route and stop metadata | No |
| `transit_departure` | Scheduled/estimated departures | No |
| `ev_charging` | Charger location reference | No |
| `mobility_status` | Mobility network status | No |

`BOOK_FLIGHT` and booking capabilities are **not** exposed. Access Economy (Expedia, Turo) remains a separate commerce simulation layer.

## Aviation coverage

- Real-time aircraft positions (OpenSky) — **bounded bounding-box queries only**
- Aircraft identity: ICAO24, tail number, registration, callsign, model
- FAA N-Number registry lookup
- Airport search and detail (AviationAPI fixtures: RUH, JFK, ZRH)

## Airport coverage

Canonical `Airport` type with IATA, ICAO, name, country, city, coordinates, timezone. Reuses location identity — no duplicate global airport database.

## Entry / visa coverage

`EntryRequirementObservation` normalizes nationality + destination → requirement type, visa flag, restriction status, freshness, source URL.

**Important:** Entry rules change frequently. All responses include freshness metadata. SunRey does **not** guarantee admissibility.

## Transit coverage

| Mode | Providers |
| --- | --- |
| RAIL | transport.rest, transitland, entur |
| FERRY | bc-ferries |
| BUS/METRO/TRAM | transitland (where feeds expose mode) |

## EV charging coverage

Open Charge Map fixture: location, operator, connector types, power. **Availability is null** unless the provider supplies it — no fake real-time status.

## Cache policies

| Capability | Fresh TTL | Notes |
| --- | --- | --- |
| aircraft_position | 15s | Very short |
| airport_information | 24h | Long |
| entry_requirements | 1h | Freshness-sensitive |
| transit_departure | 30s | Very short |
| transit_route | 1h | Longer metadata |
| ev_charging | 30m | Moderate |

## Query bounds

- Max aircraft results: 100
- Max bounding box: 10° lat/lon
- Max transit/charging/airport result limits enforced
- No unrestricted global historical aircraft scans

## BFF endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/v1/travel/airports` | Search airports |
| GET | `/api/v1/travel/airports/:id` | Airport detail |
| GET | `/api/v1/travel/entry-requirements` | Entry requirements |
| GET | `/api/v1/travel/transit` | Transit routes (+ optional departures) |
| GET | `/api/v1/travel/charging` | EV charging locations |
| GET | `/api/v1/travel/aviation` | Bounded aircraft positions |
| GET | `/api/v1/travel/planning-context` | Agent planning bundle |
| GET | `/api/v1/travel/providers` | Provider health |

No generic third-party proxy. No provider credentials exposed.

## Travel Agent integration

Tool: `getTravelPlanningContext`

Consumes `TravelIntelligenceService.buildTravelPlanningContext()`:
- destination airport metadata
- entry requirements (when nationality provided)
- environmental weather context (via EnvironmentalOracleService)
- nearby transit and charging reference

**Never claims a ticket is booked.** `bookingConfirmed: false` and `grantsBookingAuthority: false` on all responses.

## Environmental Oracle integration

`packages/sunrey-chain/src/environmental-oracle` provides destination weather, severe-weather context, and aviation weather notes. Travel does **not** duplicate weather provider calls.

## World integration

World may consume aircraft movement, transit networks, and transportation infrastructure through `TravelIntelligenceService` with bounded queries. High-frequency global aircraft ingestion is not enabled by default.

## Productive Economic Graph

Transportation observations may connect AIRPORT, CITY, TRANSIT_NETWORK nodes where graph architecture supports it. Individual vehicle positions are not overloaded into the graph.

## Financial Agent

Travel observations may inform budgeting and FX context. Travel APIs do **not** authorize financial transfers.

## Privacy

- Minimum necessary request data sent to providers
- No health, DNA, vault, or unrelated financial data in external requests
- `privacySafeLogFields()` redacts nationality from logs (region code only)

## Booking limitations (explicitly NOT supported)

- No flight booking
- No hotel booking
- No ticket issuance
- No GDS settlement
- No payment processing via travel intelligence APIs

Access Economy commerce adapters (Expedia, Turo) remain separate simulation booking rails.

## Simulation posture

`ENVIRONMENT=simulation`. All adapters use fixture transport. `integration_state: simulated` in catalog.

## Tests

`tests/wave-5-prompt-20-travel-providers.test.ts` — provider registration, aviation, airports, entry rules, transit, EV charging, bounds, privacy, agent planning, BFF routes.

## Related

- `docs/providers/FREE_API_MASTER_CATALOG.md`
- `docs/providers/PROVIDER_CACHE_AND_REFRESH.md`
- `packages/access-economy` (separate commerce booking layer)
