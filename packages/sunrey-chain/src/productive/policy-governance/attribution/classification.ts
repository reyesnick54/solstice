import type { ProductiveCategory } from '../../types.ts';
import {
  PRODUCTIVE_ECONOMIC_EVENT_CLASSES,
  relationImpliesDuplicateValue,
  type EventRelationType,
  type LinkageConfidenceClass,
  type ProductiveEconomicEventClass,
} from './types.ts';

/**
 * Candidate classes for a productive category. The mapping is advisory.
 * Category is never the sole identity of an event.
 */
export const CANDIDATE_EVENT_CLASSES: Readonly<Record<ProductiveCategory, readonly ProductiveEconomicEventClass[]>> =
  Object.freeze({
    ENERGY: ['ENERGY_PRODUCTION_EVENT'],
    FOOD_AGRICULTURE: ['AGRICULTURAL_PRODUCTION_EVENT'],
    WATER: ['WATER_PRODUCTION_EVENT'],
    MINERALS_RAW_MATERIALS: ['RESOURCE_EXTRACTION_EVENT'],
    REAL_ESTATE_USE: ['INFRASTRUCTURE_SERVICE_EVENT', 'SERVICE_DELIVERY_EVENT'],
    COMPUTE: ['COMPUTE_EXECUTION_EVENT'],
    AI_COMPUTE: ['AI_COMPUTE_EVENT', 'COMPUTE_EXECUTION_EVENT'],
    MANUFACTURING: ['MANUFACTURING_TRANSFORMATION_EVENT', 'MACHINE_OPERATION_EVENT', 'GOODS_CREATION_EVENT'],
    LOGISTICS_TRANSPORTATION: ['LOGISTICS_DELIVERY_EVENT'],
    STORAGE: ['STORAGE_SERVICE_EVENT'],
    BANDWIDTH_COMMUNICATIONS: ['BANDWIDTH_SERVICE_EVENT'],
    INFRASTRUCTURE: ['INFRASTRUCTURE_SERVICE_EVENT'],
    GOODS: ['GOODS_CREATION_EVENT', 'MANUFACTURING_TRANSFORMATION_EVENT'],
    SERVICES: ['SERVICE_DELIVERY_EVENT'],
    AUTOMATED_MACHINE_OUTPUT: ['MACHINE_OPERATION_EVENT', 'MANUFACTURING_TRANSFORMATION_EVENT'],
  });

export type ObservationKind =
  | 'FACTORY_MANUFACTURING_OUTPUT'
  | 'ROBOT_MACHINE_OUTPUT'
  | 'GOODS_BATCH_RECORD'
  | 'LOGISTICS_DELIVERY'
  | 'STORAGE_HOLDING'
  | 'COMPUTE_USAGE'
  | 'AI_INFERENCE'
  | 'GENERIC';

export function candidateEventClassesFor(category: ProductiveCategory): readonly ProductiveEconomicEventClass[] {
  return CANDIDATE_EVENT_CLASSES[category];
}

export function categoryDoesNotEqualEventClass(
  category: ProductiveCategory,
  eventClass: ProductiveEconomicEventClass,
): boolean {
  return !CANDIDATE_EVENT_CLASSES[category].includes(eventClass) || CANDIDATE_EVENT_CLASSES[category].length > 1;
}

/**
 * Classify the underlying event from observation role plus optional
 * explicit class. Factory and robot observations of one transformation
 * share MANUFACTURING_TRANSFORMATION_EVENT.
 */
export function classifyEventClass(input: {
  readonly category?: ProductiveCategory;
  readonly observationKind?: ObservationKind;
  readonly explicitEventClass?: ProductiveEconomicEventClass;
  readonly describesManufacturingTransformation?: boolean;
}): ProductiveEconomicEventClass {
  if (input.explicitEventClass) {
    return input.explicitEventClass;
  }
  switch (input.observationKind) {
    case 'FACTORY_MANUFACTURING_OUTPUT':
    case 'ROBOT_MACHINE_OUTPUT':
      return 'MANUFACTURING_TRANSFORMATION_EVENT';
    case 'GOODS_BATCH_RECORD':
      return input.describesManufacturingTransformation
        ? 'MANUFACTURING_TRANSFORMATION_EVENT'
        : 'GOODS_CREATION_EVENT';
    case 'LOGISTICS_DELIVERY':
      return 'LOGISTICS_DELIVERY_EVENT';
    case 'STORAGE_HOLDING':
      return 'STORAGE_SERVICE_EVENT';
    case 'COMPUTE_USAGE':
      return 'COMPUTE_EXECUTION_EVENT';
    case 'AI_INFERENCE':
      return 'AI_COMPUTE_EVENT';
    default:
      break;
  }
  if (input.describesManufacturingTransformation) {
    return 'MANUFACTURING_TRANSFORMATION_EVENT';
  }
  if (input.category) {
    return CANDIDATE_EVENT_CLASSES[input.category][0] ?? 'SERVICE_DELIVERY_EVENT';
  }
  return 'SERVICE_DELIVERY_EVENT';
}

