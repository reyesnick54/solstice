/**
 * Chunk 121 attribution fixtures.
 *
 * Subjects consume Chunk 120-style economicEventId values. This module
 * does not mint, value, or activate production providers.
 */

import type { EconomicEventClass } from '../../source-taxonomy/types.ts';
import type { ClaimType, ProductiveCategory } from '../../types.ts';
import type { AttributionSubject, EventRelationship } from './types.ts';

export const COMPANY_A = 'controller.company-a' as const;
export const ENERGY_CO = 'controller.energy-producer' as const;
export const FREIGHT_CO = 'controller.freight-carrier' as const;
export const WAREHOUSE_CO = 'controller.warehouse' as const;

export function subject(input: {
  readonly claimId: string;
  readonly contributionId?: string;
  readonly economicEventId: string;
  readonly category: ProductiveCategory;
  readonly claimType?: ClaimType;
  readonly eventClass?: EconomicEventClass;
  readonly controllerId: string;
  readonly quantity?: bigint;
  readonly unitId?: string;
  readonly measurementSemantics?: string;
  readonly evidenceRefs?: readonly string[];
  readonly lineageEventIds?: readonly string[];
  readonly lineageComplete?: boolean;
  readonly batchIdentity?: string;
  readonly relatedEventIds?: readonly string[];
  readonly relatedClaimIds?: readonly string[];
}): AttributionSubject {
  return Object.freeze({
    claimId: input.claimId,
    contributionId: input.contributionId ?? `vpc.${input.claimId}`,
    economicEventId: input.economicEventId,
    category: input.category,
    claimType: input.claimType ?? 'OUTPUT',
    eventClass: input.eventClass ?? 'PRODUCTION_OUTPUT',
    controllerId: input.controllerId,
    quantity: input.quantity ?? 100n,
    unitId: input.unitId ?? 'UNIT',
    measurementSemantics: input.measurementSemantics ?? 'units_produced',
    evidenceRefs: input.evidenceRefs ?? Object.freeze([`ev.${input.claimId}`]),
    lineageEventIds: input.lineageEventIds ?? Object.freeze([]),
    lineageComplete: input.lineageComplete ?? true,
    batchIdentity: input.batchIdentity,
    relatedEventIds: input.relatedEventIds ?? Object.freeze([]),
    relatedClaimIds: input.relatedClaimIds ?? Object.freeze([]),
  });
}

export function relationship(
  leftEventId: string,
  rightEventId: string,
  kind: EventRelationship['kind'],
  confidence: EventRelationship['confidence'] = 'DECLARED',
): EventRelationship {
  return Object.freeze({ leftEventId, rightEventId, kind, confidence });
}

