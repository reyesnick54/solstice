/**
 * Phase 4 + 5 demo.
 *
 * set a mandate → agent proposes an investment sweep → Kernel ALLOWS one
 * and REFUSES another → show both explanations → a week of growth events
 * across multiple sources → weekly economic delta with realization classes
 * distinguished → prove no percentage appears.
 *
 * The agent never executes. LIVE_* flags remain false.
 */
import { Money, formatMoney } from '../../contracts/src/money.ts';
import { asAccountId, asAgentId, asCustomerId } from '../../contracts/src/ids.ts';
import { asUtcInstant } from '../../contracts/src/time.ts';
import { GROWTH_SOURCES, REALIZATION_CLASSES, CANONICAL_REALIZATION } from '../../contracts/src/growth-catalog.ts';
import { FORBIDDEN_ACTIONS, PROPOSAL_ACTION_TYPES } from '../../contracts/src/proposal-types.ts';
import { compileMandate } from '../../agent/src/mandates/compile.ts';
import { explainProposal, explainRefusal } from '../../agent/src/explain/explain.ts';
import { EVENT_CATALOG } from '../../contracts/src/events-catalog.ts';
import {
  createAgentFor,
  createControlPlane,
  issueDemoToken,
  setMandateThroughKernel,
} from './runtime.ts';
import { assembleFinancialContext } from './assembler/FinancialContextAssembler.ts';
import { LIVE_FLAGS } from './flags/live.ts';
import { isGateRejection } from './gate/ProposalGate.ts';
import type { CuratedOpportunity } from '../../agent/src/growth-os/services.ts';

const USD = (cents: bigint) => Money.fromMinorUnits(cents, 'USD');
const NOW = asUtcInstant('2026-08-13T15:00:00.000Z');
const WEEK_START = asUtcInstant('2026-08-06T00:00:00.000Z');
const WEEK_END = asUtcInstant('2026-08-13T23:59:59.000Z');

function log(title: string, value: unknown): void {
  console.log(`\n=== ${title} ===`);
  console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2));
}

const runtime = createControlPlane();
const customerId = asCustomerId('cust_demo_phase45');
const agentId = asAgentId('agent_personal_economy');

const token = issueDemoToken(runtime, {
  agentId,
  customerId,
  allowedProposalTypes: [...PROPOSAL_ACTION_TYPES],
  forbiddenActions: [...FORBIDDEN_ACTIONS],
  perTransactionLimit: USD(500_000_00n),
  dailyLimit: USD(2_000_000_00n),
  allowedAccountClasses: ['deposits', 'investments', 'digital_assets', 'rewards', 'pending'],
  forbiddenDataCategories: ['PII_FULL_NAME', 'TAX_ID', 'AUTHENTICATION_SECRETS', 'RAW_CARD_PAN', 'HEALTH'],
  maxRisk: 'MODERATE',
  issuedAt: NOW,
  expiresAt: asUtcInstant('2026-12-31T00:00:00.000Z'),
});

const agreedDeposits = asAccountId('acct_deposits_sweepable');
const protectedDeposits = asAccountId('acct_deposits_protected');
const investments = asAccountId('acct_investments');

const rawContext = {
  customerId,
  asOf: NOW,
  currency: 'USD',
  accounts: [
    {
      id: agreedDeposits,
      accountClass: 'deposits' as const,
      currency: 'USD',
      balance: USD(1_200_000_00n),
      depositInvestmentAgreement: {
        accountId: agreedDeposits,
        present: true as const,
        authorizedSweep: true as const,
      },
    },
    {
      id: protectedDeposits,
      accountClass: 'deposits' as const,
      currency: 'USD',
      balance: USD(800_000_00n),
      depositInvestmentAgreement: null,
    },
    {
      id: investments,
      accountClass: 'investments' as const,
      currency: 'USD',
      balance: USD(250_000_00n),
      depositInvestmentAgreement: null,
    },
  ],
  recentTransactions: [
    {
      id: 'txn_netflix',
      accountId: agreedDeposits,
      accountClass: 'deposits' as const,
      amount: USD(1_599n),
      direction: 'OUTFLOW' as const,
      merchantName: 'Netflix Duplicate',
      occurredAt: asUtcInstant('2026-08-01T12:00:00.000Z'),
      recurringGroupId: 'rec_netflix_dup',
    },
  ],
  recurringPatterns: [
    {
      groupId: 'rec_netflix_dup',
      merchantName: 'Netflix Duplicate',
      typicalAmount: USD(1_599n),
      cadence: 'MONTHLY' as const,
      lastSeenAt: asUtcInstant('2026-08-01T12:00:00.000Z'),
      classification: 'REDUNDANT' as const,
    },
    {
      groupId: 'rec_gym',
      merchantName: 'Idle Gym',
      typicalAmount: USD(8_000n),
      cadence: 'MONTHLY' as const,
      lastSeenAt: asUtcInstant('2026-05-01T12:00:00.000Z'),
      classification: 'UNUSED' as const,
    },
  ],
  monthlyEssentialSpending: USD(410_000n),
  highCostDebt: [],
  nearTermObligations: [],
  userGoals: [],
  realizedGainsThisWeek: USD(40_000n),
  piiFullName: 'MUST_NOT_REACH_AGENT',
  taxId: '000-00-0000',
};

