/**
 * Maps canonical Access Economy categories to consumer presentation categories.
 */

export const ACCESS_CAPACITY_CATEGORIES = [
  'VEHICLE_HOURS',
  'HOUSING_ROOM_NIGHTS',
  'TRANSPORTATION',
  'TRAVEL',
  'FOOD',
  'ENERGY',
  'COMPUTE',
  'ROBOTICS',
  'MANUFACTURING',
  'GOODS',
  'SERVICES',
  'EXPERIENCES',
] as const;
export type AccessCapacityCategory = (typeof ACCESS_CAPACITY_CATEGORIES)[number];

export const CONSUMER_ACCESS_CATEGORIES = [
  'MOBILITY',
  'TRAVEL',
  'STAY_HOUSING',
  'FOOD',
  'EXPERIENCES',
  'COMPUTE_AI',
  'ROBOTS_SERVICES',
  'ENERGY',
  'GOODS',
] as const;
export type ConsumerAccessCategory = (typeof CONSUMER_ACCESS_CATEGORIES)[number];

export const CAPACITY_TO_CONSUMER: Readonly<Record<AccessCapacityCategory, ConsumerAccessCategory>> = Object.freeze({
  VEHICLE_HOURS: 'MOBILITY',
  HOUSING_ROOM_NIGHTS: 'STAY_HOUSING',
  TRANSPORTATION: 'MOBILITY',
  TRAVEL: 'TRAVEL',
  FOOD: 'FOOD',
  ENERGY: 'ENERGY',
  COMPUTE: 'COMPUTE_AI',
  ROBOTICS: 'ROBOTS_SERVICES',
  MANUFACTURING: 'ROBOTS_SERVICES',
  GOODS: 'GOODS',
  SERVICES: 'ROBOTS_SERVICES',
  EXPERIENCES: 'EXPERIENCES',
});

export const CONSUMER_TO_CAPACITY = Object.freeze({
  MOBILITY: Object.freeze(['TRANSPORTATION', 'VEHICLE_HOURS'] as const),
  TRAVEL: Object.freeze(['TRAVEL'] as const),
  STAY_HOUSING: Object.freeze(['HOUSING_ROOM_NIGHTS'] as const),
  FOOD: Object.freeze(['FOOD'] as const),
  EXPERIENCES: Object.freeze(['EXPERIENCES'] as const),
  COMPUTE_AI: Object.freeze(['COMPUTE'] as const),
  ROBOTS_SERVICES: Object.freeze(['ROBOTICS', 'MANUFACTURING', 'SERVICES'] as const),
  ENERGY: Object.freeze(['ENERGY'] as const),
  GOODS: Object.freeze(['GOODS'] as const),
}) satisfies Readonly<Partial<Record<ConsumerAccessCategory, readonly AccessCapacityCategory[]>>>;

export function toConsumerCategory(category: AccessCapacityCategory): ConsumerAccessCategory {
  return CAPACITY_TO_CONSUMER[category];
}

export const CONSUMER_CATEGORY_LABELS: Readonly<Record<ConsumerAccessCategory, string>> = Object.freeze({
  MOBILITY: 'Mobility',
  TRAVEL: 'Travel',
  STAY_HOUSING: 'Stay & housing',
  FOOD: 'Food',
  EXPERIENCES: 'Experiences',
  COMPUTE_AI: 'Compute & AI',
  ROBOTS_SERVICES: 'Robots & services',
  ENERGY: 'Energy',
  GOODS: 'Goods',
});

export function matchesCategoryFilter(
  capacityCategory: AccessCapacityCategory,
  filter?: AccessCapacityCategory | ConsumerAccessCategory,
): boolean {
  if (!filter) return true;
  if ((CONSUMER_ACCESS_CATEGORIES as readonly string[]).includes(filter)) {
    const mapped = CONSUMER_TO_CAPACITY[filter as ConsumerAccessCategory];
    return mapped?.some((category) => category === capacityCategory) ?? false;
  }
  return capacityCategory === filter;
}
