/**
 * HELIOS OS04 — venue capability manifest field types.
 *
 * Unknown capabilities must be declared UNAVAILABLE — never assumed supported.
 */

import type {
  HeliosOs04VenueId,
  VenueAssetClass,
  VenueCapabilityAvailability,
  VenueHealthState,
  VenueMarketDataType,
  VenueOrderType,
  VenueTimeInForce,
  VenueTimestampSemantics,
} from './taxonomy.ts';

export type VenueDeclaredField<T> = Readonly<
  | { readonly availability: 'UNAVAILABLE' }
  | { readonly availability: 'AVAILABLE'; readonly value: T }
>;

export type VenueRateLimitDeclaration = Readonly<{
  readonly restRequestsPerSecond: number | null;
  readonly websocketSubscriptionsMax: number | null;
  readonly notes: string | null;
}>;

export type VenuePrecisionDeclaration = Readonly<{
  readonly priceDecimals: number | null;
  readonly quantityDecimals: number | null;
  readonly notionalDecimals: number | null;
}>;

export type VenueFeeDeclaration = Readonly<{
  readonly makerBps: number | null;
  readonly takerBps: number | null;
  readonly currency: string | null;
}>;

export type VenueMinimumQuantityDeclaration = Readonly<{
  readonly value: string;
  readonly unit: string;
}>;

export type VenueMinimumNotionalDeclaration = Readonly<{
  readonly valueMinor: string;
  readonly currency: string;
}>;

export type VenueBooleanCapability = VenueDeclaredField<boolean>;

export type VenueMarketDataCapability = Readonly<{
  readonly marketDataTypes: VenueDeclaredField<readonly VenueMarketDataType[]>;
  readonly websocketAvailable: VenueBooleanCapability;
  readonly restAvailable: VenueBooleanCapability;
  readonly historicalDataSupport: VenueBooleanCapability;
  readonly timestampSemantics: VenueDeclaredField<VenueTimestampSemantics>;
  readonly rateLimits: VenueDeclaredField<VenueRateLimitDeclaration>;
}>;

export type VenueOrderCapability = Readonly<{
  readonly orderTypes: VenueDeclaredField<readonly VenueOrderType[]>;
  readonly tifTypes: VenueDeclaredField<readonly VenueTimeInForce[]>;
  readonly precision: VenueDeclaredField<VenuePrecisionDeclaration>;
  readonly minimumQuantity: VenueDeclaredField<VenueMinimumQuantityDeclaration>;
  readonly minimumNotional: VenueDeclaredField<VenueMinimumNotionalDeclaration>;
  readonly makerTakerFees: VenueDeclaredField<VenueFeeDeclaration>;
  readonly reduceOnlySupport: VenueBooleanCapability;
  readonly postOnlySupport: VenueBooleanCapability;
  readonly fundingSupport: VenueBooleanCapability;
}>;

export type VenueAccountCapability = Readonly<{
  readonly sandboxAvailability: VenueBooleanCapability;
  readonly subAccountSupport: VenueBooleanCapability;
  readonly portfolioMarginSupport: VenueBooleanCapability;
}>;

export type VenueReconciliationCapability = Readonly<{
  readonly reconciliationSupport: VenueBooleanCapability;
  readonly fillHistoryAvailable: VenueBooleanCapability;
  readonly ledgerExportAvailable: VenueBooleanCapability;
}>;

export type VenueCapabilityManifest = Readonly<{
  readonly venueId: HeliosOs04VenueId;
  readonly displayName: string;
  readonly assetClasses: VenueDeclaredField<readonly VenueAssetClass[]>;
  readonly instruments: VenueDeclaredField<readonly string[]>;
  readonly venues: VenueDeclaredField<readonly string[]>;
  readonly marketData: VenueMarketDataCapability;
  readonly orders: VenueOrderCapability;
  readonly account: VenueAccountCapability;
  readonly reconciliation: VenueReconciliationCapability;
  readonly healthState: VenueHealthState;
  readonly liveOrderPlacementEnabled: false;
  readonly qualificationNotes: readonly string[];
}>;

export type VenueConformanceCheck = Readonly<{
  readonly checkId: string;
  readonly outcome: import('./taxonomy.ts').VenueConformanceOutcome;
  readonly message: string;
}>;

export type VenueConformanceReport = Readonly<{
  readonly venueId: HeliosOs04VenueId;
  readonly schemaVersion: typeof import('./taxonomy.ts').HELIOS_VENUE_ADAPTER_SCHEMA_VERSION;
  readonly evaluatedAt: string;
  readonly qualificationMode: import('./taxonomy.ts').VenueConformanceQualificationMode;
  readonly checks: readonly VenueConformanceCheck[];
  readonly conformancePassed: boolean;
  readonly adapterQualified: boolean;
  readonly manifest: VenueCapabilityManifest;
}>;

export type VenueMarketDataProbeRequest = Readonly<{
  readonly symbol: string;
  readonly qualificationMode: import('./taxonomy.ts').VenueConformanceQualificationMode;
}>;

export type VenueMarketDataProbeResult = Readonly<
  | { readonly ok: true; readonly symbol: string; readonly lastPrice: string; readonly observedAt: string }
  | { readonly ok: false; readonly reason: string }
>;

export function unavailableField<T>(): VenueDeclaredField<T> {
  return Object.freeze({ availability: 'UNAVAILABLE' });
}

export function availableField<T>(value: T): VenueDeclaredField<T> {
  return Object.freeze({ availability: 'AVAILABLE', value });
}

export function isFieldAvailable<T>(
  field: VenueDeclaredField<T>,
): field is { readonly availability: 'AVAILABLE'; readonly value: T } {
  return field.availability === 'AVAILABLE';
}

export function capabilityAvailability(
  field: VenueDeclaredField<unknown> | VenueBooleanCapability,
): VenueCapabilityAvailability {
  return field.availability;
}
