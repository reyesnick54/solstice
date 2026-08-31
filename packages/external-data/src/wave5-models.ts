/**
 * Wave 5 canonical physical-economy data models.
 *
 * Shared geography model used across World, MoonRey, Travel, Resources, Real Estate.
 * Observations only — no execution authority.
 */

import type { ExternalObservation } from '../../provider-sdk/src/index.ts';

// ── Canonical Geography ───────────────────────────────────────────────────────

export type CanonicalLocationId = string;

export type CanonicalGeography = {
  readonly locationId: CanonicalLocationId;
  readonly country: string;
  readonly countryCode: string;
  readonly region: string | null;
  readonly city: string | null;
  readonly postalArea: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly timezone: string | null;
  readonly adminHierarchy: readonly string[];
  readonly providerNativeIds: Readonly<Record<string, string>>;
  readonly provenance: string;
};

export type CountryMetadata = {
  readonly countryCode: string;
  readonly name: string;
  readonly officialName: string;
  readonly capital: string | null;
  readonly currencies: readonly { readonly code: string; readonly name: string }[];
  readonly languages: readonly string[];
  readonly region: string | null;
  readonly subregion: string | null;
  readonly borders: readonly string[];
  readonly population: number | null;
  readonly sourceProvider: string;
};

export type GeocodeResult = {
  readonly locationId: CanonicalLocationId;
  readonly displayName: string;
  readonly geography: CanonicalGeography;
  readonly confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  readonly sourceProvider: string;
};

export type IpGeolocationResult = {
  readonly ip: string;
  readonly country: string;
  readonly countryCode: string;
  readonly region: string | null;
  readonly city: string | null;
  readonly timezone: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly asn: string | null;
  readonly isp: string | null;
  readonly accuracy: 'APPROXIMATE';
  readonly sourceProvider: string;
};

export type ElevationResult = {
  readonly latitude: number;
  readonly longitude: number;
  readonly elevationMeters: number | null;
  readonly depthMeters: number | null;
  readonly classification: 'LAND' | 'WATER' | 'UNKNOWN';
  readonly sourceProvider: string;
};

// ── Energy ──────────────────────────────────────────────────────────────────

export type EnergyObservation = {
  readonly metricId: string;
  readonly name: string;
  readonly value: number;
  readonly unit: string;
  readonly geography: string;
  readonly observedAt: string;
  readonly freshnessClass: 'REALTIME' | 'HOURLY' | 'DAILY' | 'MONTHLY';
  readonly sourceProvider: string;
  readonly provenance: string;
};

// ── Resources ───────────────────────────────────────────────────────────────

export type ResourceObservation = {
  readonly resourceId: string;
  readonly name: string;
  readonly category: string;
  readonly productionQuantity: number | null;
  readonly reservesQuantity: number | null;
  readonly unit: string;
  readonly geography: string;
  readonly observedAt: string;
  readonly sourceProvider: string;
  readonly provenance: string;
};

// ── Weather / Environment ───────────────────────────────────────────────────

export type WeatherObservation = {
  readonly locationId: CanonicalLocationId;
  readonly condition: string;
  readonly temperatureCelsius: number | null;
  readonly humidityPercent: number | null;
  readonly windSpeedMps: number | null;
  readonly precipitationMm: number | null;
  readonly observedAt: string;
  readonly freshnessClass: 'REALTIME' | 'HOURLY';
  readonly sourceProvider: string;
  readonly provenance: string;
};

export type EnvironmentalObservation = {
  readonly metricId: string;
  readonly name: string;
  readonly value: number;
  readonly unit: string;
  readonly geography: string;
  readonly observedAt: string;
  readonly freshnessClass: 'REALTIME' | 'HOURLY' | 'DAILY' | 'HISTORICAL';
  readonly sourceProvider: string;
  readonly provenance: string;
};

// ── Aviation / Travel ───────────────────────────────────────────────────────

export type AviationObservation = {
  readonly flightId: string;
  readonly callsign: string | null;
  readonly origin: string | null;
  readonly destination: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly altitudeMeters: number | null;
  readonly heading: number | null;
  readonly speedMps: number | null;
  readonly observedAt: string;
  readonly freshnessClass: 'REALTIME';
  readonly sourceProvider: string;
  readonly provenance: string;
};

