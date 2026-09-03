// @ts-nocheck
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync } from 'node:fs';

import { SUBSCRIPTION_BFF_ROUTES } from '../services/api/src/consumer/subscriptions.ts';
import { SubscriptionIntelligenceService } from '../packages/platform/src/subscription-intelligence/index.ts';
import { FrozenClock } from '../packages/config/src/clock.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { deterministicActivityId } from '../packages/personal-economic-graph/src/ids.ts';
import type { EconomicActivity } from '../packages/personal-economic-graph/src/store.ts';

const NOW = asUtcInstant('2026-08-31T12:00:00.000Z');
const GRAPH_ID = 'egr_prompt13' as never;

function netflixActivity(month: string, amount: string, index: number): EconomicActivity {
  return Object.freeze({
    activityId: deterministicActivityId(`netflix_${index}`),
    graphId: GRAPH_ID,
    subjectId: 'id_prompt13',
    accountId: 'acct_checking',
    direction: 'OUTFLOW' as const,
    amount: Object.freeze({ minorUnits: amount, currency: 'USD' }),
    occurredAt: asUtcInstant(`2026-${month}-15T10:00:00.000Z`),
    counterpart: Object.freeze({
      kind: 'MERCHANT' as const,
      ref: `merch_${index}`,
      label: 'NETFLIX.COM 866-579-7172',
    }),
    classification: 'SUBSCRIPTION' as const,
    sourceType: 'LEDGER' as const,
    sourceRef: `src_${index}`,
    sourceEventType: 'CustomerActivityRecorded',
    sourceEventId: `evt_${index}`,
  });
}

describe('Wave 5 Prompt 13 — subscription intelligence', () => {
  it('implements subscription intelligence module', () => {
    assert.equal(existsSync('packages/platform/src/subscription-intelligence/service.ts'), true);
    assert.equal(existsSync('packages/platform/src/subscription-intelligence/subscription-intelligence.test.ts'), true);
  });

  it('registers subscription BFF routes', () => {
    assert.ok(SUBSCRIPTION_BFF_ROUTES.length >= 10);
    assert.ok(SUBSCRIPTION_BFF_ROUTES.includes('GET /api/v1/subscriptions/obligations'));
    assert.ok(SUBSCRIPTION_BFF_ROUTES.includes('POST /api/v1/subscriptions/actions/propose'));
  });

  it('analyzes recurring obligations and savings opportunities', () => {
    const service = new SubscriptionIntelligenceService({ clock: new FrozenClock(NOW) });
    const activities = Object.freeze(['03', '04', '05', '06'].map((month, index) => netflixActivity(month, '999', index)));
    const obligations = service.analyze({ subjectId: 'id_prompt13', activities });
    assert.ok(obligations.obligations.length >= 1);
    assert.equal(obligations.obligations[0]!.merchant.normalizedMerchant, 'Netflix');
  });

  it('completes authorized cancellation with verified savings', async () => {
    const service = new SubscriptionIntelligenceService({ clock: new FrozenClock(NOW) });
    const activities = Object.freeze(['03', '04', '05', '06'].map((month, index) => netflixActivity(month, '999', index)));
    const snapshot = service.analyze({
      subjectId: 'id_prompt13',
      activities,
      usageSignals: Object.freeze([]),
    });
    const obligation = snapshot.obligations[0]!;
    const withUsage = service.analyze({
      subjectId: 'id_prompt13',
      activities,
      usageSignals: Object.freeze([
        Object.freeze({
          obligationId: obligation.id,
          usageLevel: 'NONE' as const,
          source: 'USER_AUTHORIZED' as const,
          observedAt: NOW,
        }),
      ]),
    });
    const cancelOpp = withUsage.opportunities.find((item) => item.recommendedAction === 'CANCEL');
    assert.ok(cancelOpp);
    const proposed = service.proposeAction({
      subjectId: 'id_prompt13',
      opportunityId: cancelOpp!.opportunityId,
      idempotencyKey: 'wave5_cancel',
      actorKind: 'CUSTOMER',
    });
    assert.equal(proposed.ok, true);
    const authorized = service.authorizeAction({
      subjectId: 'id_prompt13',
      actionId: proposed.value.actionId,
      actorId: 'id_prompt13',
      actorKind: 'CUSTOMER',
      stepUpSatisfied: true,
    });
    assert.equal(authorized.ok, true);
    const executed = await service.executeAction({
      subjectId: 'id_prompt13',
      actionId: proposed.value.actionId,
      actorKind: 'CUSTOMER',
      merchantNormalized: 'Netflix',
    });
    assert.equal(executed.ok, true);
    assert.equal(executed.value.action.actionConfirmed, true);
    assert.ok(executed.value.verifiedSavings);
  });

  it('records audit events for detection and savings', () => {
    const service = new SubscriptionIntelligenceService({ clock: new FrozenClock(NOW) });
    const activities = Object.freeze(['03', '04', '05', '06'].map((month, index) => netflixActivity(month, '999', index)));
    service.analyze({ subjectId: 'id_prompt13', activities });
    const events = service.audit.list('id_prompt13');
    assert.ok(events.some((event) => event.eventKind === 'recurring_detected'));
    assert.ok(events.some((event) => event.eventKind === 'subscription_classified'));
  });
});
