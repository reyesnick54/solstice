import type { UtcInstant } from '../../../domain/src/time.ts';
import type { CompositionSpec } from '../composer/proposal.ts';

const DAY_MS = 86_400_000;

function addDays(instant: UtcInstant, days: number): UtcInstant {
  return new Date(Date.parse(instant) + days * DAY_MS).toISOString() as UtcInstant;
}

export function japan14DayTripSpec(now: UtcInstant): CompositionSpec {
  const start = addDays(now, 30);
  const end = addDays(start, 14);
  return {
    intentSummary: 'Family trip to Japan for 14 days',
    failurePolicy: 'ALL_OR_NOTHING',
    quoteValidHours: 48,
    components: [
      {
        componentId: 'outbound-flight',
        label: 'Outbound transportation to Tokyo',
        mandatory: 'MANDATORY',
        providerId: 'sim-travel-japan',
        resourceKind: 'TRANSPORTATION',
        quantity: 4,
        unit: 'seat',
        considerationMinorUnits: 4_800_00n,
        currency: 'USD',
        reservationWindow: { start, end: addDays(start, 1) },
      },
      {
        componentId: 'inbound-flight',
        label: 'Inbound transportation from Tokyo',
        mandatory: 'MANDATORY',
        dependsOn: ['outbound-flight'],
        providerId: 'sim-travel-japan',
        resourceKind: 'TRANSPORTATION',
        quantity: 4,
        unit: 'seat',
        considerationMinorUnits: 4_600_00n,
        currency: 'USD',
        reservationWindow: { start: addDays(end, -1), end },
      },
      {
        componentId: 'lodging',
        label: '14 room-nights Tokyo lodging',
        mandatory: 'MANDATORY',
        dependsOn: ['outbound-flight'],
        providerId: 'sim-travel-japan',
        resourceKind: 'LODGING',
        quantity: 14,
        unit: 'room_night',
        considerationMinorUnits: 3_500_00n,
        currency: 'USD',
        reservationWindow: { start, end },
      },
      {
        componentId: 'local-transport',
        label: 'Local transportation pass',
        mandatory: 'MANDATORY',
        dependsOn: ['lodging'],
        providerId: 'sim-travel-japan',
        resourceKind: 'MOBILITY',
        quantity: 14,
        unit: 'day_pass',
        considerationMinorUnits: 420_00n,
        currency: 'USD',
        reservationWindow: { start, end },
      },
      {
        componentId: 'vehicle-capacity',
        label: 'Vehicle capacity for day trips',
        mandatory: 'OPTIONAL',
        alternativeGroup: 'day-mobility',
        providerId: 'sim-travel-japan',
        resourceKind: 'VEHICLE_CAPACITY',
        quantity: 3,
        unit: 'vehicle_day',
        considerationMinorUnits: 450_00n,
        currency: 'USD',
        reservationWindow: { start: addDays(start, 2), end: addDays(start, 5) },
      },
      {
        componentId: 'meals',
        label: 'Food and meal access',
        mandatory: 'OPTIONAL',
        providerId: 'sim-travel-japan',
        resourceKind: 'FOOD_ACCESS',
        quantity: 56,
        unit: 'meal_credit',
        considerationMinorUnits: 1_120_00n,
        currency: 'USD',
        reservationWindow: { start, end },
      },
      {
        componentId: 'attractions',
        label: 'Attraction and experience access',
        mandatory: 'OPTIONAL',
        providerId: 'sim-travel-japan',
        resourceKind: 'EXPERIENCE',
        quantity: 8,
        unit: 'experience',
        considerationMinorUnits: 640_00n,
        currency: 'USD',
        reservationWindow: { start: addDays(start, 1), end: addDays(end, -1) },
      },
    ],
    alternatives: [
      {
        alternativeGroup: 'day-mobility',
        componentIds: ['vehicle-capacity'],
        label: 'Vehicle rental vs local transit only',
      },
    ],
  };
}