export type TransitObservation = {
  readonly routeId: string;
  readonly agency: string;
  readonly routeName: string;
  readonly mode: 'BUS' | 'RAIL' | 'SUBWAY' | 'TRAM' | 'FERRY' | 'OTHER';
  readonly geography: string;
  readonly status: 'ACTIVE' | 'SUSPENDED' | 'UNKNOWN';
  readonly observedAt: string;
  readonly sourceProvider: string;
  readonly provenance: string;
};

// ── Maritime ────────────────────────────────────────────────────────────────

export type MaritimeObservation = {
  readonly vesselId: string | null;
  readonly imo: string | null;
  readonly mmsi: string | null;
  readonly vesselName: string | null;
  readonly vesselType: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly heading: number | null;
  readonly speedKnots: number | null;
  readonly destination: string | null;
  readonly cargoClass: string | null;
  readonly observedAt: string;
  readonly sourceProvider: string;
  readonly freshnessClass: 'REALTIME' | 'HOURLY';
  readonly provenance: string;
};

export type ShippingFlowObservation = {
  readonly corridor: string;
  readonly vesselCount: number | null;
  readonly cargoType: string | null;
  readonly oilFlowEstimate: string | null;
  readonly direction: 'INBOUND' | 'OUTBOUND' | 'BIDIRECTIONAL' | 'UNKNOWN';
  readonly timeWindow: string;
  readonly observedAt: string;
  readonly sourceProvider: string;
  readonly freshnessClass: 'HOURLY' | 'DAILY';
  readonly provenance: string;
};

// ── Logistics ───────────────────────────────────────────────────────────────

export type LogisticsObservationType =
  | 'SHIPMENT_STATUS'
  | 'TRANSPORT_FLOW'
  | 'FUEL_PRICE'
  | 'PORT_ACTIVITY'
  | 'DELIVERY_STATUS'
  | 'TRANSPORT_NETWORK_STATUS';

export type LogisticsObservation = {
  readonly observationType: LogisticsObservationType;
  readonly trackingId: string | null;
  readonly status: string;
  readonly origin: string | null;
  readonly destination: string | null;
  readonly fuelType: string | null;
  readonly priceMinor: bigint | null;
  readonly currency: string | null;
  readonly priceUnit: string | null;
  readonly region: string | null;
  readonly effectiveAt: string;
  readonly sourceProvider: string;
  readonly provenance: string;
};

// ── Coverage / Health ───────────────────────────────────────────────────────

export type Wave5CoverageStatus =
  | 'IMPLEMENTED'
  | 'BLOCKED'
  | 'DEPRECATED'
  | 'UNAVAILABLE'
  | 'NOT_WAVE_5';

export type Wave5ProviderCoverage = {
  readonly providerId: string;
  readonly category: string;
  readonly status: Wave5CoverageStatus;
  readonly notes: string;
};

export type Wave5ServiceResult<T> = {
  readonly observations: readonly ExternalObservation<T>[];
  readonly degraded: boolean;
  readonly stale: boolean;
  readonly providersUsed: readonly string[];
  readonly conflicts: readonly { readonly providerId: string; readonly field: string; readonly message: string }[];
};

// ── Productive Economic Graph ─────────────────────────────────────────────────

export type PegNodeType =
  | 'COUNTRY'
  | 'CITY'
  | 'PORT'
  | 'AIRPORT'
  | 'SHIPPING_CORRIDOR'
  | 'ENERGY_GRID'
  | 'RESOURCE_REGION'
  | 'TRANSPORT_NETWORK';

export type PegEdgeType =
  | 'CONNECTED_TO'
  | 'SHIPS_TO'
  | 'SUPPLIES'
  | 'LOCATED_IN'
  | 'TRANSPORTS'
  | 'IMPORTS_FROM'
  | 'EXPORTS_TO';

export type PegNode = {
  readonly nodeId: string;
  readonly nodeType: PegNodeType;
  readonly label: string;
  readonly geography: CanonicalGeography | null;
  readonly sourceObservationId: string | null;
};

export type PegEdge = {
  readonly edgeId: string;
  readonly edgeType: PegEdgeType;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly evidenceRef: string | null;
};

export type ProductiveEconomicGraphSnapshot = {
  readonly schema: 'sunrey.productive-economic-graph.v1';
  readonly nodes: readonly PegNode[];
  readonly edges: readonly PegEdge[];
  readonly observationCount: number;
  readonly grantsIssuanceAuthority: false;
};

export type ExternalDataObservation<T> = ExternalObservation<T>;