/** Energy producer → factory → robot → batch → freight → warehouse. */
export function supplyChainSubjects(): {
  readonly energy: AttributionSubject;
  readonly factoryConsumption: AttributionSubject;
  readonly manufacturing: AttributionSubject;
  readonly robot: AttributionSubject;
  readonly goods: AttributionSubject;
  readonly freight: AttributionSubject;
  readonly storage: AttributionSubject;
  readonly relationships: readonly EventRelationship[];
} {
  const energy = subject({
    claimId: 'claim.energy.output',
    economicEventId: 'pee.energy.gen.1',
    category: 'ENERGY',
    controllerId: ENERGY_CO,
    quantity: 12_000n,
    unitId: 'kWh',
    measurementSemantics: 'energy_output',
    evidenceRefs: ['ev.energy.meter'],
  });
  const factoryConsumption = subject({
    claimId: 'claim.factory.energy-use',
    economicEventId: 'pee.factory.energy-use.1',
    category: 'MANUFACTURING',
    claimType: 'USAGE',
    eventClass: 'CONSUMPTION',
    controllerId: COMPANY_A,
    quantity: 12_000n,
    unitId: 'kWh',
    measurementSemantics: 'energy_input',
    lineageEventIds: [energy.economicEventId],
    evidenceRefs: ['ev.factory.energy-draw'],
  });
  const manufacturing = subject({
    claimId: 'claim.factory.output',
    economicEventId: 'pee.factory.transform.1',
    category: 'MANUFACTURING',
    controllerId: COMPANY_A,
    quantity: 100n,
    unitId: 'UNIT',
    measurementSemantics: 'units_produced',
    batchIdentity: 'batch.widget.100',
    lineageEventIds: [energy.economicEventId],
    evidenceRefs: ['ev.factory.erp'],
  });
  const robot = subject({
    claimId: 'claim.robot.cycle',
    economicEventId: 'pee.factory.transform.1',
    category: 'AUTOMATED_MACHINE_OUTPUT',
    claimType: 'USAGE',
    eventClass: 'USAGE',
    controllerId: COMPANY_A,
    quantity: 4n,
    unitId: 'machine_h',
    measurementSemantics: 'machine_time',
    batchIdentity: 'batch.widget.100',
    evidenceRefs: ['ev.robot.cycle'],
  });
  const goods = subject({
    claimId: 'claim.goods.batch',
    economicEventId: 'pee.factory.transform.1',
    category: 'GOODS',
    controllerId: COMPANY_A,
    quantity: 100n,
    unitId: 'UNIT',
    measurementSemantics: 'goods_identity',
    batchIdentity: 'batch.widget.100',
    evidenceRefs: ['ev.erp.goods'],
  });
  const freight = subject({
    claimId: 'claim.freight.delivery',
    economicEventId: 'pee.freight.haul.1',
    category: 'LOGISTICS_TRANSPORTATION',
    claimType: 'DELIVERY',
    eventClass: 'DELIVERY',
    controllerId: FREIGHT_CO,
    quantity: 250n,
    unitId: 't_km',
    measurementSemantics: 'tonne_km',
    batchIdentity: 'batch.widget.100',
    lineageEventIds: [manufacturing.economicEventId],
    evidenceRefs: ['ev.freight.bol', 'delivery_completion'],
  });
  const storage = subject({
    claimId: 'claim.warehouse.hold',
    economicEventId: 'pee.warehouse.hold.1',
    category: 'STORAGE',
    claimType: 'USAGE',
    eventClass: 'USAGE',
    controllerId: WAREHOUSE_CO,
    quantity: 72n,
    unitId: 'm3_h',
    measurementSemantics: 'volume_time',
    batchIdentity: 'batch.widget.100',
    lineageEventIds: [freight.economicEventId],
    evidenceRefs: ['ev.warehouse.lease', 'facility_use', 'realized_service_period'],
  });
  return {
    energy,
    factoryConsumption,
    manufacturing,
    robot,
    goods,
    freight,
    storage,
    relationships: Object.freeze([
      relationship(energy.economicEventId, factoryConsumption.economicEventId, 'DEPENDENT_INPUT'),
      relationship(energy.economicEventId, manufacturing.economicEventId, 'DEPENDENT_INPUT'),
      relationship(manufacturing.economicEventId, robot.economicEventId, 'SAME_UNDERLYING_EVENT'),
      relationship(manufacturing.economicEventId, goods.economicEventId, 'GOODS_IDENTITY'),
      relationship(manufacturing.economicEventId, freight.economicEventId, 'DISTINCT_REALIZED_SERVICE'),
      relationship(goods.economicEventId, storage.economicEventId, 'DISTINCT_REALIZED_SERVICE'),
    ]),
  };
}

export function computePair(sameEvent = true): {
  readonly compute: AttributionSubject;
  readonly ai: AttributionSubject;
} {
  const eventId = sameEvent ? 'pee.gpu.exec.1' : 'pee.gpu.exec.ai';
  return {
    compute: subject({
      claimId: 'claim.compute.gpu',
      economicEventId: 'pee.gpu.exec.1',
      category: 'COMPUTE',
      controllerId: COMPANY_A,
      quantity: 3_600n,
      unitId: 'gpu_s',
      measurementSemantics: 'gpu_time',
    }),
    ai: subject({
      claimId: 'claim.ai.gpu',
      economicEventId: eventId,
      category: 'AI_COMPUTE',
      controllerId: COMPANY_A,
      quantity: 3_600n,
      unitId: 'gpu_s',
      measurementSemantics: 'gpu_time',
    }),
  };
}