export function miamiWeekendMobilitySpec(now: UtcInstant): CompositionSpec {
  const start = addDays(now, 7);
  const end = addDays(start, 3);
  return {
    intentSummary: 'Miami weekend mobility bundle',
    failurePolicy: 'BEST_EFFORT',
    quoteValidHours: 24,
    components: [
      {
        componentId: 'airport-transfer',
        label: 'Miami airport transfer',
        mandatory: 'MANDATORY',
        providerId: 'sim-mobility-miami',
        resourceKind: 'MOBILITY',
        quantity: 2,
        unit: 'ride',
        considerationMinorUnits: 85_00n,
        currency: 'USD',
        reservationWindow: { start, end: addDays(start, 1) },
      },
      {
        componentId: 'rideshare-pool',
        label: 'Miami rideshare weekend pool',
        mandatory: 'MANDATORY',
        dependsOn: ['airport-transfer'],
        providerId: 'sim-mobility-miami',
        resourceKind: 'MOBILITY',
        quantity: 6,
        unit: 'ride',
        considerationMinorUnits: 120_00n,
        currency: 'USD',
        reservationWindow: { start, end },
      },
      {
        componentId: 'vehicle-capacity',
        label: 'Miami vehicle capacity Saturday',
        mandatory: 'OPTIONAL',
        alternativeGroup: 'weekend-vehicle',
        providerId: 'sim-mobility-miami',
        resourceKind: 'VEHICLE_CAPACITY',
        quantity: 1,
        unit: 'vehicle_day',
        considerationMinorUnits: 95_00n,
        currency: 'USD',
        reservationWindow: { start: addDays(start, 1), end: addDays(start, 2) },
      },
      {
        componentId: 'beach-experience',
        label: 'South Beach experience access',
        mandatory: 'OPTIONAL',
        providerId: 'sim-mobility-miami',
        resourceKind: 'EXPERIENCE',
        quantity: 2,
        unit: 'experience',
        considerationMinorUnits: 60_00n,
        currency: 'USD',
        reservationWindow: { start: addDays(start, 1), end },
      },
    ],
    alternatives: [
      {
        alternativeGroup: 'weekend-vehicle',
        componentIds: ['vehicle-capacity'],
        label: 'Rental car vs rideshare only',
      },
    ],
  };
}

export function recurringHouseholdFoodSpec(now: UtcInstant): CompositionSpec {
  const start = addDays(now, 1);
  const end = addDays(start, 28);
  return {
    intentSummary: 'Recurring household food-access bundle',
    failurePolicy: 'PARTIAL_WITH_APPROVAL',
    quoteValidHours: 72,
    components: [
      {
        componentId: 'grocery-subscription',
        label: 'Weekly grocery delivery access',
        mandatory: 'MANDATORY',
        providerId: 'sim-food-household',
        resourceKind: 'RECURRING_SUBSCRIPTION',
        quantity: 4,
        unit: 'delivery_week',
        considerationMinorUnits: 320_00n,
        currency: 'USD',
        reservationWindow: { start, end },
      },
      {
        componentId: 'meal-kit',
        label: 'Meal kit food access',
        mandatory: 'MANDATORY',
        providerId: 'sim-food-household',
        resourceKind: 'FOOD_ACCESS',
        quantity: 8,
        unit: 'meal_slot',
        considerationMinorUnits: 192_00n,
        currency: 'USD',
        reservationWindow: { start, end },
      },
      {
        componentId: 'local-produce',
        label: 'Local produce market access',
        mandatory: 'OPTIONAL',
        providerId: 'sim-food-household',
        resourceKind: 'FOOD_ACCESS',
        quantity: 4,
        unit: 'market_visit',
        considerationMinorUnits: 48_00n,
        currency: 'USD',
        reservationWindow: { start, end },
      },
    ],
  };
}

export const SIMULATION_CAPABILITIES = [
  { providerId: 'sim-travel-japan', resourceKind: 'TRANSPORTATION' as const, unit: 'seat', availableQuantity: 20, simulationOnly: true as const },
  { providerId: 'sim-travel-japan', resourceKind: 'LODGING' as const, unit: 'room_night', availableQuantity: 30, simulationOnly: true as const },
  { providerId: 'sim-travel-japan', resourceKind: 'MOBILITY' as const, unit: 'day_pass', availableQuantity: 50, simulationOnly: true as const },
  { providerId: 'sim-travel-japan', resourceKind: 'VEHICLE_CAPACITY' as const, unit: 'vehicle_day', availableQuantity: 10, simulationOnly: true as const },
  { providerId: 'sim-travel-japan', resourceKind: 'FOOD_ACCESS' as const, unit: 'meal_credit', availableQuantity: 200, simulationOnly: true as const },
  { providerId: 'sim-travel-japan', resourceKind: 'EXPERIENCE' as const, unit: 'experience', availableQuantity: 40, simulationOnly: true as const },
  { providerId: 'sim-mobility-miami', resourceKind: 'MOBILITY' as const, unit: 'ride', availableQuantity: 100, simulationOnly: true as const },
  { providerId: 'sim-mobility-miami', resourceKind: 'VEHICLE_CAPACITY' as const, unit: 'vehicle_day', availableQuantity: 15, simulationOnly: true as const },
  { providerId: 'sim-mobility-miami', resourceKind: 'EXPERIENCE' as const, unit: 'experience', availableQuantity: 30, simulationOnly: true as const },
  { providerId: 'sim-food-household', resourceKind: 'RECURRING_SUBSCRIPTION' as const, unit: 'delivery_week', availableQuantity: 12, simulationOnly: true as const },
  { providerId: 'sim-food-household', resourceKind: 'FOOD_ACCESS' as const, unit: 'meal_slot', availableQuantity: 50, simulationOnly: true as const },
  { providerId: 'sim-food-household', resourceKind: 'FOOD_ACCESS' as const, unit: 'market_visit', availableQuantity: 20, simulationOnly: true as const },
];
