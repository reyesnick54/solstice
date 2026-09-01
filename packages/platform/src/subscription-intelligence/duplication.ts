import type { DuplicationEvidence, RecurringObligation } from './models.ts';
import type { SubscriptionCategory } from './taxonomy.ts';

const OVERLAP_CATEGORIES: Readonly<Record<SubscriptionCategory, readonly string[]>> = Object.freeze({
  STREAMING: ['video_streaming'],
  MEDIA: ['audio_streaming', 'news_subscription'],
  CLOUD_SERVICES: ['cloud_infrastructure', 'cloud_storage'],
  SOFTWARE: ['software_subscription'],
  TELECOMMUNICATIONS: ['telecom_service'],
  INSURANCE: ['insurance_policy'],
  UTILITIES: ['utility_bill'],
  MEMBERSHIPS: ['membership'],
  FITNESS: ['fitness_membership'],
  FINANCIAL_SERVICES: ['account_fee'],
  OTHER_RECURRING: ['recurring_service'],
});

/**
 * Identify potential redundant subscriptions. Never auto-declare wasteful.
 */
export function detectDuplicateOverlaps(obligations: readonly RecurringObligation[]): readonly DuplicationEvidence[] {
  const byCategory = new Map<SubscriptionCategory, RecurringObligation[]>();
  for (const obligation of obligations) {
    if (obligation.status !== 'ACTIVE') {
      continue;
    }
    const list = byCategory.get(obligation.category) ?? [];
    list.push(obligation);
    byCategory.set(obligation.category, list);
  }

  const duplicates: DuplicationEvidence[] = [];

  for (const [category, group] of byCategory) {
    const overlapTypes = OVERLAP_CATEGORIES[category];
    for (const overlapType of overlapTypes) {
      const matching = group.filter((item) => item.subscriptionType === overlapType);
      if (matching.length < 2) {
        continue;
      }
      duplicates.push(
        Object.freeze({
          kind: 'POTENTIAL_DUPLICATION',
          obligationIds: Object.freeze(matching.map((item) => item.id)),
          category,
          evidence: Object.freeze(
            matching.map(
              (item) =>
                `${item.merchant.normalizedMerchant}: ${item.amount.minorUnits} ${item.amount.currency}/${item.frequency}`,
            ),
          ),
          wasteful: false,
        }),
      );
    }
    if (category === 'CLOUD_SERVICES' && group.length >= 2) {
      const storage = group.filter((item) => /dropbox|icloud|google one|onedrive/i.test(item.merchant.normalizedMerchant));
      if (storage.length >= 2) {
        duplicates.push(
          Object.freeze({
            kind: 'POTENTIAL_DUPLICATION',
            obligationIds: Object.freeze(storage.map((item) => item.id)),
            category: 'CLOUD_SERVICES',
            evidence: Object.freeze(storage.map((item) => `Cloud storage: ${item.merchant.normalizedMerchant}`)),
            wasteful: false,
          }),
        );
      }
    }
    if (category === 'MEDIA' && group.length >= 2) {
      const music = group.filter((item) => /spotify|apple music|tidal|pandora/i.test(item.merchant.normalizedMerchant));
      if (music.length >= 2) {
        duplicates.push(
          Object.freeze({
            kind: 'POTENTIAL_DUPLICATION',
            obligationIds: Object.freeze(music.map((item) => item.id)),
            category: 'MEDIA',
            evidence: Object.freeze(music.map((item) => `Music service: ${item.merchant.normalizedMerchant}`)),
            wasteful: false,
          }),
        );
      }
    }
  }

  return Object.freeze(duplicates);
}
