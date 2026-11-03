/**
 * HELIOS NATIVE05 — exchange order-state normalization and reconciliation semantics.
 */

export type HeliosNormalizedOrderState =
  | 'NEW'
  | 'PARTIALLY_FILLED'
  | 'FILLED'
  | 'CANCELED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'PENDING_CANCEL'
  | 'UNKNOWN';

export type HeliosNormalizedOrder = Readonly<{
  readonly venueOrderId: string;
  readonly clientOrderId: string | null;
  readonly symbolCanonical: string;
  readonly state: HeliosNormalizedOrderState;
  readonly filledQuantity: string;
  readonly remainingQuantity: string;
  readonly averagePrice: string | null;
  readonly lastUpdateTimeUtc: string;
  readonly rawStatus: string;
}>;

export type VenueReconciliationMode =
  | 'startup_mass_status'
  | 'periodic_mass_status'
  | 'open_orders_diff'
  | 'fill_history_backfill';

export type VenueReconciliationSemantics = Readonly<{
  readonly supportedModes: readonly VenueReconciliationMode[];
  /** When true, reconciliation must not run while a submit is in-flight (BYTEX guard). */
  readonly blockDuringOpenSubmit: boolean;
  readonly adoptExternalWorkingOrders: boolean;
  readonly unknownStateFailsClosed: boolean;
}>;

const DEFAULT_RECONCILIATION_MODES: readonly VenueReconciliationMode[] = Object.freeze([
  'startup_mass_status',
  'periodic_mass_status',
]);

export const DEFAULT_RECONCILIATION_SEMANTICS: VenueReconciliationSemantics = Object.freeze({
  supportedModes: DEFAULT_RECONCILIATION_MODES,
  blockDuringOpenSubmit: true,
  adoptExternalWorkingOrders: false,
  unknownStateFailsClosed: true,
});