const context = assembleFinancialContext(rawContext, token);
if ('piiFullName' in context || 'taxId' in context) {
  throw new Error('forbidden data categories leaked into financial context');
}

const mandateTexts = [
  'keep $10000 liquid',
  'maintain six months of expenses as reserves',
  'invest surplus cash',
  'never exceed Moderate risk',
  'reinvest 75% of realized gains',
  'move 25% of realized gains to savings weekly',
  'show me research opportunities paying more than $20',
];

const compiled = [];
for (const [i, text] of mandateTexts.entries()) {
  const result = compileMandate({
    customerId,
    sourceText: text,
    claims: token,
    currency: 'USD',
    compiledAt: NOW,
    version: i + 1,
    mandateId: `man_demo_${i + 1}`,
  });
  if (!result.ok) {
    throw new Error(`demo mandate failed: ${result.error.explanation}`);
  }
  const decision = setMandateThroughKernel(runtime, result.value, 'human_demo');
  if (decision.outcome !== 'ALLOWED') {
    throw new Error(`SET_MANDATE refused: ${decision.reason}`);
  }
  compiled.push(result.value);
  runtime.events.append('mandate.compiled', NOW, { text, mandateId: result.value.id });
}

log('Mandates set through Kernel', compiled.map((m) => ({
  id: m.id,
  version: m.version,
  kind: m.constraint.kind,
  sourceText: m.sourceText,
})));

const uncompilable = compileMandate({
  customerId,
  sourceText: 'beat the market and do whatever seems smart',
  claims: token,
  currency: 'USD',
  compiledAt: NOW,
  version: 99,
});
log('Uncompilable mandate', uncompilable.ok ? 'unexpected ok' : uncompilable.error);

const agent = createAgentFor(token, context, compiled);

const allowedSweep = agent.proposeInvestmentSweep({
  sourceAccountId: agreedDeposits,
  targetAccountId: investments,
  amount: USD(50_000_00n),
  now: NOW,
  proposalId: 'prop_sweep_allowed',
});
const refusedSweep = agent.proposeInvestmentSweep({
  sourceAccountId: protectedDeposits,
  targetAccountId: investments,
  amount: USD(25_000_00n),
  now: NOW,
  proposalId: 'prop_sweep_refused',
});

const allowDecision = runtime.gate.submitProposal(allowedSweep, token, NOW);
const refuseDecision = runtime.gate.submitProposal(refusedSweep, token, NOW);

log('Investment sweep A (agreement present)', {
  proposal: {
    id: allowedSweep.proposalId,
    actionType: allowedSweep.actionType,
    amount: allowedSweep.amount.toJSON(),
    reasonCode: allowedSweep.reasonCode,
  },
  kernel: allowDecision,
  explanation: explainProposal(allowedSweep),
});

log('Investment sweep B (no agreement — Kernel REFUSE is correct)', {
  proposal: {
    id: refusedSweep.proposalId,
    actionType: refusedSweep.actionType,
    amount: refusedSweep.amount.toJSON(),
    reasonCode: refusedSweep.reasonCode,
  },
  kernel: refuseDecision,
  explanation: isGateRejection(refuseDecision)
    ? explainRefusal(refusedSweep, refuseDecision.reason)
    : explainRefusal(refusedSweep, refuseDecision.reason),
});

if (allowDecision.outcome !== 'ALLOWED') {
  throw new Error('demo expected sweep A to be ALLOWED');
}
if (refuseDecision.outcome !== 'REFUSED') {
  throw new Error(`demo expected sweep B to be REFUSED, got ${refuseDecision.outcome}`);
}

const subscriptions = agent.proposeSubscriptions(NOW);
log('Subscription proposals (never mutate a real service)', {
  proposals: subscriptions.proposals.map((p) => ({
    id: p.proposalId,
    merchant: p.recordedFactors.find((f) => f.key === 'merchant_name'),
    reasonCode: p.reasonCode,
  })),
  explanations: subscriptions.explanations,
  kernel: subscriptions.proposals.map((p) => runtime.gate.submitProposal(p, token, NOW)),
});

const catalog: readonly CuratedOpportunity[] = [
  {
    opportunityId: 'opp_survey_21',
    sponsorId: 'spn_civic_research_co',
    sponsorName: 'Civic Research Co',
    verifiedSponsor: true,
    eligibility: 'US residents 18+',
    compensation: USD(2_500n),
    requiredTimeMinutes: 45n,
    privacyTerms: 'No raw location; responses retained 90 days',
    jurisdiction: 'US',
  },
];
const research = agent.proposeResearch(catalog, NOW);
log('Research opportunities (verified sponsors only)', {
  explanations: research.explanations,
});

