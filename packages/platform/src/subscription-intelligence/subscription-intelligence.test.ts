import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../../config/src/clock.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import type { EconomicActivity } from '../../../personal-economic-graph/src/store.ts';
import { deterministicActivityId } from '../../../personal-economic-graph/src/ids.ts';
import { asEconomicGraphId } from '../../../personal-economic-graph/src/ids.ts';
import { assertAiCannotExecute } from './ai-boundary.ts';
import { attributeVerifiedSavings, estimatedSavingsFromOpportunity, savingsMustNotBePresentedAsVerified } from './attribution.ts';
import { classifySubscription } from './classification.ts';
import { detectRecurringObligations } from './detection.ts';
import { detectDuplicateOverlaps } from './duplication.ts';
import { normalizeMerchant } from './merchant.ts';
import { applyPriceChanges } from './price-change.ts';
import { buildSavingsOpportunities } from './savings.ts';
import { SubscriptionIntelligenceService } from './service.ts';
import { subscriptionActionIdFor } from './ids.ts';

const NOW = asUtcInstant('2026-08-15T12:00:00.000Z');
const GRAPH_ID = asEconomicGraphId('peg_g_test');
const SUBJECT = 'id_sub_test';

function activity(
  id: string,
  descriptor: string,
  minorUnits: string,
  occurredAt: string,
  direction: 'INFLOW' | 'OUTFLOW' = 'OUTFLOW',
): EconomicActivity {
  return Object.freeze({
    activityId: deterministicActivityId(id),
    graphId: GRAPH_ID,
    subjectId: SUBJECT,
    accountId: 'acct_checking',
    direction,
    amount: Object.freeze({ minorUnits, currency: 'USD' }),
    occurredAt: asUtcInstant(occurredAt),
    counterpart: Object.freeze({
      kind: 'MERCHANT',
      ref: `merch_${id}`,
      label: descriptor,
    }),
    classification: 'SUBSCRIPTION',
    sourceType: 'LEDGER',
    sourceRef: `src_${id}`,
    sourceEventType: 'CustomerActivityRecorded',
    sourceEventId: `evt_${id}`,
  });
}

function monthlyNetflix(count: number, startMonth: number, amount = '999'): EconomicActivity[] {
  const rows: EconomicActivity[] = [];
  for (let i = 0; i < count; i += 1) {
    const month = String(startMonth + i).padStart(2, '0');
    rows.push(activity(`netflix_${i}`, 'NETFLIX.COM 866-579-7172', amount, `2026-${month}-15T10:00:00.000Z`));
  }
  return rows;
}

function annualAdobe(): EconomicActivity[] {
  return [
    activity('adobe_0', 'ADOBE *CREATIVE CLD', '59999', '2025-08-15T10:00:00.000Z'),
    activity('adobe_1', 'ADOBE *CREATIVE CLD', '59999', '2026-08-15T10:00:00.000Z'),
  ];
}

