/**
 * Wave 5 simulation fixtures — deterministic, no live HTTP.
 */

import type {
  AviationObservation,
  CanonicalGeography,
  CountryMetadata,
  EnergyObservation,
  EnvironmentalObservation,
  GeocodeResult,
  IpGeolocationResult,
  ElevationResult,
  LogisticsObservation,
  MaritimeObservation,
  ResourceObservation,
  ShippingFlowObservation,
  TransitObservation,
  WeatherObservation,
} from './wave5-models.ts';

export const FIXTURE_NOW = '2026-08-31T12:00:00.000Z';

// ── Canonical Geography Fixtures ──────────────────────────────────────────────

export const FIXTURE_SPRINGFIELD_IL: CanonicalGeography = Object.freeze({
  locationId: 'loc:us:il:springfield:62701',
  country: 'United States',
  countryCode: 'US',
  region: 'Illinois',
  city: 'Springfield',
  postalArea: '62701',
  latitude: 39.7817,
  longitude: -89.6501,
  timezone: 'America/Chicago',
  adminHierarchy: Object.freeze(['United States', 'Illinois', 'Sangamon County', 'Springfield']),
  providerNativeIds: Object.freeze({ nominatim: 'relation:126326', osm: 'node:12345' }),
  provenance: 'fixture/nominatim/springfield-il',
});

export const FIXTURE_SPRINGFIELD_MA: CanonicalGeography = Object.freeze({
  locationId: 'loc:us:ma:springfield:01103',
  country: 'United States',
  countryCode: 'US',
  region: 'Massachusetts',
  city: 'Springfield',
  postalArea: '01103',
  latitude: 42.1015,
  longitude: -72.5898,
  timezone: 'America/New_York',
  adminHierarchy: Object.freeze(['United States', 'Massachusetts', 'Hampden County', 'Springfield']),
  providerNativeIds: Object.freeze({ nominatim: 'relation:126327' }),
  provenance: 'fixture/nominatim/springfield-ma',
});

export const FIXTURE_LONDON: CanonicalGeography = Object.freeze({
  locationId: 'loc:gb:england:london',
  country: 'United Kingdom',
  countryCode: 'GB',
  region: 'England',
  city: 'London',
  postalArea: null,
  latitude: 51.5074,
  longitude: -0.1278,
  timezone: 'Europe/London',
  adminHierarchy: Object.freeze(['United Kingdom', 'England', 'Greater London', 'London']),
  providerNativeIds: Object.freeze({ nominatim: 'relation:65606' }),
  provenance: 'fixture/nominatim/london',
});

export const FIXTURE_GEOGRAPHIES = Object.freeze([FIXTURE_SPRINGFIELD_IL, FIXTURE_SPRINGFIELD_MA, FIXTURE_LONDON]);

export const FIXTURE_GEOCODE_RESULTS: readonly GeocodeResult[] = Object.freeze([
  Object.freeze({
    locationId: FIXTURE_SPRINGFIELD_IL.locationId,
    displayName: 'Springfield, Illinois, United States',
    geography: FIXTURE_SPRINGFIELD_IL,
    confidence: 'HIGH' as const,
    sourceProvider: 'nominatim',
  }),
  Object.freeze({
    locationId: FIXTURE_SPRINGFIELD_MA.locationId,
    displayName: 'Springfield, Massachusetts, United States',
    geography: FIXTURE_SPRINGFIELD_MA,
    confidence: 'HIGH' as const,
    sourceProvider: 'nominatim',
  }),
  Object.freeze({
    locationId: FIXTURE_LONDON.locationId,
    displayName: 'London, England, United Kingdom',
    geography: FIXTURE_LONDON,
    confidence: 'HIGH' as const,
    sourceProvider: 'nominatim',
  }),
]);

