import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PersonalEconomyAgent } from '../packages/agent/src/runtime/PersonalEconomyAgent.ts';
import { claims, context, NOW, USD } from './helpers.ts';
import { Money } from '../packages/contracts/src/money.ts';
import type { CuratedOpportunity } from '../packages/agent/src/growth-os/services.ts';

describe('Growth OS services (propose-only)', () => {
  it('classifies subscriptions and proposes cancellation without a write path', () => {
    const agent = new PersonalEconomyAgent({
      context: context({
        recurringPatterns: [
          {
            groupId: 'a',
            merchantName: 'Active Payroll',
            typicalAmount: USD(100n),
            cadence: 'MONTHLY',
            lastSeenAt: NOW,
            classification: 'ACTIVE',
          },
          {
            groupId: 'b',
            merchantName: 'Redundant Stream',
            typicalAmount: USD(200n),
            cadence: 'MONTHLY',
            lastSeenAt: NOW,
            classification: 'REDUNDANT',
          },
          {
            groupId: 'c',
            merchantName: 'Unused Gym',
            typicalAmount: USD(300n),
            cadence: 'MONTHLY',
            lastSeenAt: NOW,
            classification: 'UNUSED',
          },
          {
            groupId: 'd',
            merchantName: 'Pricey Cloud',
            typicalAmount: USD(400n),
            cadence: 'MONTHLY',
            lastSeenAt: NOW,
            classification: 'PRICE_INCREASED',
          },
          {
            groupId: 'e',
            merchantName: 'Trial Mag',
            typicalAmount: USD(0n),
            cadence: 'MONTHLY',
            lastSeenAt: NOW,
            classification: 'TRIAL_ENDING',
          },
        ],
      }),
      claims: claims(),
      mandates: [],
    });
    const emitted = agent.proposeSubscriptions(NOW);
    assert.equal(emitted.proposals.length, 4);
    assert.equal(
      emitted.proposals.every((p) => p.actionType === 'CANCEL_SUBSCRIPTION'),
      true,
    );
  });

  it('refuses to fabricate an unverified sponsor', () => {
    const agent = new PersonalEconomyAgent({
      context: context(),
      claims: claims(),
      mandates: [],
    });
    const fake = {
      opportunityId: 'x',
      sponsorId: 'y',
      sponsorName: 'Invented LLC',
      verifiedSponsor: false,
      eligibility: 'none',
      compensation: USD(1n),
      requiredTimeMinutes: 1n,
      privacyTerms: 'none',
      jurisdiction: 'US',
    };
    assert.throws(
      () => agent.proposeResearch([fake as unknown as CuratedOpportunity], NOW),
      /unverified/,
    );
  });

  it('records merchant bids from the provided catalog only', () => {
    const agent = new PersonalEconomyAgent({
      context: context(),
      claims: claims(),
      mandates: [],
    });
    const emitted = agent.proposeMerchantBid(
      {
        merchantId: 'mer_1',
        merchantName: 'Demo Hardware',
        bid: USD(1200n),
        anonymizedIntentId: 'anon_1',
      },
      NOW,
    );
    assert.equal(emitted.proposals[0]?.actionType, 'SELECT_MERCHANT_BID');
    assert.equal(emitted.proposals[0]?.amount.minorUnits, 1200n);
  });

  it('routes rewards without misclassifying cost-avoided as a reward', () => {
    const agent = new PersonalEconomyAgent({
      context: context(),
      claims: claims(),
      mandates: [],
    });
    const emitted = agent.proposeReward(
      [
        { method: 'debit', reward: Money.fromMinorUnits(0n, 'USD'), source: 'CASHBACK' },
        { method: 'card', reward: Money.fromMinorUnits(350n, 'USD'), source: 'CARD_REWARD_PENDING' },
      ],
      NOW,
    );
    assert.equal(emitted.proposals[0]?.targetAccountClass, 'pending');
    assert.equal(emitted.proposals[0]?.reasonCode, 'REWARD_METHOD_SUPERIOR');
  });
});
