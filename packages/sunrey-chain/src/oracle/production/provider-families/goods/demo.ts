/**
 * demo:moonrey-goods-services-data-fabric
 *
 * factory manufactures a batch → finished-goods record → carrier
 * delivery → receiver acceptance, with attribution-safe relationships.
 *
 * Then: service booking → work performed → service completion.
 * Booking and invoice do not equal completion.
 */

import { ingestManufacturingObservation } from '../manufacturing/index.ts';
import { manufacturingObservation } from '../manufacturing/fixtures.ts';
import { ingestLogisticsObservation, resetDeliveryDedup } from '../logistics/index.ts';
import { COMPLETED_DELIVERY } from '../logistics/fixtures.ts';
import {
  HUMAN_WORTH_SCORING as GOODS_HUMAN_WORTH,
  ORDER_EQUALS_OUTPUT,
  PAYMENT_EQUALS_PRODUCTIVE_OUTPUT,
  PRODUCTION_ACTIVE,
  REAL_PROVIDER_CONTACTED,
  evaluateLogisticsGoodsDeliveryAttribution,
  evaluateManufacturingGoodsAttribution,
  ingestGoodsObservation,
} from './index.ts';
import { SANDBOX_CARRIER_EVENT, SANDBOX_MFG_EVENT, VALID_FINISHED_GOODS_BATCH, VALID_GOODS_DELIVERY } from './fixtures.ts';
import {
  BOOKING_AS_COMPLETION,
  HUMAN_WORTH_SCORING as SERVICE_HUMAN_WORTH,
  INVOICE_AS_COMPLETION,
  INVOICE_EQUALS_COMPLETED_SERVICE,
  VALID_UNITIZED_SERVICE,
  ingestServiceObservation,
} from '../services/index.ts';

export function runMoonReyGoodsServicesDataFabricDemo(): {
  readonly manufacturingAccepted: boolean;
  readonly goodsAccepted: boolean;
  readonly carrierAccepted: boolean;
  readonly receiverAccepted: boolean;
  readonly manufacturingGoodsFullCredits: number;
  readonly bookingAccepted: boolean;
  readonly invoiceAccepted: boolean;
  readonly serviceCompleted: boolean;
} {
  resetDeliveryDedup();

  const manufacturing = ingestManufacturingObservation(
    manufacturingObservation({
      observationId: 'obs.mfg.demo.batch',
      sourceClass: 'MES',
      numericValue: '100',
    }),
  );
  const goods = ingestGoodsObservation(VALID_FINISHED_GOODS_BATCH);
  const carrier = ingestLogisticsObservation(COMPLETED_DELIVERY);
  const receiver = ingestGoodsObservation(VALID_GOODS_DELIVERY);
  const mfgAttr = goods.ok
    ? evaluateManufacturingGoodsAttribution(SANDBOX_MFG_EVENT, VALID_FINISHED_GOODS_BATCH)
    : null;
  const deliveryAttr = receiver.ok
    ? evaluateLogisticsGoodsDeliveryAttribution(SANDBOX_CARRIER_EVENT, VALID_GOODS_DELIVERY, false)
    : null;

  const booking = ingestServiceObservation(BOOKING_AS_COMPLETION);
  const invoice = ingestServiceObservation(INVOICE_AS_COMPLETION);
  const completed = ingestServiceObservation(VALID_UNITIZED_SERVICE);

  const manufacturingGoodsFullCredits =
    mfgAttr && mfgAttr.ok ? mfgAttr.value.decisions.filter((row) => row.decision === 'FULL_ATTRIBUTION').length : -1;

  console.log('MoonRey goods, commerce, and service delivery data fabric demo');
  console.log(`factory manufacturing accepted=${manufacturing.ok}`);
  console.log(`finished goods record accepted=${goods.ok && goods.value.publicEvidence.factType === 'GOODS_OUTPUT'}`);
  console.log(`carrier delivery accepted=${carrier.ok && carrier.value.accepted}`);
  console.log(`receiver acceptance accepted=${receiver.ok}`);
  console.log(`manufacturing+goods full credits=${manufacturingGoodsFullCredits} (must not be 2)`);
  console.log(
    `carrier+goods-delivery full credits=${
      deliveryAttr && deliveryAttr.ok
        ? deliveryAttr.value.decisions.filter((row) => row.decision === 'FULL_ATTRIBUTION').length
        : 'n/a'
    }`,
  );
  console.log(`service booking accepted=${booking.ok} (must be false)`);
  console.log(`invoice as completion accepted=${invoice.ok} (must be false)`);
  console.log(`service work completed accepted=${completed.ok}`);
  console.log('');
  console.log(`ORDER_EQUALS_OUTPUT=${ORDER_EQUALS_OUTPUT}`);
  console.log(`INVOICE_EQUALS_COMPLETED_SERVICE=${INVOICE_EQUALS_COMPLETED_SERVICE}`);
  console.log(`PAYMENT_EQUALS_PRODUCTIVE_OUTPUT=${PAYMENT_EQUALS_PRODUCTIVE_OUTPUT}`);
  console.log(`HUMAN_WORTH_SCORING=${GOODS_HUMAN_WORTH || SERVICE_HUMAN_WORTH}`);
  console.log(`REAL_PROVIDER_CONTACTED=${REAL_PROVIDER_CONTACTED}`);
  console.log(`PRODUCTION_ACTIVE=${PRODUCTION_ACTIVE}`);

  return {
    manufacturingAccepted: manufacturing.ok,
    goodsAccepted: goods.ok,
    carrierAccepted: carrier.ok && carrier.value.accepted,
    receiverAccepted: receiver.ok,
    manufacturingGoodsFullCredits,
    bookingAccepted: booking.ok,
    invoiceAccepted: invoice.ok,
    serviceCompleted: completed.ok,
  };
}

const invokedDirectly = (process.argv[1] ?? '').includes('provider-families/goods/demo');
if (invokedDirectly) {
  runMoonReyGoodsServicesDataFabricDemo();
}
