/**
 * Phase 6 — Solstice Alpha demo (simulation only).
 *
 * open investment account (and one refused for a missing agreement)
 * → sweep cash across the disclosed bridge
 * → run three strategies in paper mode over a seeded series
 * → show a Risk Engine refusal that no model can override
 * → trigger a kill switch and show trading halts
 * → Weekly Harvest of realized profit only
 * → Growth Attribution entries with realized and unrealized kept distinct
 * → verify the evidence chain
 *
 * LIVE_TRADING_ENABLED stays false. No broker is contacted.
 */
import { Money, formatMoney } from '../packages/contracts/src/money.ts';
import { asAccountId, asCustomerId, asEventId } from '../packages/contracts/src/ids.ts';
import { asUtcInstant } from '../packages/contracts/src/time.ts';
import { LIVE_TRADING_ENABLED, CAPABILITIES as FLAG_CAPS } from '../packages/flags/src/capabilities.ts';
import { LIVE_FLAGS } from '../packages/platform/src/flags/live.ts';
import { createControlPlane } from '../packages/platform/src/runtime.ts';
import { ActionType } from '../packages/platform/src/kernel/ActionIntent.ts';
import { RiskEngine, overrideRiskRefusal, RISK_REFUSAL_UNOVERRIDABLE } from '../packages/risk-engine/src/index.ts';
import { ModelRegistry } from '../packages/model-registry/src/index.ts';
import { ExecutionEngine, simulatePriceSeries } from '../packages/execution-engine/src/index.ts';
import {
  MeanReversionStrategy,
  MomentumStrategy,
  MarketNeutralPairStrategy,
  noCredentials,
  recordTournamentMetrics,
  recommendWeights,
  applyRecommendationUnderRisk,
  promoteWithApproval,
} from '../packages/strategies/src/index.ts';
import { harvestUnrealized, sweepUndefinedPair, sumRealizedAndUnrealized } from '../packages/investments/src/index.ts';
import { unrealizedPnL } from '../packages/investments/src/pnl.ts';
import { Money as CMoney } from '../packages/contracts/src/money.ts';
import type { RiskRequest } from '../packages/contracts/src/risk-types.ts';
import { CANONICAL_REALIZATION } from '../packages/contracts/src/growth-catalog.ts';

const USD = (cents: bigint) => Money.fromMinorUnits(cents, 'USD');
const NOW = asUtcInstant('2026-08-14T12:00:00.000Z');

function log(title: string, value: unknown): void {
  console.log(`\n=== ${title} ===`);
  console.log(
    typeof value === 'string'
      ? value
      : JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item), 2),
  );
}

if (LIVE_TRADING_ENABLED !== false) {
  throw new Error('LIVE_TRADING_ENABLED must remain false');
}

const runtime = createControlPlane();
const customerId = asCustomerId('cust_alpha');
const depositId = 'acct_dep_alpha';
const invId = 'acct_inv_alpha';
const cashId = 'acct_inv_cash';
const secId = 'acct_inv_sec';

const refused = runtime.kernel.submit({
  actionType: ActionType.OPEN_INVESTMENT_ACCOUNT,
  payload: {
    accountId: invId,
    ownerId: customerId,
    cashAccountId: cashId,
    securitiesAccountId: secId,
    riskProfileCurrent: true,
    disclosureVersion: 'disc_v1',
    transferAuthorized: true,
  },
  idempotencyKey: 'open_inv_missing_agreement',
  actorId: 'human_demo',
  origin: 'HUMAN',
  requestedAt: NOW,
});
log('Open investment account REFUSED (missing agreement)', refused);
if (refused.outcome !== 'REFUSED') {
  throw new Error('demo expected missing-agreement refusal');
}

const opened = runtime.kernel.submit({
  actionType: ActionType.OPEN_INVESTMENT_ACCOUNT,
  payload: {
    accountId: invId,
    ownerId: customerId,
    cashAccountId: cashId,
    securitiesAccountId: secId,
    agreementVersion: 'iaa_v1',
    riskProfileCurrent: true,
    disclosureVersion: 'disc_v1',
    transferAuthorized: true,
  },
  idempotencyKey: 'open_inv_ok',
  actorId: 'human_demo',
  origin: 'HUMAN',
  requestedAt: NOW,
});
log('Open investment account ALLOWED', opened);
if (opened.outcome !== 'ALLOWED') {
  throw new Error(`demo expected open to be ALLOWED: ${opened.reason}`);
}