export function classifyObservationRelation(input: {
  readonly fromKind: ObservationKind;
  readonly toKind: ObservationKind;
  readonly sameUnderlyingEvent: boolean;
}): { readonly relation: EventRelationType; readonly impliesDuplicateValue: boolean } {
  if (input.sameUnderlyingEvent) {
    return Object.freeze({ relation: 'SAME_UNDERLYING_EVENT', impliesDuplicateValue: true });
  }
  if (factoryAndRobot(input.fromKind, input.toKind)) {
    return Object.freeze({ relation: 'DERIVED_VIEW_OF', impliesDuplicateValue: false });
  }
  if (goodsAndManufacturing(input.fromKind, input.toKind)) {
    return Object.freeze({ relation: 'OUTPUT_OF', impliesDuplicateValue: false });
  }
  if (logisticsAndGoods(input.fromKind, input.toKind)) {
    return Object.freeze({ relation: 'TRANSPORTS', impliesDuplicateValue: false });
  }
  if (storageAndGoods(input.fromKind, input.toKind)) {
    return Object.freeze({ relation: 'STORES', impliesDuplicateValue: false });
  }
  if (computeAndAi(input.fromKind, input.toKind)) {
    return Object.freeze({ relation: 'ENABLES', impliesDuplicateValue: false });
  }
  return Object.freeze({ relation: 'DISTINCT_VALUE_EVENT', impliesDuplicateValue: false });
}

export function defaultDistinctServiceClass(eventClass: ProductiveEconomicEventClass): boolean {
  return (
    eventClass === 'LOGISTICS_DELIVERY_EVENT' ||
    eventClass === 'STORAGE_SERVICE_EVENT' ||
    eventClass === 'BANDWIDTH_SERVICE_EVENT' ||
    eventClass === 'INFRASTRUCTURE_SERVICE_EVENT' ||
    eventClass === 'SERVICE_DELIVERY_EVENT'
  );
}

export function knownEventClasses(): readonly ProductiveEconomicEventClass[] {
  return PRODUCTIVE_ECONOMIC_EVENT_CLASSES;
}

export function relationDoesNotImplyDuplicate(relation: EventRelationType): boolean {
  return !relationImpliesDuplicateValue(relation);
}

export function possibleMatchCannotMerge(confidence: LinkageConfidenceClass): boolean {
  return confidence === 'POSSIBLE_MATCH' || confidence === 'UNRELATED' || confidence === 'STRONG_EVIDENCE';
}

function pair(a: ObservationKind, b: ObservationKind, left: ObservationKind, right: ObservationKind): boolean {
  return (a === left && b === right) || (a === right && b === left);
}

function factoryAndRobot(a: ObservationKind, b: ObservationKind): boolean {
  return pair(a, b, 'FACTORY_MANUFACTURING_OUTPUT', 'ROBOT_MACHINE_OUTPUT');
}

function goodsAndManufacturing(a: ObservationKind, b: ObservationKind): boolean {
  return (
    pair(a, b, 'GOODS_BATCH_RECORD', 'FACTORY_MANUFACTURING_OUTPUT') ||
    pair(a, b, 'GOODS_BATCH_RECORD', 'ROBOT_MACHINE_OUTPUT')
  );
}

function logisticsAndGoods(a: ObservationKind, b: ObservationKind): boolean {
  return (
    pair(a, b, 'LOGISTICS_DELIVERY', 'GOODS_BATCH_RECORD') ||
    pair(a, b, 'LOGISTICS_DELIVERY', 'FACTORY_MANUFACTURING_OUTPUT')
  );
}

function storageAndGoods(a: ObservationKind, b: ObservationKind): boolean {
  return pair(a, b, 'STORAGE_HOLDING', 'GOODS_BATCH_RECORD');
}

function computeAndAi(a: ObservationKind, b: ObservationKind): boolean {
  return pair(a, b, 'COMPUTE_USAGE', 'AI_INFERENCE');
}
