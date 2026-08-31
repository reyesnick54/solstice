import type {
  AccessActivityRecord,
  AccessEntitlement,
  AccessExperience,
  AccessIntent,
  AccessQuote,
  AccessRecommendation,
  AccessReservation,
} from './types.ts';
import type { AccessActivityItem } from './product/activity.ts';
import type { AccessProductEvent } from './product/events.ts';
import type { AccessReceipt, AccessRefundReceipt } from './product/receipts.ts';
import type { AccessProductTransaction } from './product/transactions.ts';

export class HumanAccessEconomyStore {
  readonly entitlements = new Map<string, AccessEntitlement>();
  readonly intents = new Map<string, AccessIntent>();
  readonly quotes = new Map<string, AccessQuote>();
  readonly reservations = new Map<string, AccessReservation>();
  readonly experiences = new Map<string, AccessExperience>();
  readonly activities = new Map<string, AccessActivityRecord>();
  readonly recommendations = new Map<string, AccessRecommendation>();
  readonly idempotency = new Map<string, string>();
  readonly transactions = new Map<string, AccessProductTransaction>();
  readonly receipts = new Map<string, AccessReceipt>();
  readonly refundReceipts = new Map<string, AccessRefundReceipt>();
  readonly productEvents = new Map<string, AccessProductEvent>();
  readonly productActivities = new Map<string, AccessActivityItem>();
  readonly expirationNotified = new Set<string>();
  readonly transactionByQuote = new Map<string, string>();

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

  listTransactions(customerId: string): readonly AccessProductTransaction[] {
    return [...this.transactions.values()]
      .filter((row) => row.userId === customerId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  listProductActivities(customerId: string): readonly AccessActivityItem[] {
    return [...this.productActivities.values()]
      .filter((row) => row.customerId === customerId)
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }

  listProductEvents(customerId: string): readonly AccessProductEvent[] {
    return [...this.productEvents.values()]
      .filter((row) => row.customerId === customerId)
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }
}
