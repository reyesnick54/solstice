import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { EvidenceVault } from '../../evidence/src/vault.ts';
import { DomainEventLog } from '../../events/src/events.ts';
import { assignCase, decideCase } from '../../kernel/src/compliance/cases.ts';
import { MarketSurveillanceService } from './service.ts';
import type { MarketSnapshot } from './types.ts';

const NOW = asUtcInstant('2026-08-16T08:00:00.000Z');

function service() {
  const clock = new FrozenClock(NOW);
  return new MarketSurveillanceService({
    evidence: new EvidenceVault(clock),
    events: new DomainEventLog(),
    clock,
  });
}

describe('market surveillance detectors', () => {
  it('raises a self-trade candidate when the same beneficial participant trades against self', () => {
    const surveillance = service();
    const snapshot: MarketSnapshot = {
      marketId: 'm1',
      orders: [],
      trades: [
        {
          tradeId: 't1',
          marketId: 'm1',
          makerOrderId: 'o1',
          takerOrderId: 'o2',
          makerAccountId: 'a1',
          takerAccountId: 'a2',
          makerParticipantId: 'person_1',
          takerParticipantId: 'person_1',
          quantity: 2n,
          priceUnits: 200n,
          matchedAt: NOW,
        },
      ],
    };
    const alerts = surveillance.observe(snapshot);
    assert.equal(alerts.some((alert) => alert.kind === 'SELF_TRADING'), true);
    assert.equal(alerts.every((alert) => alert.legalConclusion === false), true);
  });

  it('raises layering/spoofing candidates for large post-and-cancel around opposite trades', () => {
    const surveillance = service();
    const snapshot: MarketSnapshot = {
      marketId: 'm1',
      orders: [
        {
          orderId: 'c1',
          accountId: 'spoof',
          beneficialParticipantId: 'p_spoof',
          marketId: 'm1',
          side: 'SELL',
          quantity: 8n,
          remaining: 0n,
          status: 'CANCELLED',
          createdAt: NOW,
          cancelledAt: NOW,
        },
        {
          orderId: 'c2',
          accountId: 'spoof',
          beneficialParticipantId: 'p_spoof',
          marketId: 'm1',
          side: 'SELL',
          quantity: 9n,
          remaining: 0n,
          status: 'CANCELLED',
          createdAt: NOW,
          cancelledAt: NOW,
        },
        {
          orderId: 'c3',
          accountId: 'spoof',
          beneficialParticipantId: 'p_spoof',
          marketId: 'm1',
          side: 'SELL',
          quantity: 7n,
          remaining: 0n,
          status: 'CANCELLED',
          createdAt: NOW,
          cancelledAt: NOW,
        },
        {
          orderId: 'buy1',
          accountId: 'taker',
          beneficialParticipantId: 'p_taker',
          marketId: 'm1',
          side: 'BUY',
          quantity: 1n,
          remaining: 0n,
          status: 'FILLED',
          createdAt: NOW,
        },
      ],
      trades: [
        {
          tradeId: 't_opp',
          marketId: 'm1',
          makerOrderId: 'other',
          takerOrderId: 'buy1',
          makerAccountId: 'other',
          takerAccountId: 'taker',
          makerParticipantId: 'p_other',
          takerParticipantId: 'p_taker',
          quantity: 1n,
          priceUnits: 200n,
          matchedAt: NOW,
        },
      ],
    };
    const alerts = surveillance.observe(snapshot);
    assert.equal(alerts.some((alert) => alert.kind === 'LAYERING_CANDIDATE'), true);
    assert.equal(alerts.some((alert) => alert.kind === 'SPOOFING_CANDIDATE'), true);
    assert.equal(alerts.some((alert) => alert.kind === 'ORDER_CANCEL_BURST'), true);
  });

  it('raises wash/coordinated candidates and requires a human for restriction and case finality', () => {
    const surveillance = service();
    const snapshot: MarketSnapshot = {
      marketId: 'm1',
      linkedAccounts: { a1: 'cluster_x', a2: 'cluster_x' },
      orders: [],
      trades: [
        {
          tradeId: 't_wash',
          marketId: 'm1',
          makerOrderId: 'o1',
          takerOrderId: 'o2',
          makerAccountId: 'a1',
          takerAccountId: 'a2',
          makerParticipantId: 'p1',
          takerParticipantId: 'p2',
          quantity: 3n,
          priceUnits: 200n,
          matchedAt: NOW,
        },
      ],
    };
    const alerts = surveillance.observe(snapshot);
    const wash = alerts.find((alert) => alert.kind === 'WASH_TRADING_PATTERN');
    assert.ok(wash);
    const opened = surveillance.openCaseFromAlert(wash.alertId);
    assert.ok(opened);
    const assigned = assignCase(opened, 'reviewer_1');
    const human = decideCase(assigned, {
      decision: 'RESTRICT',
      operatorRef: 'reviewer_1',
      actorKind: 'HUMAN_OPERATOR',
      reason: 'human review of wash-trading candidate',
      evidenceRefs: [wash.alertId],
      decidedAt: NOW,
    });
    assert.equal(human.ok, true);
    const aiCase = decideCase(assigned, {
      decision: 'BLOCK',
      operatorRef: 'ai',
      actorKind: 'AI',
      reason: 'autonomous punishment',
      evidenceRefs: [],
      decidedAt: NOW,
    });
    assert.equal(aiCase.ok, false);
    const aiRestrict = surveillance.proposeRestriction({
      alertId: wash.alertId,
      accountId: 'a1',
      proposedStatus: 'SUSPENDED',
      actorKind: 'AI',
    });
    assert.equal('ok' in aiRestrict && aiRestrict.ok === false, true);
    const proposal = surveillance.proposeRestriction({
      alertId: wash.alertId,
      accountId: 'a1',
      proposedStatus: 'RESTRICTED',
      actorKind: 'HUMAN_OPERATOR',
    });
    assert.equal('applied' in proposal && proposal.applied === false, true);
  });
});