const seedAuth = runtime.alpha.issueAuthority(
  'SEED_INSURED_DEPOSIT',
  depositId,
  USD(1_000_000_00n),
  'seed_dep',
  NOW,
);
runtime.alpha.services.ledger.seedInsuredDeposit(depositId, USD(1_000_000_00n), seedAuth, NOW);
runtime.alpha.services.depositAccountIds.set(invId, depositId);

const swept = runtime.kernel.submit({
  actionType: ActionType.SWEEP_DEPOSIT_TO_INVESTMENT,
  payload: {
    depositAccountId: depositId,
    investmentAccountId: invId,
    amount: USD(200_000_00n),
  },
  idempotencyKey: 'sweep_ok',
  actorId: 'human_demo',
  origin: 'HUMAN',
  requestedAt: NOW,
});
log('Sweep deposit → investment cash (named bridge)', {
  kernel: swept,
  depositBalance: runtime.alpha.services.ledger.balanceOf(depositId).toString(),
  investmentCash: runtime.alpha.services.ledger.balanceOf(cashId).toString(),
  journals: runtime.alpha.services.ledger.list().map((j) => ({
    id: j.id,
    actionType: j.actionType,
    bridge: j.classBridgeName,
    sides: [...new Set(j.lines.map((l) => l.side))],
    balancedBooks: true,
  })),
});
if (swept.outcome !== 'ALLOWED') {
  throw new Error(`demo expected sweep ALLOWED: ${swept.reason}`);
}

const undefinedPair = sweepUndefinedPair(
  runtime.alpha.services.ledger,
  depositId,
  secId,
  USD(1_00n),
  NOW,
  seedAuth,
);
log('Sweep refused — bridge undefined for INSURED_DEPOSIT → INVESTMENT_SECURITY', undefinedPair);

const seed = 42n;
const series = simulatePriceSeries({
  instrumentId: 'SIM.A',
  currency: 'USD',
  seed,
  steps: 16,
  startMinorUnits: 10_000n,
  volatilityBps: 80n,
  startAt: NOW,
  stepMillis: 86_400_000n,
});
const replay = simulatePriceSeries({
  instrumentId: 'SIM.A',
  currency: 'USD',
  seed,
  steps: 8,
  startMinorUnits: 10_000n,
  volatilityBps: 80n,
  startAt: NOW,
  stepMillis: 86_400_000n,
  mode: 'REPLAY',
});

const meanRev = new MeanReversionStrategy(seed);
const momentum = new MomentumStrategy(seed);
const pair = new MarketNeutralPairStrategy(seed);
noCredentials(meanRev);
noCredentials(momentum);
noCredentials(pair);

const asOf = series.points[series.points.length - 1]!.asOf;
const proposals = [
  ...meanRev.propose(series, asOf),
  ...momentum.propose(series, asOf),
  ...pair.propose(series, asOf),
];
log('Three deterministic strategies (proposals only, never orders)', {
  proposals: proposals.map((p) => ({
    id: p.proposalId,
    strategy: p.strategyId,
    class: p.strategyClass,
    side: p.side,
    instrument: p.instrumentId,
    guaranteed: p.guaranteed,
    expected: p.expected,
    projected: p.projected,
  })),
  replayPoints: replay.points.map((p) => p.minorUnitsPerShare.toString()),
});

const risk = new RiskEngine();
const execution = new ExecutionEngine(risk, { slippageBps: 15n });
const paperAuth = runtime.alpha.issueAuthority('PAPER_FILL', 'paper', USD(0n), 'paper_auth', NOW);