export const FIXTURE_COUNTRIES: readonly CountryMetadata[] = Object.freeze([
  Object.freeze({
    countryCode: 'US',
    name: 'United States',
    officialName: 'United States of America',
    capital: 'Washington, D.C.',
    currencies: Object.freeze([{ code: 'USD', name: 'United States dollar' }]),
    languages: Object.freeze(['English']),
    region: 'Americas',
    subregion: 'Northern America',
    borders: Object.freeze(['CAN', 'MEX']),
    population: 331_000_000,
    sourceProvider: 'rest-countries',
  }),
  Object.freeze({
    countryCode: 'GB',
    name: 'United Kingdom',
    officialName: 'United Kingdom of Great Britain and Northern Ireland',
    capital: 'London',
    currencies: Object.freeze([{ code: 'GBP', name: 'British pound' }]),
    languages: Object.freeze(['English']),
    region: 'Europe',
    subregion: 'Northern Europe',
    borders: Object.freeze(['IRL']),
    population: 67_000_000,
    sourceProvider: 'rest-countries',
  }),
  Object.freeze({
    countryCode: 'IR',
    name: 'Iran',
    officialName: 'Islamic Republic of Iran',
    capital: 'Tehran',
    currencies: Object.freeze([{ code: 'IRR', name: 'Iranian rial' }]),
    languages: Object.freeze(['Persian']),
    region: 'Asia',
    subregion: 'Southern Asia',
    borders: Object.freeze(['IRQ', 'AFG', 'PAK', 'TUR', 'ARM', 'AZE', 'TKM']),
    population: 85_000_000,
    sourceProvider: 'rest-countries',
  }),
]);

export const FIXTURE_IP_GEO: readonly IpGeolocationResult[] = Object.freeze([
  Object.freeze({
    ip: '8.8.8.8',
    country: 'United States',
    countryCode: 'US',
    region: 'California',
    city: 'Mountain View',
    timezone: 'America/Los_Angeles',
    latitude: 37.386,
    longitude: -122.0838,
    asn: 'AS15169',
    isp: 'Google LLC',
    accuracy: 'APPROXIMATE' as const,
    sourceProvider: 'geojs',
  }),
  Object.freeze({
    ip: '1.1.1.1',
    country: 'Australia',
    countryCode: 'AU',
    region: 'Queensland',
    city: 'Brisbane',
    timezone: 'Australia/Brisbane',
    latitude: -27.4679,
    longitude: 153.0281,
    asn: 'AS13335',
    isp: 'Cloudflare, Inc.',
    accuracy: 'APPROXIMATE' as const,
    sourceProvider: 'ipapi',
  }),
]);

export const FIXTURE_ELEVATIONS: readonly ElevationResult[] = Object.freeze([
  Object.freeze({
    latitude: 39.7817,
    longitude: -89.6501,
    elevationMeters: 182,
    depthMeters: null,
    classification: 'LAND' as const,
    sourceProvider: 'open-topo-data',
  }),
  Object.freeze({
    latitude: 26.5667,
    longitude: 56.25,
    elevationMeters: null,
    depthMeters: 30,
    classification: 'WATER' as const,
    sourceProvider: 'open-topo-data',
  }),
]);

// ── Energy Fixtures ─────────────────────────────────────────────────────────

export const FIXTURE_ENERGY: readonly EnergyObservation[] = Object.freeze([
  Object.freeze({
    metricId: 'PET.WCRSTUS1.W',
    name: 'U.S. Crude Oil Stocks',
    value: 425_000_000,
    unit: 'barrels',
    geography: 'US',
    observedAt: FIXTURE_NOW,
    freshnessClass: 'WEEKLY' as unknown as EnergyObservation['freshnessClass'],
    sourceProvider: 'eia',
    provenance: 'fixture/eia/crude-stocks',
  }),
  Object.freeze({
    metricId: 'ELEC.CONS_TOT.US-99.M',
    name: 'U.S. Total Electricity Consumption',
    value: 350_000_000,
    unit: 'MWh',
    geography: 'US',
    observedAt: FIXTURE_NOW,
    freshnessClass: 'MONTHLY',
    sourceProvider: 'eia',
    provenance: 'fixture/eia/electricity-consumption',
  }),
  Object.freeze({
    metricId: 'intensity.forecast',
    name: 'GB Carbon Intensity Forecast',
    value: 185,
    unit: 'gCO2/kWh',
    geography: 'GB',
    observedAt: FIXTURE_NOW,
    freshnessClass: 'HOURLY',
    sourceProvider: 'uk-carbon-intensity',
    provenance: 'fixture/uk-carbon-intensity/forecast',
  }),
]);