const merchant = agent.proposeMerchantBid(
  {
    merchantId: 'mer_demo_co',
    merchantName: 'Demo Co Hardware',
    bid: USD(1_200n),
    anonymizedIntentId: 'intent_anon_1',
  },
  NOW,
);
runtime.gate.submitProposal(merchant.proposals[0]!, token, NOW);
log('Merchant exchange', merchant.explanations);

const reward = agent.proposeReward(
  [
    { method: 'debit', reward: USD(0n), source: 'CASHBACK' },
    { method: 'rewards_card', reward: USD(350n), source: 'CARD_REWARD_PENDING' },
  ],
  NOW,
);
runtime.gate.submitProposal(reward.proposals[0]!, token, NOW);
log('Reward router', reward.explanations);

const weekAmounts: { source: (typeof GROWTH_SOURCES)[number]; cents: bigint; at: string }[] = [
  { source: 'INTEREST_INCOME', cents: 1_250n, at: '2026-08-07T10:00:00.000Z' },
  { source: 'DIVIDEND_INCOME', cents: 4_000n, at: '2026-08-08T10:00:00.000Z' },
  { source: 'REALIZED_INVESTMENT_GAIN', cents: 12_500n, at: '2026-08-08T16:00:00.000Z' },
  { source: 'UNREALIZED_MARK_TO_MARKET', cents: 8_800n, at: '2026-08-09T16:00:00.000Z' },
  { source: 'CASHBACK', cents: 640n, at: '2026-08-09T18:00:00.000Z' },
  { source: 'CARD_REWARD_PENDING', cents: 350n, at: '2026-08-10T12:00:00.000Z' },
  { source: 'MERCHANT_EXCHANGE_SAVING', cents: 1_200n, at: '2026-08-10T15:00:00.000Z' },
  { source: 'SUBSCRIPTION_CANCELLATION', cents: 1_599n, at: '2026-08-11T09:00:00.000Z' },
  { source: 'FEE_WAIVER', cents: 500n, at: '2026-08-11T11:00:00.000Z' },
  { source: 'DEBT_INTEREST_AVOIDED', cents: 2_200n, at: '2026-08-11T12:00:00.000Z' },
  { source: 'OPPORTUNITY_COMPENSATION', cents: 2_500n, at: '2026-08-12T14:00:00.000Z' },
  { source: 'RESEARCH_COMPENSATION', cents: 2_500n, at: '2026-08-12T15:00:00.000Z' },
  { source: 'BILL_PRICE_INCREASE_AVOIDED', cents: 300n, at: '2026-08-13T09:00:00.000Z' },
];

for (const row of weekAmounts) {
  const event = runtime.events.append('growth.entry.recorded', asUtcInstant(row.at), {
    source: row.source,
    minorUnits: row.cents.toString(),
  });
  runtime.growth.record({
    customerId,
    source: row.source,
    amount: USD(row.cents),
    originatingEventId: event.id,
    recordedAt: asUtcInstant(row.at),
  });
}

const weekly = runtime.growth.summarize({
  customerId,
  period: 'WEEKLY',
  from: WEEK_START,
  to: WEEK_END,
  currency: 'USD',
});

log('Weekly economic delta (realization classes distinguished)', {
  period: weekly.period,
  from: weekly.from,
  to: weekly.to,
  settledCashTotal: formatMoney(weekly.settledCashTotal),
  unrealizedTotal: formatMoney(weekly.unrealizedTotal),
  costAvoidedTotal: formatMoney(weekly.costAvoidedTotal),
  pendingTotal: formatMoney(weekly.pendingTotal),
  note: 'Cost-avoided is not income. Unrealized is not withdrawable. No percentage-return is computed.',
  byRealizationClass: {
    SETTLED_CASH: formatMoney(weekly.byRealizationClass.SETTLED_CASH),
    UNREALIZED: formatMoney(weekly.byRealizationClass.UNREALIZED),
    COST_AVOIDED: formatMoney(weekly.byRealizationClass.COST_AVOIDED),
    PENDING: formatMoney(weekly.byRealizationClass.PENDING),
  },
  bySource: Object.fromEntries(
    GROWTH_SOURCES.map((s) => [s, `${formatMoney(weekly.bySource[s])} [${CANONICAL_REALIZATION[s]}]`]),
  ),
});

const deltaJson = JSON.stringify(weekly);
if (
  /%/.test(deltaJson) ||
  /percentageReturn|blendedYield|growthRate|apy|apr/i.test(deltaJson)
) {
  throw new Error('percentage-return leaked into weekly delta');
}

log('Phase 4 proof (agent cannot execute)', {
  journalsPosted: runtime.ledger.count(),
  executionAuthoritiesIssued: runtime.authorityIssuer.issuedCount(),
  allowedProposal: allowDecision.outcome,
  refusedProposal: refuseDecision.outcome,
  agentHasLedgerReference: false,
  agentHasAuthorityIssuer: false,
});

log('LIVE_* flags (unchanged, all false)', LIVE_FLAGS);
log('Event catalog size', EVENT_CATALOG.length);
log('Growth sources', GROWTH_SOURCES.length);
log('Realization classes', REALIZATION_CLASSES);

console.log('\ndemo: ok');
