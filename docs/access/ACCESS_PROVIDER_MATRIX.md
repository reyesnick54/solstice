# Access Provider Matrix — ACCESS Wave 2

Last updated: 2026-08-31 (simulation)

## Commercial providers

| Provider | Type | Categories | Capabilities | Geography | Environment | Contract | Credentials | Health | Production |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| expedia | AGGREGATOR, FULFILLMENT | HOUSING_ROOM_NIGHTS, TRAVEL, VEHICLE_HOURS | SEARCH, AVAIL, QUOTE, RESERVE, BOOK, CANCEL, FULFILLMENT, WEBHOOKS, REFUND | US, GLOBAL | SANDBOX | SANDBOX | CONFIGURED | HEALTHY | Sandbox only |
| turo | DIRECT_PROVIDER, FULFILLMENT | VEHICLE_HOURS | SEARCH, AVAIL, QUOTE, RESERVE, BOOK, CANCEL, FULFILLMENT, WEBHOOKS | US | SIMULATION | COMMERCIAL_NEGOTIATION | MISSING | HEALTHY | Blocked (partner) |
| doordash | MARKETPLACE, FULFILLMENT | FOOD | SEARCH, AVAIL, QUOTE, FULFILLMENT, WEBHOOKS | US | SIMULATION | COMMERCIAL_NEGOTIATION | MISSING | HEALTHY | Blocked (partner) |
| amazon | MARKETPLACE, FULFILLMENT | GOODS, FOOD | SEARCH, AVAIL, QUOTE, BOOK, FULFILLMENT, WEBHOOKS | US, GLOBAL | SIMULATION | COMMERCIAL_NEGOTIATION | MISSING | HEALTHY | Blocked (partner) |
| airbnb | DIRECT_PROVIDER, FULFILLMENT | HOUSING_ROOM_NIGHTS, EXPERIENCES | SEARCH, AVAIL, QUOTE, RESERVE, BOOK, CANCEL, WEBHOOKS | GLOBAL | SIMULATION | COMMERCIAL_NEGOTIATION | MISSING | HEALTHY | Blocked (partner) |

## Discovery providers

| Provider | Type | Categories | Capabilities | Geography | Environment | Contract | Credentials | Health | Production |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gbfs_mobility | DISCOVERY | VEHICLE_HOURS, TRANSPORTATION | SEARCH, AVAIL | GLOBAL | SIMULATION | DISCOVERY_TERMS | NOT_REQUIRED | HEALTHY | Simulation |
| travel_discovery | DISCOVERY, AGGREGATOR | TRAVEL, TRANSPORTATION | SEARCH, AVAIL, REALTIME_PRICING | GLOBAL | SIMULATION | DISCOVERY_TERMS | NOT_REQUIRED | HEALTHY | Simulation |
| experiences_discovery | DISCOVERY | EXPERIENCES | SEARCH, AVAIL | GLOBAL | SIMULATION | DISCOVERY_TERMS | NOT_REQUIRED | HEALTHY | Simulation |
| hotels_discovery | DISCOVERY | HOUSING_ROOM_NIGHTS | SEARCH, AVAIL, REALTIME_PRICING | GLOBAL | SIMULATION | DISCOVERY_TERMS | NOT_REQUIRED | HEALTHY | Simulation |
| transportation_discovery | DISCOVERY | TRANSPORTATION, VEHICLE_HOURS | SEARCH, AVAIL | US, GLOBAL | SIMULATION | DISCOVERY_TERMS | NOT_REQUIRED | HEALTHY | Simulation |
| compute_discovery | DISCOVERY, CAPACITY_CONTRIBUTOR | COMPUTE, ROBOTICS | SEARCH, AVAIL | GLOBAL | SIMULATION | DISCOVERY_TERMS | NOT_REQUIRED | HEALTHY | Simulation (FUTURE_NATIVE_MR blocked) |

## Capability matrix

| Capability | Discovery | Commercial (sim/sandbox) |
| --- | --- | --- |
| CATALOG_SEARCH | gbfs, travel, experiences, hotels, transportation, compute | expedia, turo, doordash, amazon, airbnb |
| AVAILABILITY | All discovery | expedia (sandbox), turo, doordash, amazon, airbnb |
| QUOTE | — | expedia (sandbox), turo, doordash, amazon, airbnb |
| RESERVE / BOOK | — | expedia (sandbox), turo, airbnb, amazon (book only) |
| REFUND | — | expedia (sandbox) |
| SETTLEMENT | — | **Not implemented (Wave 3)** |

## Future provider slots (descriptor-ready)

Ford fleet, Marriott, airlines, restaurants, robotaxi operators, robotics fleets,
GPU datacenters, electricity providers, real estate operators, manufacturers,
municipalities, employers, governments — register via `AccessProviderRegistry`
without redesigning the Access domain.
