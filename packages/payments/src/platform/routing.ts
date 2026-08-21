/**
 * Canonical provider-independent routing contract.
 * Domain code asks to route a payment. It never knows vendor endpoints.
 *
 * Phase D will bind real adapters behind this port. This file does not
 * implement the universal provider lifecycle.
 */

import { LIVE_PAYMENTS_ENABLED } from '../../../config/src/flags.ts';
import type { Money } from '../../../money/src/money.ts';
import type { RailAdapter, RailSubmitResult, RailQueryResponse, RailCancelResult } from '../rail-port.ts';
import type { RailCapability } from '../rail-capability.ts';
import type { RailClass } from '../rail-types.ts';

export type PaymentRouteInquiry = {
  readonly sourceCountry: string;
  readonly destinationCountry: string;
  readonly currency: string;
  readonly amount: Money;
  readonly railPreference?: RailClass;
};

export type PaymentRouteAvailability = {
  readonly available: boolean;
  readonly countries: readonly string[];
  readonly currencies: readonly string[];
  readonly rails: readonly RailClass[];
  readonly limits: { readonly minMinorUnits: string; readonly maxMinorUnits: string };
  readonly estimatedFees: 'PROVIDER_DEFINED';
  readonly cancellationSupported: boolean;
  readonly connectivity: 'SIMULATION';
  readonly productionEnabled: false;
};

/**
 * Orchestration asks the router to route a payment. Adapters stay behind
 * RailAdapter. Domain never sees vendor URLs or credentials.
 */
export type PaymentRouter = {
  inquire(request: PaymentRouteInquiry): PaymentRouteAvailability;
  routePayment(adapter: RailAdapter, command: Parameters<RailAdapter['submitPayment']>[0]): RailSubmitResult;
  inquireStatus(adapter: RailAdapter, request: Parameters<RailAdapter['queryPayment']>[0]): RailQueryResponse;
  cancelWhereSupported(
    adapter: RailAdapter,
    request: Parameters<RailAdapter['cancelPayment']>[0],
  ): RailCancelResult;
};

export function availabilityFromCapability(capability: RailCapability): PaymentRouteAvailability {
  if (LIVE_PAYMENTS_ENABLED) {
    throw new Error('payment router cannot advertise live money movement');
  }
  return Object.freeze({
    available: capability.available && capability.enabled,
    countries: Object.freeze([...new Set([...capability.sourceCountries, ...capability.destinationCountries])]),
    currencies: Object.freeze([...capability.supportedCurrencies]),
    rails: Object.freeze([capability.rail]),
    limits: Object.freeze({
      minMinorUnits: capability.amountConstraints.minMinorUnits.toString(),
      maxMinorUnits: capability.amountConstraints.maxMinorUnits.toString(),
    }),
    estimatedFees: 'PROVIDER_DEFINED',
    cancellationSupported: capability.cancellationSupported,
    connectivity: 'SIMULATION',
    productionEnabled: false,
  });
}

export const SimulationPaymentRouter: PaymentRouter = {
  inquire(request) {
    void request;
    return Object.freeze({
      available: true,
      countries: Object.freeze(['US', 'GB', 'SA', 'AE', 'DE', 'FR', 'IE']),
      currencies: Object.freeze(['USD', 'GBP', 'SAR', 'AED', 'EUR']),
      rails: Object.freeze(['US_BATCH', 'US_INSTANT', 'EU_SEPA', 'INTERNATIONAL_CORRESPONDENT', 'SA_DOMESTIC'] as const satisfies readonly RailClass[]),
      limits: Object.freeze({ minMinorUnits: '1', maxMinorUnits: '100000000' }),
      estimatedFees: 'PROVIDER_DEFINED',
      cancellationSupported: true,
      connectivity: 'SIMULATION',
      productionEnabled: false,
    });
  },
  routePayment(adapter, command) {
    return adapter.submitPayment(command);
  },
  inquireStatus(adapter, request) {
    return adapter.queryPayment(request);
  },
  cancelWhereSupported(adapter, request) {
    return adapter.cancelPayment(request);
  },
};