// ── Resource Fixtures ─────────────────────────────────────────────────────────

export const FIXTURE_RESOURCES: readonly ResourceObservation[] = Object.freeze([
  Object.freeze({
    resourceId: 'copper-us-production',
    name: 'U.S. Copper Production',
    category: 'METALS',
    productionQuantity: 1_200_000,
    reservesQuantity: 48_000_000,
    unit: 'metric_tons',
    geography: 'US',
    observedAt: FIXTURE_NOW,
    sourceProvider: 'usgs-minerals',
    provenance: 'fixture/usgs/copper',
  }),
  Object.freeze({
    resourceId: 'lithium-global-reserves',
    name: 'Global Lithium Reserves',
    category: 'MINERALS',
    productionQuantity: 130_000,
    reservesQuantity: 22_000_000,
    unit: 'metric_tons',
    geography: 'global',
    observedAt: FIXTURE_NOW,
    sourceProvider: 'usgs-minerals',
    provenance: 'fixture/usgs/lithium',
  }),
]);

// ── Weather Fixtures ──────────────────────────────────────────────────────────

export const FIXTURE_WEATHER: readonly WeatherObservation[] = Object.freeze([
  Object.freeze({
    locationId: FIXTURE_LONDON.locationId,
    condition: 'Partly Cloudy',
    temperatureCelsius: 18.5,
    humidityPercent: 72,
    windSpeedMps: 4.2,
    precipitationMm: 0,
    observedAt: FIXTURE_NOW,
    freshnessClass: 'REALTIME',
    sourceProvider: 'openweathermap',
    provenance: 'fixture/openweathermap/london',
  }),
  Object.freeze({
    locationId: FIXTURE_SPRINGFIELD_IL.locationId,
    condition: 'Clear',
    temperatureCelsius: 24.1,
    humidityPercent: 55,
    windSpeedMps: 2.8,
    precipitationMm: 0,
    observedAt: FIXTURE_NOW,
    freshnessClass: 'REALTIME',
    sourceProvider: 'open-meteo',
    provenance: 'fixture/open-meteo/springfield-il',
  }),
]);

// ── Environmental Fixtures ────────────────────────────────────────────────────

export const FIXTURE_ENVIRONMENTAL: readonly EnvironmentalObservation[] = Object.freeze([
  Object.freeze({
    metricId: 'streamflow-01646500',
    name: 'Potomac River Streamflow',
    value: 1250,
    unit: 'cfs',
    geography: 'US-VA',
    observedAt: FIXTURE_NOW,
    freshnessClass: 'REALTIME',
    sourceProvider: 'usgs-water',
    provenance: 'fixture/usgs-water/potomac',
  }),
  Object.freeze({
    metricId: 'pm25-london',
    name: 'PM2.5 London',
    value: 12.5,
    unit: 'µg/m³',
    geography: 'GB-London',
    observedAt: FIXTURE_NOW,
    freshnessClass: 'HOURLY',
    sourceProvider: 'openaq',
    provenance: 'fixture/openaq/london-pm25',
  }),
]);

// ── Aviation Fixtures ─────────────────────────────────────────────────────────

export const FIXTURE_AVIATION: readonly AviationObservation[] = Object.freeze([
  Object.freeze({
    flightId: 'a1b2c3',
    callsign: 'BAW123',
    origin: 'EGLL',
    destination: 'KJFK',
    latitude: 51.2,
    longitude: -10.5,
    altitudeMeters: 10668,
    heading: 270,
    speedMps: 250,
    observedAt: FIXTURE_NOW,
    freshnessClass: 'REALTIME',
    sourceProvider: 'opensky',
    provenance: 'fixture/opensky/baw123',
  }),
]);

