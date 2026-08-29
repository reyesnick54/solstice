import type {
  AccessActivityRecord,
  AccessEntitlement,
  AccessExperience,
  AccessIntent,
  AccessQuote,
  AccessRecommendation,
  AccessReservation,
} from './types.ts';

export class HumanAccessEconomyStore {
  readonly entitlements = new Map<string, AccessEntitlement>();
  readonly intents = new Map<string, AccessIntent>();
  readonly quotes = new Map<string, AccessQuote>();
  readonly reservations = new Map<string, AccessReservation>();
  readonly experiences = new Map<string, AccessExperience>();
  readonly activities = new Map<string, AccessActivityRecord>();
  readonly recommendations = new Map<string, AccessRecommendation>();
  readonly idempotency = new Map<string, string>();

  listEntitlements(customerId: string): readonly AccessEntitlement[] {
    return [...this.entitlements.values()].filter((row) => row.customerId === customerId);
  }

  listReservations(customerId: string): readonly AccessReservation[] {
    return [...this.reservations.values()].filter((row) => row.customerId === customerId);
  }

  listExperiences(customerId: string): readonly AccessExperience[] {
    return [...this.experiences.values()].filter((row) => row.customerId === customerId);
  }

  listActivities(customerId: string): readonly AccessActivityRecord[] {
    return [...this.activities.values()]
      .filter((row) => row.customerId === customerId)
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }

  listRecommendations(): readonly AccessRecommendation[] {
    return [...this.recommendations.values()];
  }
}
