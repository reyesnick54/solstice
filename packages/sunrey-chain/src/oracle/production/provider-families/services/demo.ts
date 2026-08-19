/**
 * Service-family demo helper. Combined scenario lives in goods/demo.ts.
 */

import { ingestServiceObservation } from './adapter.ts';
import { BOOKING_AS_COMPLETION, INVOICE_AS_COMPLETION, VALID_UNITIZED_SERVICE } from './fixtures.ts';
import {
  HUMAN_WORTH_SCORING,
  INVOICE_EQUALS_COMPLETED_SERVICE,
  PRODUCTION_ACTIVE,
  REAL_PROVIDER_CONTACTED,
} from './types.ts';

export function runServicesDataFabricDemo(): {
  readonly bookingAccepted: boolean;
  readonly invoiceAccepted: boolean;
  readonly completedAccepted: boolean;
} {
  const booking = ingestServiceObservation(BOOKING_AS_COMPLETION);
  const invoice = ingestServiceObservation(INVOICE_AS_COMPLETION);
  const completed = ingestServiceObservation(VALID_UNITIZED_SERVICE);
  console.log('MoonRey services data fabric');
  console.log(`booking accepted=${booking.ok}`);
  console.log(`invoice accepted=${invoice.ok}`);
  console.log(`completed accepted=${completed.ok}`);
  console.log(`INVOICE_EQUALS_COMPLETED_SERVICE=${INVOICE_EQUALS_COMPLETED_SERVICE}`);
  console.log(`HUMAN_WORTH_SCORING=${HUMAN_WORTH_SCORING}`);
  console.log(`REAL_PROVIDER_CONTACTED=${REAL_PROVIDER_CONTACTED}`);
  console.log(`PRODUCTION_ACTIVE=${PRODUCTION_ACTIVE}`);
  return {
    bookingAccepted: booking.ok,
    invoiceAccepted: invoice.ok,
    completedAccepted: completed.ok,
  };
}

const invokedDirectly = (process.argv[1] ?? '').includes('provider-families/services/demo');
if (invokedDirectly) {
  runServicesDataFabricDemo();
}
