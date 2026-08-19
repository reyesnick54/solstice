/**
 * demo:moonrey-logistics-data-fabric
 *
 * manufactured batch B1 → carrier pickup → two transport legs →
 * delivery completion → warehouse storage period.
 */

import { resetDeliveryDedup } from './delivery.ts';
import { ingestLogisticsObservation } from './adapter.ts';
import {
  COLD_STORAGE,
  COMPLETED_DELIVERY,
  MANUFACTURING_BATCH,
  MULTI_LEG_SHIPMENT,
  VALID_TONNE_KM,
  WAREHOUSE_VOLUME_TIME,
} from './fixtures.ts';
import {
  GOODS_PRODUCTION_RECOUNTED_AS_LOGISTICS,
  PRODUCTION_ACTIVE,
  RAW_GPS_PUBLIC,
  REAL_CARRIER_CONTACTED,
  WAREHOUSE_CAPACITY_EQUALS_STORAGE_SERVICE,
} from './types.ts';

export function runMoonReyLogisticsDataFabricDemo(): {
  readonly manufacturingQuantity: bigint;
  readonly logisticsTonneKm: string;
  readonly legs: number;
  readonly deliveryAccepted: boolean;
  readonly storageUnit: string | null;
  readonly events: number;
  readonly goodsRecounted: false;
} {
  resetDeliveryDedup();
  const pickup = ingestLogisticsObservation(VALID_TONNE_KM);
  const legs = ingestLogisticsObservation(MULTI_LEG_SHIPMENT);
  const delivery = ingestLogisticsObservation(COMPLETED_DELIVERY);
  const storage = ingestLogisticsObservation(WAREHOUSE_VOLUME_TIME);
  const cold = ingestLogisticsObservation(COLD_STORAGE);

  const decisions = [pickup, legs, delivery, storage, cold];
  const accepted = decisions.filter((row) => row.ok && row.value.accepted);
  const logisticsTonneKm = pickup.ok && pickup.value.publicEvidence?.mantissa
    ? pickup.value.publicEvidence.mantissa
    : '0';
  const legCount = legs.ok ? legs.value.events.length : 0;
  const storageUnit = storage.ok ? storage.value.publicEvidence?.unit ?? null : null;

  console.log('MoonRey logistics, freight, delivery, and storage data fabric demo');
  console.log(`manufacturing batch ${MANUFACTURING_BATCH.batchRef} remains upstream (${MANUFACTURING_BATCH.quantity} ${MANUFACTURING_BATCH.unit})`);
  console.log(`carrier pickup tonne-km=${logisticsTonneKm}`);
  console.log(`independently realized legs=${legCount}`);
  console.log(`delivery completed=${delivery.ok && delivery.value.accepted}`);
  console.log(`warehouse storage unit=${storageUnit}`);
  console.log(`cold storage is a time-based service, not a temperature event count`);
  console.log(`accepted observations=${accepted.length}`);
  console.log('');
  console.log(`RAW_GPS_PUBLIC=${RAW_GPS_PUBLIC}`);
  console.log(`GOODS_PRODUCTION_RECOUNTED_AS_LOGISTICS=${GOODS_PRODUCTION_RECOUNTED_AS_LOGISTICS}`);
  console.log(`WAREHOUSE_CAPACITY_EQUALS_STORAGE_SERVICE=${WAREHOUSE_CAPACITY_EQUALS_STORAGE_SERVICE}`);
  console.log(`REAL_CARRIER_CONTACTED=${REAL_CARRIER_CONTACTED}`);
  console.log(`PRODUCTION_ACTIVE=${PRODUCTION_ACTIVE}`);

  return {
    manufacturingQuantity: MANUFACTURING_BATCH.quantity,
    logisticsTonneKm,
    legs: legCount,
    deliveryAccepted: delivery.ok && delivery.value.accepted,
    storageUnit,
    events: accepted.reduce((sum, row) => sum + (row.ok ? row.value.events.length : 0), 0),
    goodsRecounted: GOODS_PRODUCTION_RECOUNTED_AS_LOGISTICS,
  };
}

runMoonReyLogisticsDataFabricDemo();