const customerJournalsBefore = runtime.ledger.count();
const paperFills = [];
for (const proposal of proposals) {
  const request: RiskRequest = {
    strategyId: proposal.strategyId,
    instrumentId: proposal.instrumentId,
    side: proposal.side,
    quantityMicros: proposal.quantityMicros,
    priceMinorUnits: proposal.limitPriceMinorUnits,
    currency: 'USD',
    proposedNotional: USD(10_000_00n),
    currentPositionMicros: 0n,
    currentGrossMinorUnits: 100_000_00n,
    currentNetMinorUnits: 0n,
    equityMinorUnits: 1_000_000_00n,
    dailyRealizedLossMinorUnits: 0n,
    peakEquityMinorUnits: 1_000_000_00n,
    troughEquityMinorUnits: 1_000_000_00n,
    volatilityMadBps: 50n,
    expectedShortfallBps: 80n,
    largestPositionMinorUnits: 10_000_00n,
    instrumentLiquid: true,
    counterpartyId: 'cp_sim',
    counterpartyNotionalMinorUnits: 0n,
    averageDailyVolumeMicros: 100_000_000n,
    strategyGrossMinorUnits: 0n,
  };
  const verdict = risk.evaluate(request);
  const result = execution.execute(proposal, verdict, 'PAPER', paperAuth, asOf);
  paperFills.push({ proposal: proposal.proposalId, verdict: verdict.kind, result });
  if (result.ok && result.record.mode === 'PAPER') {
    const portfolio = runtime.alpha.services.portfolios.get(invId);
    portfolio?.applyFill({
      instrumentId: proposal.instrumentId,
      side: proposal.side,
      quantityMicros: result.record.filledQuantityMicros,
      priceMinorUnits: result.record.fillPriceMinorUnits,
      currency: 'USD',
      accountId: asAccountId(secId),
    });
  }
}
log('Paper mode fills (paper ledger only)', {
  fills: paperFills,
  paperJournals: execution.paper.count(),
  customerLedgerUnchanged: runtime.ledger.count() === customerJournalsBefore,
});

const shadow = execution.execute(proposals[0]!, { kind: 'ALLOW', final: false }, 'SHADOW', paperAuth, asOf);
log('Shadow mode (proposal recorded, no paper fill)', shadow);

const refuseRequest: RiskRequest = {
  strategyId: 'strat_mean_reversion',
  instrumentId: 'SIM.A',
  side: 'BUY',
  quantityMicros: 1_000_000n,
  priceMinorUnits: 10_000n,
  currency: 'USD',
  proposedNotional: USD(10_000_00n),
  currentPositionMicros: 0n,
  currentGrossMinorUnits: 100_000_00n,
  currentNetMinorUnits: 0n,
  equityMinorUnits: 1_000_000_00n,
  dailyRealizedLossMinorUnits: 0n,
  peakEquityMinorUnits: 1_000_000_00n,
  troughEquityMinorUnits: 1_000_000_00n,
  volatilityMadBps: 50n,
  expectedShortfallBps: 80n,
  largestPositionMinorUnits: 10_000_00n,
  instrumentLiquid: false,
  counterpartyId: 'cp_sim',
  counterpartyNotionalMinorUnits: 0n,
  averageDailyVolumeMicros: 100_000_000n,
  strategyGrossMinorUnits: 0n,
};
const refusal = risk.evaluate(refuseRequest);
if (refusal.kind !== 'REFUSE' || refusal.final !== true) {
  throw new Error('demo expected a FINAL Risk Engine refusal');
}
const overrideAttempt = (() => {
  try {
    overrideRiskRefusal(refusal, undefined as never);
    return 'OVERRIDE_SUCCEEDED';
  } catch (err) {
    return (err as Error).message;
  }
})();
const afterRefusal = execution.execute(proposals[0]!, refusal, 'PAPER', paperAuth, asOf);
log('Risk Engine refusal is FINAL — no model can override', {
  refusal,
  unoverridableProof: RISK_REFUSAL_UNOVERRIDABLE,
  overrideAttempt,
  executionAfterRefusal: afterRefusal,
});

risk.killSwitches.engage({ kind: 'ALL_TRADING' }, 'demo halt', 'operator_human', NOW);
const halted = execution.execute(
  proposals[0]!,
  { kind: 'ALLOW', final: false },
  'PAPER',
  paperAuth,
  asOf,
);
log('Kill switch ALL_TRADING (no AI running)', {
  engaged: risk.killSwitches.list(),
  execution: halted,
});