describe('subscription intelligence', () => {
  const clock = new FrozenClock(NOW);

  it('detects monthly subscription with high confidence', () => {
    const obligations = detectRecurringObligations({
      userId: SUBJECT,
      activities: monthlyNetflix(4, 1),
      now: NOW,
    });
    assert.equal(obligations.length, 1);
    assert.equal(obligations[0]!.frequency, 'MONTHLY');
    assert.equal(obligations[0]!.merchant.normalizedMerchant, 'Netflix');
    assert.equal(obligations[0]!.confidence, 'HIGH');
    assert.equal(obligations[0]!.status, 'ACTIVE');
  });

  it('detects annual subscription', () => {
    const obligations = detectRecurringObligations({
      userId: SUBJECT,
      activities: annualAdobe(),
      now: NOW,
    });
    assert.equal(obligations.length, 1);
    assert.equal(obligations[0]!.frequency, 'YEARLY');
    assert.equal(obligations[0]!.category, 'SOFTWARE');
  });

  it('treats variable utility as variable recurring without false price alert', () => {
    const utility = [
      activity('util_0', 'PG&E ELECTRIC BILL', '5000', '2026-05-15T10:00:00.000Z'),
      activity('util_1', 'PG&E ELECTRIC BILL', '12000', '2026-06-15T10:00:00.000Z'),
      activity('util_2', 'PG&E ELECTRIC BILL', '5500', '2026-07-15T10:00:00.000Z'),
      activity('util_3', 'PG&E ELECTRIC BILL', '11500', '2026-08-15T10:00:00.000Z'),
    ];
    const obligations = detectRecurringObligations({ userId: SUBJECT, activities: utility, now: NOW });
    assert.equal(obligations.length, 1);
    assert.equal(obligations[0]!.variableAmount, true);
    assert.equal(obligations[0]!.category, 'UTILITIES');
    const withPrice = applyPriceChanges(obligations, utility, NOW);
    assert.equal(withPrice[0]!.priceChange, null);
  });

  it('does not treat repeated discretionary merchant as subscription', () => {
    const gas = [
      activity('gas_0', 'SHELL OIL 12345', '4500', '2026-05-10T10:00:00.000Z'),
      activity('gas_1', 'SHELL OIL 12345', '5200', '2026-06-10T10:00:00.000Z'),
      activity('gas_2', 'SHELL OIL 12345', '4800', '2026-07-10T10:00:00.000Z'),
      activity('gas_3', 'SHELL OIL 12345', '5100', '2026-08-10T10:00:00.000Z'),
    ];
    const obligations = detectRecurringObligations({ userId: SUBJECT, activities: gas, now: NOW });
    assert.equal(obligations.length, 0);
  });

  it('normalizes merchant descriptors without destroying raw value', () => {
    const identity = normalizeMerchant('POS DEBIT NETFLIX.COM 866-579-7172 08/15');
    assert.equal(identity.normalizedMerchant, 'Netflix');
    assert.match(identity.rawDescriptor, /NETFLIX/);
    assert.equal(identity.merchantKey, 'netflix');
  });

  it('detects price increase for fixed subscription', () => {
    const rows = monthlyNetflix(4, 1, '999').map((row, index) =>
      index === 3
        ? activity('netflix_inc', 'NETFLIX.COM 866-579-7172', '1049', row.occurredAt)
        : row,
    );
    const obligations = detectRecurringObligations({ userId: SUBJECT, activities: rows, now: NOW });
    const withPrice = applyPriceChanges(obligations, rows, NOW);
    assert.ok(withPrice[0]!.priceChange);
    assert.equal(withPrice[0]!.priceChange!.previousAmount.minorUnits, '999');
    assert.equal(withPrice[0]!.priceChange!.currentAmount.minorUnits, '1049');
  });

  it('detects price decrease', () => {
    const rows = monthlyNetflix(4, 1, '1049').map((row, index) =>
      index === 3
        ? activity('netflix_dec', 'NETFLIX.COM 866-579-7172', '949', row.occurredAt)
        : row,
    );
    const obligations = detectRecurringObligations({ userId: SUBJECT, activities: rows, now: NOW });
    const withPrice = applyPriceChanges(obligations, rows, NOW);
    assert.ok(withPrice[0]!.priceChange);
    assert.equal(withPrice[0]!.priceChange!.currentAmount.minorUnits, '949');
    assert.ok(withPrice[0]!.priceChange!.percentageChangeBps > 0);
  });

  it('detects overlapping subscriptions as potential duplication', () => {
    const netflix = monthlyNetflix(4, 1);
    const hulu = ['04', '05', '06', '07'].map((month, index) =>
      activity(`hulu_${index}`, 'HULU LLC', '799', `2026-${month}-20T10:00:00.000Z`),
    );
    const obligations = detectRecurringObligations({
      userId: SUBJECT,
      activities: [...netflix, ...hulu],
      now: NOW,
    });
    const duplicates = detectDuplicateOverlaps(obligations);
    assert.ok(duplicates.length >= 1);
    assert.equal(duplicates[0]!.kind, 'POTENTIAL_DUPLICATION');
    assert.equal(duplicates[0]!.wasteful, false);
  });

  it('distinguishes estimated from verified savings', () => {
    assert.equal(savingsMustNotBePresentedAsVerified('ESTIMATED'), true);
    assert.equal(savingsMustNotBePresentedAsVerified('VERIFIED'), false);
  });

  it('advisory-only cancellation cannot be authorized', async () => {
    const service = new SubscriptionIntelligenceService({ clock });
    const proposed = service.proposeAction({
      subjectId: SUBJECT,
      opportunityId: 'sopp_fake_review' as never,
      idempotencyKey: 'key_adv',
      actorKind: 'CUSTOMER',
    });
    assert.equal(proposed.ok, false);
  });

  it('supports authorized cancellation with provider confirmation', async () => {
    const service = new SubscriptionIntelligenceService({ clock });
    const snapshot = service.analyze({
      subjectId: SUBJECT,
      activities: monthlyNetflix(4, 1),
      usageSignals: Object.freeze([
        Object.freeze({
          obligationId: detectRecurringObligations({
            userId: SUBJECT,
            activities: monthlyNetflix(4, 1),
            now: NOW,
          })[0]!.id,
          usageLevel: 'NONE',
          source: 'USER_AUTHORIZED',
          observedAt: NOW,
        }),
      ]),
    });
    const cancelOpp = snapshot.opportunities.find((item) => item.recommendedAction === 'CANCEL');
    assert.ok(cancelOpp);

    const proposed = service.proposeAction({
      subjectId: SUBJECT,
      opportunityId: cancelOpp!.opportunityId,
      idempotencyKey: 'cancel_key_1',
      actorKind: 'CUSTOMER',
    });
    assert.equal(proposed.ok, true);

    const authorized = service.authorizeAction({
      subjectId: SUBJECT,
      actionId: proposed.value.actionId,
      actorId: SUBJECT,
      actorKind: 'CUSTOMER',
      stepUpSatisfied: true,
    });
    assert.equal(authorized.ok, true);

    const executed = await service.executeAction({
      subjectId: SUBJECT,
      actionId: proposed.value.actionId,
      actorKind: 'CUSTOMER',
      merchantNormalized: 'Netflix',
    });
    assert.equal(executed.ok, true);
    assert.equal(executed.value.action.actionConfirmed, true);
    assert.ok(executed.value.action.providerEvidenceRef);
    assert.ok(executed.value.verifiedSavings);
    assert.equal(executed.value.verifiedSavings!.kind, 'VERIFIED');
  });

  it('rejects execution without authorization', async () => {
    const service = new SubscriptionIntelligenceService({ clock });
    const obligations = detectRecurringObligations({
      userId: SUBJECT,
      activities: monthlyNetflix(4, 1),
      now: NOW,
    });
    const snapshot = service.analyze({
      subjectId: SUBJECT,
      activities: monthlyNetflix(4, 1),
      usageSignals: Object.freeze([
        Object.freeze({
          obligationId: obligations[0]!.id,
          usageLevel: 'NONE' as const,
          source: 'USER_AUTHORIZED' as const,
          observedAt: NOW,
        }),
      ]),
    });
    const cancelOpp = snapshot.opportunities.find((item) => item.recommendedAction === 'CANCEL')!;
    const proposed = service.proposeAction({
      subjectId: SUBJECT,
      opportunityId: cancelOpp.opportunityId,
      idempotencyKey: 'no_auth',
      actorKind: 'CUSTOMER',
    });
    assert.equal(proposed.ok, true);
    const executed = await service.executeAction({
      subjectId: SUBJECT,
      actionId: proposed.value.actionId,
      actorKind: 'CUSTOMER',
      merchantNormalized: 'Netflix',
    });
    assert.equal(executed.ok, false);
  });

  it('is idempotent on duplicate cancellation request', async () => {
    const service = new SubscriptionIntelligenceService({ clock });
    const snapshot = service.analyze({
      subjectId: SUBJECT,
      activities: monthlyNetflix(4, 1),
      usageSignals: Object.freeze([
        Object.freeze({
          obligationId: detectRecurringObligations({
            userId: SUBJECT,
            activities: monthlyNetflix(4, 1),
            now: NOW,
          })[0]!.id,
          usageLevel: 'NONE',
          source: 'USER_AUTHORIZED',
          observedAt: NOW,
        }),
      ]),
    });
    const cancelOpp = snapshot.opportunities.find((item) => item.recommendedAction === 'CANCEL')!;
    const key = 'idem_cancel';
    const first = service.proposeAction({
      subjectId: SUBJECT,
      opportunityId: cancelOpp.opportunityId,
      idempotencyKey: key,
      actorKind: 'CUSTOMER',
    });
    const second = service.proposeAction({
      subjectId: SUBJECT,
      opportunityId: cancelOpp.opportunityId,
      idempotencyKey: key,
      actorKind: 'CUSTOMER',
    });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(first.value.actionId, second.value.actionId);
    assert.equal(
      first.value.actionId,
      subscriptionActionIdFor(cancelOpp.opportunityId, cancelOpp.recommendedAction, key),
    );
  });

  it('handles provider failure', async () => {
    const service = new SubscriptionIntelligenceService({ clock });
    const obligations = detectRecurringObligations({
      userId: SUBJECT,
      activities: monthlyNetflix(4, 1),
      now: NOW,
    });
    const snapshot = service.analyze({
      subjectId: SUBJECT,
      activities: monthlyNetflix(4, 1),
      usageSignals: Object.freeze([
        Object.freeze({
          obligationId: obligations[0]!.id,
          usageLevel: 'NONE' as const,
          source: 'USER_AUTHORIZED' as const,
          observedAt: NOW,
        }),
      ]),
    });
    const cancelOpp = snapshot.opportunities.find((item) => item.recommendedAction === 'CANCEL')!;
    const proposed = service.proposeAction({
      subjectId: SUBJECT,
      opportunityId: cancelOpp.opportunityId,
      idempotencyKey: 'cancel_key_timeout',
      actorKind: 'CUSTOMER',
    });
    assert.equal(proposed.ok, true);
    const authorized = service.authorizeAction({
      subjectId: SUBJECT,
      actionId: proposed.value.actionId,
      actorId: SUBJECT,
      actorKind: 'CUSTOMER',
      stepUpSatisfied: true,
    });
    assert.equal(authorized.ok, true);
    const failed = await service.executeAction({
      subjectId: SUBJECT,
      actionId: proposed.value.actionId,
      actorKind: 'CUSTOMER',
      merchantNormalized: 'Netflix',
    });
    assert.equal(failed.ok, false);
  });

  it('AI cannot directly execute action', async () => {
    assert.ok(assertAiCannotExecute('AGENT'));
    const service = new SubscriptionIntelligenceService({ clock });
    const obligations = detectRecurringObligations({
      userId: SUBJECT,
      activities: monthlyNetflix(4, 1),
      now: NOW,
    });
    const snapshot = service.analyze({
      subjectId: SUBJECT,
      activities: monthlyNetflix(4, 1),
      usageSignals: Object.freeze([
        Object.freeze({
          obligationId: obligations[0]!.id,
          usageLevel: 'NONE' as const,
          source: 'USER_AUTHORIZED' as const,
          observedAt: NOW,
        }),
      ]),
    });
    const cancelOpp = snapshot.opportunities.find((item) => item.recommendedAction === 'CANCEL')!;
    const proposed = service.proposeAction({
      subjectId: SUBJECT,
      opportunityId: cancelOpp.opportunityId,
      idempotencyKey: 'ai_try',
      actorKind: 'AGENT',
    });
    assert.equal(proposed.ok, false);
  });

  it('records audit events through lifecycle', () => {
    const service = new SubscriptionIntelligenceService({ clock });
    const obligations = detectRecurringObligations({
      userId: SUBJECT,
      activities: monthlyNetflix(4, 1),
      now: NOW,
    });
    service.analyze({
      subjectId: SUBJECT,
      activities: monthlyNetflix(4, 1),
      usageSignals: Object.freeze([
        Object.freeze({
          obligationId: obligations[0]!.id,
          usageLevel: 'NONE' as const,
          source: 'USER_AUTHORIZED' as const,
          observedAt: NOW,
        }),
      ]),
    });
    const events = service.audit.list(SUBJECT);
    assert.ok(events.some((event) => event.eventKind === 'recurring_detected'));
    assert.ok(events.some((event) => event.eventKind === 'subscription_classified'));
    assert.ok(events.some((event) => event.eventKind === 'savings_opportunity_created'));
  });

  it('classifies streaming and software categories', () => {
    assert.equal(classifySubscription('Netflix').category, 'STREAMING');
    assert.equal(classifySubscription('Microsoft 365').category, 'SOFTWARE');
    assert.equal(classifySubscription('Amazon Web Services').category, 'CLOUD_SERVICES');
  });

  it('builds savings opportunities with estimated not verified amounts', () => {
    const obligations = detectRecurringObligations({
      userId: SUBJECT,
      activities: monthlyNetflix(4, 1),
      now: NOW,
    });
    const opportunities = buildSavingsOpportunities({
      obligations,
      duplicates: Object.freeze([]),
      usageSignals: Object.freeze([
        Object.freeze({
          obligationId: obligations[0]!.id,
          usageLevel: 'NONE',
          source: 'USER_AUTHORIZED',
          observedAt: NOW,
        }),
      ]),
    });
    assert.ok(opportunities.length > 0);
    const estimated = estimatedSavingsFromOpportunity(opportunities[0]!);
    assert.equal(estimated.kind, 'ESTIMATED');
    assert.ok(estimated.monthly);
    const verified = attributeVerifiedSavings({
      obligation: obligations[0]!,
      opportunity: opportunities[0]!,
      action: Object.freeze({
        actionId: 'sact_test' as never,
        opportunityId: opportunities[0]!.opportunityId,
        obligationId: obligations[0]!.id,
        userId: SUBJECT,
        actionType: 'CANCEL',
        state: 'PROPOSED',
        capability: 'PROVIDER_REQUIRED',
        idempotencyKey: 'k',
        proposedAt: NOW,
        authorizedAt: null,
        completedAt: null,
        providerId: null,
        providerEvidenceRef: null,
        failureReason: null,
        requestSent: false,
        actionConfirmed: false,
      }),
      verifiedAt: NOW,
    });
    assert.equal(verified, null);
  });
});