// ── Transit Fixtures ──────────────────────────────────────────────────────────

export const FIXTURE_TRANSIT: readonly TransitObservation[] = Object.freeze([
  Object.freeze({
    routeId: 'tl-12345',
    agency: 'Transport for London',
    routeName: 'Central Line',
    mode: 'SUBWAY',
    geography: 'GB-London',
    status: 'ACTIVE',
    observedAt: FIXTURE_NOW,
    sourceProvider: 'transitland',
    provenance: 'fixture/transitland/central-line',
  }),
]);

// ── Maritime Fixtures ─────────────────────────────────────────────────────────

export const FIXTURE_MARITIME: readonly MaritimeObservation[] = Object.freeze([
  Object.freeze({
    vesselId: 'vessel-001',
    imo: '9123456',
    mmsi: '235123456',
    vesselName: 'ATLANTIC STAR',
    vesselType: 'Tanker',
    latitude: 26.5,
    longitude: 56.3,
    heading: 90,
    speedKnots: 12.5,
    destination: 'SINGAPORE',
    cargoClass: 'CRUDE_OIL',
    observedAt: FIXTURE_NOW,
    freshnessClass: 'REALTIME',
    sourceProvider: 'onwater',
    provenance: 'fixture/onwater/atlantic-star',
  }),
]);

export const FIXTURE_SHIPPING_FLOW: readonly ShippingFlowObservation[] = Object.freeze([
  Object.freeze({
    corridor: 'Strait of Hormuz',
    vesselCount: 42,
    cargoType: 'CRUDE_OIL',
    oilFlowEstimate: '18.5 million barrels/day',
    direction: 'BIDIRECTIONAL',
    timeWindow: '2026-08-31T00:00:00Z/2026-08-31T12:00:00Z',
    observedAt: FIXTURE_NOW,
    sourceProvider: 'hormuz-ship-monitor',
    freshnessClass: 'HOURLY',
    provenance: 'fixture/hormuz/corridor-flow',
  }),
]);

// ── Logistics Fixtures ────────────────────────────────────────────────────────

export const FIXTURE_LOGISTICS: readonly LogisticsObservation[] = Object.freeze([
  Object.freeze({
    observationType: 'SHIPMENT_STATUS',
    trackingId: 'OV-2026-001234',
    status: 'IN_TRANSIT',
    origin: 'DE-Berlin',
    destination: 'FR-Paris',
    fuelType: null,
    priceMinor: null,
    currency: null,
    priceUnit: null,
    region: 'EU',
    effectiveAt: FIXTURE_NOW,
    sourceProvider: 'openvan',
    provenance: 'fixture/openvan/shipment-001234',
  }),
  Object.freeze({
    observationType: 'FUEL_PRICE',
    trackingId: null,
    status: 'CURRENT',
    origin: null,
    destination: null,
    fuelType: 'DIESEL',
    priceMinor: 185n,
    currency: 'EUR',
    priceUnit: 'EUR/liter',
    region: 'DE',
    effectiveAt: FIXTURE_NOW,
    sourceProvider: 'openvan',
    provenance: 'fixture/openvan/fuel-diesel-de',
  }),
]);

export const WAVE5_CHAOS_PROVIDERS = Object.freeze({
  energyDown: 'eia',
  weatherRateLimited: 'openweathermap',
  waterMalformed: 'usgs-water',
  aviationTimeout: 'opensky',
  geocodingDown: 'nominatim',
  maritimeStale: 'hormuz-ship-monitor',
});

export const WAVE5_MALFORMED_PROVIDER = 'fixture-malformed-water';
export const WAVE5_RATE_LIMIT_PROVIDER = 'fixture-rate-limited-weather';
export const WAVE5_TIMEOUT_PROVIDER = 'fixture-timeout-aviation';