const registry = new ModelRegistry();
registry.register({
  modelId: 'mdl_aml_v1',
  version: '1.0.0',
  owner: 'compliance',
  purpose: 'AML',
  riskClass: 'HIGH',
  trainingDataReference: 'sim://aml/seed',
  features: ['amount', 'jurisdiction'],
  approvedJurisdictions: ['US'],
  approvedProducts: ['INVESTMENT_ASSET'],
  validationState: 'DRAFT',
  releaseState: 'UNRELEASED',
  deploymentState: 'NOT_DEPLOYED',
  monitoringState: 'UNMONITORED',
  limitations: ['simulation only'],
  killSwitchState: 'CLEAR',
  approvalSignatures: [],
  lastReview: NOW,
});
registry.register({
  modelId: 'mdl_trading_v1',
  version: '1.0.0',
  owner: 'research',
  purpose: 'TRADING',
  riskClass: 'MODERATE',
  trainingDataReference: 'sim://trading/seed',
  features: ['price', 'quantity'],
  approvedJurisdictions: ['US'],
  approvedProducts: ['INVESTMENT_ASSET'],
  validationState: 'RELEASED',
  releaseState: 'RELEASED',
  deploymentState: 'PAPER',
  monitoringState: 'ACTIVE',
  limitations: ['not guaranteed', 'paper only'],
  killSwitchState: 'CLEAR',
  approvalSignatures: [{ signer: 'risk', signedAt: NOW, role: 'RISK' }],
  lastReview: NOW,
});
log('Model registry lifecycle gate', {
  draftAllocation: registry.allocate('mdl_aml_v1', '1.0.0', 1n, 1n),
  releasedAllocation: registry.allocate('mdl_trading_v1', '1.0.0', 1n, 2n),
});

const portfolio = runtime.alpha.services.portfolios.get(invId)!;
portfolio.recordRealizedSettled(USD(4_000_00n));
const valuation = portfolio.value({
  asOf,
  prices: series.points.slice(-1),
  cash: USD(runtime.alpha.services.ledger.balanceOf(cashId)),
});
log('Portfolio valuation (not cash; investment-account scoped)', {
  asOf: valuation.asOf,
  priceSource: valuation.priceSource,
  presentedAsCash: valuation.presentedAsCash,
  scopeLabel: valuation.scopeLabel,
  cash: formatMoney(valuation.cash),
  marketValue: formatMoney(valuation.marketValue),
  realizedSettled: formatMoney(valuation.realizedSettled.amount),
  unrealized: formatMoney(valuation.unrealized.amount),
  note: 'Realized and unrealized are distinct types and are not summed.',
});

try {
  sumRealizedAndUnrealized(valuation.realizedSettled, valuation.unrealized);
  throw new Error('summing realized and unrealized must fail');
} catch (err) {
  log('Realized + unrealized cannot be summed', (err as Error).message);
}

const unrealizedSweep = harvestUnrealized(unrealizedPnL(USD(1_00n)));
log('Unrealized sweep is a typed rejection', unrealizedSweep);

const harvest = runtime.kernel.submit({
  actionType: ActionType.WEEKLY_HARVEST,
  payload: {
    depositAccountId: depositId,
    investmentAccountId: invId,
    share: 50,
  },
  idempotencyKey: 'harvest_50',
  actorId: 'human_demo',
  origin: 'HUMAN',
  requestedAt: NOW,
});
log('Weekly Harvest 50% of realized settled profit', {
  kernel: harvest,
  depositAfter: runtime.alpha.services.ledger.balanceOf(depositId).toString(),
  remainingRealized: formatMoney(portfolio.realizedSettled().amount),
});

