import { FrozenClock } from '../../config/src/clock.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { EvidenceVault } from '../../evidence/src/vault.ts';
import { DomainEventLog } from '../../events/src/events.ts';
import { assignCase, decideCase } from '../../kernel/src/compliance/cases.ts';
import { MarketSurveillanceService } from './service.ts';

const NOW = asUtcInstant('2026-08-16T08:15:00.000Z');
const clock = new FrozenClock(NOW);
const surveillance = new MarketSurveillanceService({
  evidence: new EvidenceVault(clock),
  events: new DomainEventLog(),
  clock,
});

const self = surveillance.observe({
  marketId: 'm_demo',
  orders: [],
  trades: [
    {
      tradeId: 't_self',
      marketId: 'm_demo',
      makerOrderId: 'o1',
      takerOrderId: 'o2',
      makerAccountId: 'a1',
      takerAccountId: 'a2',
      makerParticipantId: 'person_same',
      takerParticipantId: 'person_same',
      quantity: 2n,
      priceUnits: 200n,
      matchedAt: NOW,
    },
  ],
});
if (!self.some((alert) => alert.kind === 'SELF_TRADING')) {
  throw new Error('self-trade detector failed');
}

const layering = surveillance.observe({
  marketId: 'm_demo',
  orders: [
    {
      orderId: 'c1',
      accountId: 'spoof',
      beneficialParticipantId: 'p_spoof',
      marketId: 'm_demo',
      side: 'SELL',
      quantity: 8n,
      remaining: 0n,
      status: 'CANCELLED',
      createdAt: NOW,
    },
    {
      orderId: 'c2',
      accountId: 'spoof',
      beneficialParticipantId: 'p_spoof',
      marketId: 'm_demo',
      side: 'SELL',
      quantity: 9n,
      remaining: 0n,
      status: 'CANCELLED',
      createdAt: NOW,
    },
    {
      orderId: 'c3',
      accountId: 'spoof',
      beneficialParticipantId: 'p_spoof',
      marketId: 'm_demo',
      side: 'SELL',
      quantity: 7n,
      remaining: 0n,
      status: 'CANCELLED',
      createdAt: NOW,
    },
    {
      orderId: 'buy1',
      accountId: 'taker',
      beneficialParticipantId: 'p_taker',
      marketId: 'm_demo',
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
      marketId: 'm_demo',
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
});
if (!layering.some((alert) => alert.kind === 'LAYERING_CANDIDATE' || alert.kind === 'SPOOFING_CANDIDATE')) {
  throw new Error('layering/spoofing detector failed');
}

const wash = surveillance.observe({
  marketId: 'm_demo',
  linkedAccounts: { a1: 'cluster', a2: 'cluster' },
  orders: [],
  trades: [
    {
      tradeId: 't_wash',
      marketId: 'm_demo',
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
});
const washAlert = wash.find((alert) => alert.kind === 'WASH_TRADING_PATTERN');
if (!washAlert) {
  throw new Error('wash detector failed');
}
const opened = surveillance.openCaseFromAlert(washAlert.alertId);
if (!opened) {
  throw new Error('case open failed');
}
const assigned = assignCase(opened, 'reviewer_1');
const decided = decideCase(assigned, {
  decision: 'RESTRICT',
  operatorRef: 'reviewer_1',
  actorKind: 'HUMAN_OPERATOR',
  reason: 'human review of coordinated-account candidate',
  evidenceRefs: [washAlert.alertId],
  decidedAt: NOW,
});
if (!decided.ok) {
  throw new Error('human case update failed');
}
const proposal = surveillance.proposeRestriction({
  alertId: washAlert.alertId,
  accountId: 'a1',
  proposedStatus: 'RESTRICTED',
  actorKind: 'HUMAN_OPERATOR',
});
if (!('applied' in proposal) || proposal.applied !== false) {
  throw new Error('restriction must remain a proposal');
}

console.log('market-surveillance demo: ok');
console.log(`  self-trade alerts=${self.filter((alert) => alert.kind === 'SELF_TRADING').length}`);
console.log(`  layering/spoofing candidates raised`);
console.log(`  wash/coordinated candidate ${washAlert.alertId} opened case ${opened.caseId}`);
console.log('  human reviewer updated canonical case; AI cannot punish');
console.log('  alerts are candidates, not legal conclusions; simulation only');