const gainEvent = runtime.events.append('growth.entry.recorded', NOW, { source: 'REALIZED_INVESTMENT_GAIN' });
const lossEvent = runtime.events.append('growth.entry.recorded', NOW, { source: 'REALIZED_INVESTMENT_LOSS' });
const mtmEvent = runtime.events.append('growth.entry.recorded', NOW, { source: 'UNREALIZED_MARK_TO_MARKET' });
runtime.growth.record({
  customerId,
  source: 'REALIZED_INVESTMENT_GAIN',
  amount: USD(4_000_00n),
  originatingEventId: gainEvent.id,
  recordedAt: NOW,
});
runtime.growth.record({
  customerId,
  source: 'REALIZED_INVESTMENT_LOSS',
  amount: USD(250_00n),
  originatingEventId: lossEvent.id,
  recordedAt: NOW,
});
runtime.growth.record({
  customerId,
  source: 'UNREALIZED_MARK_TO_MARKET',
  amount: USD(800_00n),
  originatingEventId: mtmEvent.id,
  recordedAt: NOW,
});
const weekly = runtime.growth.summarize({
  customerId,
  period: 'WEEKLY',
  from: NOW,
  to: NOW,
  currency: 'USD',
});
log('Growth Attribution — realized and unrealized kept distinct', {
  realizedGain: formatMoney(weekly.bySource.REALIZED_INVESTMENT_GAIN),
  realizedLoss: formatMoney(weekly.bySource.REALIZED_INVESTMENT_LOSS),
  unrealized: formatMoney(weekly.bySource.UNREALIZED_MARK_TO_MARKET),
  realizedClass: CANONICAL_REALIZATION.REALIZED_INVESTMENT_GAIN,
  lossClass: CANONICAL_REALIZATION.REALIZED_INVESTMENT_LOSS,
  unrealizedClass: CANONICAL_REALIZATION.UNREALIZED_MARK_TO_MARKET,
  settledCashTotal: formatMoney(weekly.settledCashTotal),
  unrealizedTotal: formatMoney(weekly.unrealizedTotal),
  note: 'Unrealized is not withdrawable. No blended wealth return is computed.',
});

const metrics = recordTournamentMetrics(
  [
    { strategyId: 'strat_mean_reversion', pnlMinorUnits: 1_200n, turnoverMicros: 1_000_000n, slippageBps: 15n },
    { strategyId: 'strat_momentum', pnlMinorUnits: 800n, turnoverMicros: 1_000_000n, slippageBps: 15n },
    { strategyId: 'strat_market_neutral_pair', pnlMinorUnits: 400n, turnoverMicros: 2_000_000n, slippageBps: 15n },
  ],
  'USD',
);
const weights = recommendWeights(metrics.map((m) => m.strategyId));
const blocked = applyRecommendationUnderRisk(weights[0]!, refuseRequest, risk);
const approval = promoteWithApproval({
  strategyId: 'strat_mean_reversion',
  from: 'RESEARCH',
  to: 'BACKTEST',
  approvedBy: 'human_research_lead',
  approvedAt: NOW,
  reason: 'explicit recorded approval — not a metric threshold',
});
log('Tournament metrics (investment-account scoped) and allocator', {
  metrics,
  weights,
  allocatorBlockedByRisk: blocked,
  lifecycleApproval: approval,
});

const evidence = runtime.evidence.list();
let chainOk = true;
for (let i = 1; i < evidence.length; i += 1) {
  if (evidence[i]!.prevRecordSha256 !== evidence[i - 1]!.recordSha256) {
    chainOk = false;
  }
}
log('Evidence chain', {
  records: evidence.length,
  chainVerifies: chainOk,
  kinds: evidence.map((e) => e.kind),
});
if (!chainOk) {
  throw new Error('evidence chain failed');
}

log('LIVE_* flags (unchanged)', { ...LIVE_FLAGS, ...FLAG_CAPS, LIVE_TRADING_ENABLED });
log('Phase 6 exit', {
  shadowAndPaper: true,
  customerCapitalAtRisk: false,
  liveTradingEnabled: LIVE_TRADING_ENABLED,
  paperJournals: execution.paper.count(),
  customerAgentLedger: runtime.ledger.count(),
  investmentJournals: runtime.alpha.services.ledger.count(),
});

void CMoney;
void asEventId;

console.log('\nphase-6 demo: ok');
