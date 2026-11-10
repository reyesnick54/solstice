// Illustrative data for Demo mode. Nothing here comes from, or is sent to,
// the SunRey backend. Shapes match the canonical /api/v1 responses so the
// views render demo and real data the same way.
//
// Rules kept even in a demo:
// - Amounts are integer minor-unit strings; prices are integer price units
//   (6 implied decimals); derived figures use BigInt.
// - No percentage return, yield or growth-rate field. Results are money
//   amounts, with realised and unrealised kept apart.
// - Every name of a person, merchant, lab or sponsor is fictional.

const NOW = Date.now();
const MIN = 60 * 1000;
const iso = (t) => new Date(t).toISOString();
const ago = (minutes) => iso(NOW - minutes * MIN);
const ahead = (minutes) => iso(NOW + minutes * MIN);
const usd = (cents) => ({ minorUnits: String(cents), currency: 'USD' });
const UNIT = 1000000n; // 6-decimal base units for SR and MR

/** Deterministic pseudo-random sequence so the demo looks the same on every load. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hex = (r, n) => Array.from({ length: n }, () => '0123456789abcdef'[Math.floor(r() * 16)]).join('');

// ---- Markets -------------------------------------------------------------

const MARKET_DEFS = [
  { marketId: 'SRC-USD', symbol: 'SR/USD', baseAsset: 'SUNREY_COIN', quoteAsset: 'USD', last: 2475000, tick: 2500, swing: 9000, seed: 11, qty: [180, 2400] },
  { marketId: 'MRC-USD', symbol: 'MR/USD', baseAsset: 'MOONREY_COIN', quoteAsset: 'USD', last: 812500, tick: 1250, swing: 4200, seed: 23, qty: [400, 5200] },
  { marketId: 'SRC-MRC', symbol: 'SR/MR', baseAsset: 'SUNREY_COIN', quoteAsset: 'MOONREY_COIN', last: 3046100, tick: 2500, swing: 11000, seed: 37, qty: [90, 1600] },
];

function buildMarket(def) {
  const r = rng(def.seed);
  const n = 96; // 15-minute candles over 24 hours
  const closes = [];
  let p = 0;
  for (let i = 0; i < n; i += 1) {
    p += Math.round((r() - 0.47) * def.swing);
    closes.push(p);
  }
  const shift = def.last - closes[n - 1];
  const candles = [];
  let prevClose = closes[0] + shift - Math.round(def.swing / 3);
  for (let i = 0; i < n; i += 1) {
    const close = closes[i] + shift;
    const open = prevClose;
    const high = Math.max(open, close) + Math.round(r() * def.swing * 0.6);
    const low = Math.min(open, close) - Math.round(r() * def.swing * 0.6);
    const qty = def.qty[0] + Math.floor(r() * (def.qty[1] - def.qty[0]));
    candles.push({
      openTime: iso(NOW - (n - i) * 15 * MIN),
      open: String(open),
      high: String(high),
      low: String(low),
      close: String(close),
      volume: String(BigInt(qty) * UNIT),
    });
    prevClose = close;
  }
  let vol = 0n;
  let notional = 0n;
  let hi = -Infinity;
  let lo = Infinity;
  for (const c of candles) {
    vol += BigInt(c.volume);
    notional += BigInt(c.close) * BigInt(c.volume);
    hi = Math.max(hi, Number(c.high));
    lo = Math.min(lo, Number(c.low));
  }
  const open24 = BigInt(candles[0].open);
  const last = BigInt(def.last);
  const vwap = vol > 0n ? notional / vol : last;
  // Quote-side volume: price units (6 dp) x base units (6 dp) -> quote minor units.
  const quoteVolume = def.quoteAsset === 'USD' ? notional / 10000000000n : notional / UNIT;
  const bestBid = def.last - def.tick;
  const bestAsk = def.last + def.tick;

  const bids = [];
  const asks = [];
  for (let i = 0; i < 12; i += 1) {
    bids.push({ priceUnits: String(bestBid - i * def.tick), quantity: String(def.qty[0] + Math.floor(r() * def.qty[1] * (0.4 + i * 0.12))) });
    asks.push({ priceUnits: String(bestAsk + i * def.tick), quantity: String(def.qty[0] + Math.floor(r() * def.qty[1] * (0.4 + i * 0.12))) });
  }
  const sum = (levels) => levels.reduce((s, l) => s + BigInt(l.quantity) * UNIT, 0n);

  const trades = [];
  for (let i = 0; i < 18; i += 1) {
    const side = r() > 0.5 ? 'BUY' : 'SELL';
    trades.push({
      tradeId: `trd_${hex(r, 16)}`,
      side,
      priceUnits: String(def.last + (side === 'BUY' ? 1 : -1) * def.tick * Math.floor(r() * 3)),
      quantity: String(def.qty[0] + Math.floor(r() * 600)),
      executedAt: ago(i * 3 + Math.floor(r() * 3)),
    });
  }

  return {
    summary: {
      marketId: def.marketId,
      symbol: def.symbol,
      baseAsset: def.baseAsset,
      quoteAsset: def.quoteAsset,
      state: 'OPEN',
      marketDataStatus: 'DEMO',
      liquiditySource: 'Illustrative order book',
      lastPriceUnits: String(def.last),
      change24hBps: String(((last - open24) * 10000n) / open24),
      volume24h: String(vol),
    },
    detail: {
      marketId: def.marketId,
      baseAsset: def.baseAsset,
      quoteAsset: def.quoteAsset,
      lastEligibleTrade: String(def.last),
      bestBid: String(bestBid),
      bestAsk: String(bestAsk),
      spreadUnits: String(bestAsk - bestBid),
      statistics: {
        valid: true,
        reason: 'OK',
        tradeCount: String(1200 + Math.floor(r() * 900)),
        volume: String(vol),
        highPriceUnits: String(hi),
        lowPriceUnits: String(lo),
        openPriceUnits: String(open24),
        vwapUnits: String(vwap),
        quoteVolume: String(quoteVolume),
      },
      depthSummary: { bidDepth: String(sum(bids)), askDepth: String(sum(asks)) },
      marketState: 'OPEN',
      liquidityWarnings: [],
      dataTimestamp: iso(NOW),
    },
    book: { marketId: def.marketId, bids, asks },
    candles: { marketId: def.marketId, interval: '15m', candles },
    trades: { items: trades },
  };
}

const MARKETS = Object.fromEntries(MARKET_DEFS.map((d) => [d.marketId, buildMarket(d)]));

// ---- Exchange account ----------------------------------------------------

const exchange = {
  portfolio: [
    { assetId: 'SUNREY_COIN', available: String(12450n * UNIT + 250000n), reserved: String(500n * UNIT), pending: String(120n * UNIT), finalized: String(12950n * UNIT + 250000n) },
    { assetId: 'MOONREY_COIN', available: String(38200n * UNIT), reserved: String(1500n * UNIT), pending: '0', finalized: String(39700n * UNIT) },
  ],
  orders: [
    { orderId: 'xord_8c1f2a90b7d34e51', marketId: 'SRC-USD', side: 'BUY', quantity: '500', remaining: '0', averagePrice: '2461250', status: 'FILLED', settlementIds: ['stl_31a9e0c2'], createdAt: ago(46) },
    { orderId: 'xord_2b77d04e9a1c5f30', marketId: 'SRC-MRC', side: 'SELL', quantity: '300', remaining: '120', averagePrice: '3051800', status: 'PARTIALLY_FILLED', settlementIds: ['stl_7d02b6e1'], createdAt: ago(31) },
    { orderId: 'xord_f40e9c18a2b6d713', marketId: 'MRC-USD', side: 'BUY', quantity: '1500', remaining: '1500', averagePrice: null, status: 'OPEN', settlementIds: [], createdAt: ago(12) },
    { orderId: 'xord_61ad3b0f7e2c9a84', marketId: 'SRC-USD', side: 'SELL', quantity: '250', remaining: '0', averagePrice: '2489750', status: 'FILLED', settlementIds: ['stl_c94f1b07'], createdAt: ago(320) },
    { orderId: 'xord_0e5c72a1d8f4b396', marketId: 'MRC-USD', side: 'SELL', quantity: '800', remaining: '800', averagePrice: null, status: 'CANCELLED', settlementIds: [], createdAt: ago(1440) },
  ],
  fills: [
    { tradeId: 'trd_9f1c0a7e3b52d6e4', quantity: '500', priceUnits: '2461250', executedAt: ago(45) },
    { tradeId: 'trd_4a8e2d71c0f9b356', quantity: '180', priceUnits: '3051800', executedAt: ago(30) },
    { tradeId: 'trd_c27b5e90a14f8d63', quantity: '250', priceUnits: '2489750', executedAt: ago(318) },
  ],
  transactions: [
    { kind: 'SANDBOX_FUND', quantity: '1000', createdAt: ago(2880), transactionId: 'xtx_5e0b9a3c' },
    { kind: 'SETTLEMENT', quantity: '500', price: '2461250', createdAt: ago(44), transactionId: 'xtx_31a9e0c2' },
  ],
};

// ---- Wallets & chain -----------------------------------------------------

const wr = rng(71);
const wallets = {
  list: [
    { walletId: `wal_sr_${hex(wr, 12)}`, assetId: 'SUNREY_COIN', address: `sr1q${hex(wr, 38)}`, network: 'SUNREY_TESTNET', status: 'ACTIVE', createdAt: ago(20160) },
    { walletId: `wal_mr_${hex(wr, 12)}`, assetId: 'MOONREY_COIN', address: `mr1q${hex(wr, 38)}`, network: 'SUNREY_TESTNET', status: 'ACTIVE', createdAt: ago(20100) },
  ],
  balances: { SRC: String(4820n * UNIT + 500000n), MRC: String(15340n * UNIT) },
  tx: [
    ['EXCHANGE_SETTLEMENT', 'SUNREY_COIN', 500n, 'FINALIZED', 44],
    ['DEPOSIT', 'MOONREY_COIN', 2500n, 'FINALIZED', 190],
    ['CONTRIBUTION_REWARD', 'SUNREY_COIN', 40n, 'FINALIZED', 610],
    ['TRANSFER_OUT', 'SUNREY_COIN', 125n, 'FINALIZED', 1210],
    ['DEPOSIT', 'SUNREY_COIN', 1000n, 'FINALIZED', 2900],
    ['ACCESS_RESERVATION', 'MOONREY_COIN', 300n, 'FINALIZED', 4100],
    ['TRANSFER_IN', 'MOONREY_COIN', 750n, 'FINALIZED', 5800],
    ['DEPOSIT', 'SUNREY_COIN', 25n, 'CONFIRMING', 2],
  ].map(([kind, assetId, q, status, minutes], i) => ({
    transactionId: `wtx_${hex(wr, 10)}`,
    txHash: `0x${hex(wr, 64)}`,
    kind,
    assetId,
    quantity: String(q * UNIT),
    status,
    confirmations: status === 'CONFIRMING' ? '2' : String(40 + i * 37),
    blockHeight: String(4821930 - minutes * 12),
    occurredAt: ago(minutes),
  })),
};

const registry = (canonicalName, ticker, supplyModel) => ({
  asset: { canonicalName, status: 'TESTNET', decimals: 6, supplyModel, assetClass: 'NATIVE_DIGITAL_ASSET', ledgerKind: 'SUNREY_CHAIN_NATIVE', tickerStatus: `${ticker} (provisional, trademark search pending)`, evmToken: false },
});

const chain = {
  network: 'SUNREY_TESTNET',
  blockHeight: '4821930',
  finalizedHeight: '4821926',
  averageBlockTime: '5 seconds',
  finality: 'BFT, about 20 seconds',
  validators: '21 of 21 active',
  transactionsInLastDay: '186,402',
  pendingTransactions: '37',
  mainnetActive: false,
};

// ---- Helios desk / Grow ---------------------------------------------------

const helios = {
  overview: {
    deskState: 'PAPER_TRADING',
    executionMode: 'PAPER',
    cycle: 'Cycle 1,284',
    lastCycleAt: ago(4),
    nextCycleAt: ahead(11),
    activeStrategies: '5',
    openPositions: '7',
    pendingOrderIntents: '2',
    riskEngine: 'WITHIN_LIMITS',
    killSwitch: 'NOT_TRIGGERED',
    mandate: 'Moderate risk, $50,000 paper capital',
    marketData: 'ILLUSTRATIVE',
  },
  agentState: {
    summary: 'Six specialist agents research and propose. None can place an order: every intent goes through the Compliance Kernel and the Risk Engine, and is filled on paper only.',
    agents: [
      { name: 'Macro Scout', role: 'Rates, FX and commodity regimes', status: 'RESEARCHING', currentTask: 'Re-scoring USD strength after this morning’s rate print', lastProposalAt: ago(38) },
      { name: 'Trend Follower', role: 'Multi-week momentum across equity indices', status: 'HOLDING', currentTask: 'Trend intact on 2 of 3 signals; no change proposed', lastProposalAt: ago(260) },
      { name: 'Pairs Analyst', role: 'Statistical relative value between related stocks', status: 'PROPOSING', currentTask: 'Spread between two payment networks is 2.1 deviations wide', lastProposalAt: ago(6) },
      { name: 'Volatility Desk', role: 'Hedges and option-implied risk', status: 'MONITORING', currentTask: 'Implied volatility below its 20-day range; hedge cost low', lastProposalAt: ago(140) },
      { name: 'Execution Planner', role: 'Order slicing, timing and slippage', status: 'IDLE', currentTask: 'Waiting for an approved intent', lastProposalAt: ago(52) },
      { name: 'Risk Sentinel', role: 'Checks every proposal against your mandate first', status: 'WATCHING', currentTask: 'Gross exposure at 64% of the mandate cap', lastProposalAt: ago(1) },
    ],
  },
  capital: {
    activeCapital: {
      paperCapital: usd(5000000),
      allocated: usd(3215000),
      reservedForOpenIntents: usd(250000),
      available: usd(1535000),
      cashBuffer: usd(500000),
      lastReconciledAt: ago(4),
    },
  },
  strategies: [
    { rank: 1, displayName: 'Index Trend, Long Only', strategyFamily: 'TREND', markets: ['US_EQUITIES'], riskLevel: 'MODERATE', evidenceState: 'PAPER_VALIDATED', executionMode: 'PAPER', status: 'ACTIVE', allocation: usd(1200000), realisedPnl: usd(84210), maxDrawdown: usd(-31650), trades: '42' },
    { rank: 2, displayName: 'Payments Pair', strategyFamily: 'STATISTICAL_ARBITRAGE', markets: ['US_EQUITIES'], riskLevel: 'MODERATE', evidenceState: 'PAPER_VALIDATED', executionMode: 'PAPER', status: 'ACTIVE', allocation: usd(650000), realisedPnl: usd(41975), maxDrawdown: usd(-18420), trades: '118' },
    { rank: 3, displayName: 'Dollar Regime FX', strategyFamily: 'MACRO', markets: ['FX'], riskLevel: 'MODERATE', evidenceState: 'BACKTESTED', executionMode: 'PAPER', status: 'ACTIVE', allocation: usd(600000), realisedPnl: usd(12360), maxDrawdown: usd(-22900), trades: '27' },
    { rank: 4, displayName: 'Low-Vol Hedge Overlay', strategyFamily: 'VOLATILITY', markets: ['US_EQUITIES', 'OPTIONS'], riskLevel: 'LOW', evidenceState: 'PAPER_VALIDATED', executionMode: 'PAPER', status: 'ACTIVE', allocation: usd(415000), realisedPnl: usd(-6840), maxDrawdown: usd(-9120), trades: '9' },
    { rank: 5, displayName: 'SR/MR Liquidity Provision', strategyFamily: 'MARKET_MAKING', markets: ['SUNREY_EXCHANGE_TESTNET'], riskLevel: 'MODERATE', evidenceState: 'SHADOW', executionMode: 'SHADOW', status: 'SHADOW', allocation: usd(350000), realisedPnl: usd(0), maxDrawdown: usd(0), trades: '0' },
  ],
  positions: [
    ['SPY', '40', 2104000, 2196200, 'Index Trend, Long Only'],
    ['QQQ', '25', 1186500, 1241750, 'Index Trend, Long Only'],
    ['V', '30', 838800, 861300, 'Payments Pair'],
    ['MA', '-16', -749600, -762560, 'Payments Pair'],
    ['EUR/USD', '50000', 5420000, 5397500, 'Dollar Regime FX'],
    ['SPY Mar put', '4', 98000, 71600, 'Low-Vol Hedge Overlay'],
    ['IEF', '60', 563400, 559800, 'Index Trend, Long Only'],
  ].map(([symbol, quantity, cost, value, strategy], i) => ({
    symbol,
    quantity,
    strategy,
    costBasis: usd(cost),
    marketValue: usd(value),
    unrealizedPnl: usd(value - cost),
    realizedPnl: usd([18230, 9410, 6120, -2380, 3460, 0, 1290][i]),
    executionMode: 'PAPER',
  })),
  results: {
    performance: {
      realisedPnl: usd(131705),
      unrealisedPnl: usd(141110),
      feesPaid: usd(-4380),
      estimatedSlippage: usd(-2915),
      tradesExecuted: '196',
      winningTrades: '112',
      losingTrades: '84',
      observationWindow: 'Last 90 days, paper',
    },
    risk: {
      grossExposure: usd(3215000),
      netExposure: usd(2470000),
      mandateGrossCap: usd(5000000),
      largestDrawdown: usd(-58300),
      dailyLossLimit: usd(-150000),
      dailyLossUsedToday: usd(-12480),
      expectedShortfallOneDay: usd(-41200),
      riskLimitBreaches: '0',
    },
    disclosure: { nature: 'PAPER_TRADING', note: 'Simulated fills on illustrative prices. Not a profit, not a promise.' },
  },
  activity: [
    ['PAIRS_SIGNAL', 'PROPOSED', 'Pairs Analyst proposed narrowing V/MA by 10 shares', 6],
    ['KERNEL_EVALUATED', 'ALLOWED', 'Fit for paper execution; sealed in the Evidence Vault', 5],
    ['RISK_ENGINE_CHECK', 'CLIPPED', 'Size reduced from 14 to 10 shares to stay under the single-name cap', 5],
    ['PAPER_FILL', 'FILLED', 'Sold 10 MA at $476.60 (paper)', 4],
    ['RESEARCH_NOTE', 'RECORDED', 'Macro Scout: dollar strength regime unchanged', 38],
    ['REBALANCE_PROPOSED', 'AWAITING_APPROVAL', 'Trim QQQ by 5 to bring tech weight back inside your band', 52],
    ['HEDGE_REVIEW', 'NO_ACTION', 'Volatility Desk: hedge still adequate at current exposure', 140],
    ['KILL_SWITCH_TEST', 'PASSED', 'Weekly kill-switch drill completed by Risk Sentinel', 720],
  ].map(([kind, state, detail, minutes]) => ({ kind, state, detail, occurredAt: ago(minutes) })),
  plan: {
    exists: true,
    state: 'ACTIVE_PAPER',
    planName: 'Balanced Growth (paper)',
    riskLevel: 'MODERATE',
    paperCapital: usd(5000000),
    weeklyHarvest: 'Sweep 25% of realised, settled gains to Savings',
    reinvestRealisedGains: '75%',
    createdAt: ago(60 * 24 * 41),
  },
  controls: {
    mandateRiskLevel: 'MODERATE',
    maxSingleNameExposure: usd(600000),
    maxGrossExposure: usd(5000000),
    dailyLossLimit: usd(-150000),
    leverageAllowed: false,
    cryptoSpeculationAllowed: false,
    keepLiquid: usd(1000000),
    killSwitch: 'NOT_TRIGGERED',
    enforcedBy: 'Deterministic Risk Engine',
  },
  opportunities: [
    { title: 'Move idle cash above your reserve into Savings', valueSource: 'DEPOSIT_INTEREST', estimatedValue: usd(1840), confidence: 'HIGH', generatedAt: ago(30) },
    { title: 'Cancel an unused streaming subscription', valueSource: 'SUBSCRIPTION_SAVING', estimatedValue: usd(19188), confidence: 'HIGH', generatedAt: ago(30) },
    { title: 'Join an anonymised sleep study', valueSource: 'RESEARCH_EARNING', estimatedValue: usd(6000), confidence: 'MEDIUM', generatedAt: ago(30) },
    { title: 'Switch home internet plan at renewal', valueSource: 'BILL_SAVING', estimatedValue: usd(14400), confidence: 'MEDIUM', generatedAt: ago(30) },
  ],
};

// ---- Financial agent -------------------------------------------------------

const agent = {
  status: {
    status: 'ACTIVE',
    mode: 'PROPOSE_ONLY',
    model: 'S3M primary (simulated)',
    lastRunAt: ago(9),
    proposalsThisWeek: '6',
    approvedThisWeek: '2',
    capabilityToken: `Valid until ${new Date(NOW + 29 * 24 * 60 * MIN).toDateString()}`,
    canMoveMoney: false,
  },
  settings: {
    mayRead: ['ACCOUNT_BALANCES', 'TRANSACTIONS', 'SUBSCRIPTIONS', 'GROW_PLAN', 'MARKET_DATA'],
    mayPropose: ['SAVINGS_SWEEP', 'SUBSCRIPTION_CANCEL', 'FX_CONVERSION', 'REBALANCE', 'RESEARCH_OPPORTUNITY'],
    mayNever: ['WITHDRAW_EXTERNALLY', 'ADD_BENEFICIARY', 'CHANGE_KYC', 'CHANGE_RISK_MANDATE', 'READ_HEALTH_DATA_FOR_ADVERTISING'],
    maxPerProposal: usd(250000),
    proposalsPerDay: '5',
    approvalRequired: true,
  },
  actions: [
    { id: 'act_01JD8M2Q7S4V', kind: 'SAVINGS_SWEEP', state: 'PROPOSED', explanation: 'Checking is $3,240 above the $2,000 reserve you set. Moving $1,200 to Savings still leaves a month of bills covered.', amount: usd(120000), from: 'Checking ••98a6', to: 'Savings ••bf5b', confidence: 'HIGH', riskClass: 'LOW', createdAt: ago(9), expiresAt: ahead(60 * 24 * 2) },
    { id: 'act_01JD8M2Q7S4W', kind: 'SUBSCRIPTION_CANCEL', state: 'PROPOSED', explanation: 'StreamBox Premium has not been used in 74 days. Cancelling saves $15.99 a month ($191.88 a year).', amount: usd(1599), merchant: 'StreamBox Premium', lastUsedAt: ago(74 * 24 * 60), confidence: 'HIGH', riskClass: 'LOW', createdAt: ago(55) },
    { id: 'act_01JD8M2Q7S4X', kind: 'FX_CONVERSION', state: 'PROPOSED', explanation: 'Your €740 rent is due on the 14th. Converting $800 now on the cheapest permitted route costs $6.40 less than your bank’s rate.', amount: usd(80000), route: 'SEPA instant via Payments partner (sandbox)', saving: usd(640), confidence: 'MEDIUM', riskClass: 'LOW', createdAt: ago(130) },
    { id: 'act_01JD8M2Q7S4Y', kind: 'REBALANCE', state: 'PROPOSED', explanation: 'Technology has drifted to 41% of your paper portfolio, above the 35% band in your mandate. Trimming QQQ by 5 shares brings it back inside.', amount: usd(248350), instrument: 'QQQ', confidence: 'MEDIUM', riskClass: 'MODERATE', createdAt: ago(52) },
    { id: 'act_01JD8M2Q7S4Z', kind: 'RESEARCH_OPPORTUNITY', state: 'PROPOSED', explanation: 'Northwind Sleep Lab pays 40 SR for 30 days of anonymised sleep data. You already track sleep; nothing identifies you, and you can withdraw any time.', compensation: '40 SR', requiresConsent: true, confidence: 'MEDIUM', riskClass: 'LOW', createdAt: ago(300) },
    { id: 'act_01JD8M2Q7S50', kind: 'BILL_SWITCH', state: 'PROPOSED', explanation: 'Your internet plan renews on 2 Dec at $89/month. A comparable 500 Mbps plan in your area is $69/month.', amount: usd(2000), merchant: 'Home internet', saving: usd(24000), confidence: 'MEDIUM', riskClass: 'LOW', createdAt: ago(1440) },
    { id: 'act_01JD7ZK1B9C1', kind: 'WEEKLY_HARVEST', state: 'APPROVED', explanation: 'Swept 25% of last week’s realised, settled paper gains to Savings.', amount: usd(32880), riskClass: 'LOW', createdAt: ago(60 * 24 * 3) },
    { id: 'act_01JD7ZK1B9C2', kind: 'SUBSCRIPTION_CANCEL', state: 'REJECTED', explanation: 'Cancel CloudDrive 2 TB. You kept it: it holds your family photo backup.', amount: usd(999), riskClass: 'LOW', createdAt: ago(60 * 24 * 6) },
  ],
  escalations: [
    { kind: 'LARGE_TRANSFER_REVIEW', state: 'AWAITING_HUMAN_REVIEW', detail: 'A $4,800 transfer is above your agent limit; sent to you instead of being proposed.', createdAt: ago(60 * 26) },
    { kind: 'CONSENT_NEEDED', state: 'AWAITING_YOU', detail: 'The sleep study needs a new consent before the agent can enrol you.', createdAt: ago(300) },
  ],
};

// ---- Vault & HIN ----------------------------------------------------------

const vault = {
  consents: [
    { id: 'cns_northwind_sleep', requesterName: 'Northwind Sleep Lab', purpose: 'SLEEP_RESEARCH', dataCategories: ['WELLNESS', 'SLEEP'], identityExposure: 'ANONYMISED', compensation: '40 SR', aiTraining: false, resale: false, status: 'ACTIVE', revocable: true, grantedAt: ago(60 * 24 * 12), expiresAt: ahead(60 * 24 * 18) },
    { id: 'cns_sunrey_grow', requesterName: 'SunRey Grow', purpose: 'PERSONAL_FINANCIAL_PLANNING', dataCategories: ['FINANCIAL', 'GOALS'], identityExposure: 'IDENTIFIED', compensation: 'None (your own service)', aiTraining: false, resale: false, status: 'ACTIVE', revocable: true, grantedAt: ago(60 * 24 * 41), expiresAt: null },
    { id: 'cns_brightline_panel', requesterName: 'Brightline Retail Panel', purpose: 'CONSUMER_RESEARCH', dataCategories: ['CONSUMPTION', 'PURCHASE_INTENT'], identityExposure: 'PSEUDONYMOUS', compensation: '$12.00 per month', aiTraining: false, resale: false, status: 'ACTIVE', revocable: true, grantedAt: ago(60 * 24 * 20), expiresAt: ahead(60 * 24 * 70) },
    { id: 'cns_helix_cardio', requesterName: 'Helix Cardio Study', purpose: 'HEALTH_RESEARCH', dataCategories: ['HEALTH', 'WELLNESS'], identityExposure: 'ANONYMISED', compensation: '120 SR on completion', aiTraining: false, resale: false, status: 'PENDING', revocable: true, grantedAt: null, expiresAt: ahead(60 * 24 * 5) },
    { id: 'cns_atlas_mobility', requesterName: 'Atlas Mobility Insights', purpose: 'TRANSPORT_PLANNING', dataCategories: ['LIFESTYLE', 'LOCATION_SUMMARY'], identityExposure: 'AGGREGATED', compensation: '15 SR per quarter', aiTraining: true, resale: false, status: 'ACTIVE', revocable: true, grantedAt: ago(60 * 24 * 64), expiresAt: ahead(60 * 24 * 26) },
    { id: 'cns_tidewater_quote', requesterName: 'Tidewater Insurance', purpose: 'INSURANCE_QUOTE', dataCategories: ['IDENTITY', 'FINANCIAL'], identityExposure: 'IDENTIFIED', compensation: 'None', aiTraining: false, resale: false, status: 'REVOKED', revocable: false, grantedAt: ago(60 * 24 * 90), expiresAt: ago(60 * 24 * 60) },
  ],
  store: {
    region: 'EU cell, Frankfurt',
    encryption: 'Per-category envelope keys (simulated KMS)',
    totalRecords: '18,436',
    lastBackupAt: ago(95),
    onChain: 'Proofs and consent references only, never raw records',
    categories: [
      ['IDENTITY', '12', 'vault-identity', 1, 2],
      ['FINANCIAL', '9,812', 'vault-financial', 2, 1],
      ['HEALTH', '214', 'vault-health', 0, 4320],
      ['WELLNESS', '5,906', 'vault-wellness', 2, 30],
      ['CONSUMPTION', '1,744', 'vault-consumption', 1, 180],
      ['ENTERTAINMENT', '388', 'vault-entertainment', 0, 720],
      ['WORK', '46', 'vault-work', 0, 10080],
      ['LIFESTYLE', '161', 'vault-lifestyle', 1, 1440],
      ['GOALS', '7', 'vault-goals', 1, 4300],
      ['PREFERENCES', '93', 'vault-preferences', 0, 2880],
      ['PURCHASE_INTENT', '53', 'vault-intent', 1, 360],
    ].map(([category, records, keyDomain, consents, minutes]) => ({ category, records, keyDomain, sharedUnder: consents === 0 ? 'Not shared' : `${consents} consent${consents === 1 ? '' : 's'}`, lastUpdatedAt: ago(minutes) })),
  },
  hin: {
    verifiedContributions: '14',
    pendingVerification: '2',
    activeStudies: '2',
    earnedSr: String(186n * UNIT + 500000n),
    earnedUsd: usd(4800),
    lastContributionAt: ago(60 * 20),
    identityExposure: 'Never identified to buyers',
  },
  sources: [
    { sourceId: 'src_open_banking', name: 'Bank accounts', kind: 'OPEN_BANKING', dataCategories: ['FINANCIAL'], method: 'OAuth API', exampleApis: 'Plaid, TrueLayer, Tink', state: 'CONNECTED', connectedAt: ago(60 * 24 * 40), lastSyncAt: ago(14), records: '6,920' },
    { sourceId: 'src_sunrey_cards', name: 'SunRey card and payments', kind: 'FIRST_PARTY', dataCategories: ['FINANCIAL', 'CONSUMPTION'], method: 'Native', exampleApis: 'SunRey ledger', state: 'CONNECTED', connectedAt: ago(60 * 24 * 41), lastSyncAt: ago(1), records: '2,892' },
    { sourceId: 'src_payroll', name: 'Payroll and income', kind: 'PAYROLL', dataCategories: ['FINANCIAL', 'WORK'], method: 'OAuth API', exampleApis: 'Argyle, Pinwheel', state: 'CONNECTED', connectedAt: ago(60 * 24 * 33), lastSyncAt: ago(60 * 24 * 2), records: '46' },
    { sourceId: 'src_wearable', name: 'Wearable: sleep and activity', kind: 'WEARABLE', dataCategories: ['WELLNESS', 'SLEEP'], method: 'OAuth API', exampleApis: 'Oura, Fitbit, Garmin Health', state: 'CONNECTED', connectedAt: ago(60 * 24 * 25), lastSyncAt: ago(30), records: '5,630' },
    { sourceId: 'src_phone_health', name: 'Phone health data', kind: 'DEVICE_SDK', dataCategories: ['HEALTH', 'WELLNESS'], method: 'On-device SDK', exampleApis: 'Apple HealthKit, Android Health Connect', state: 'CONNECTED', connectedAt: ago(60 * 24 * 18), lastSyncAt: ago(90), records: '490' },
    { sourceId: 'src_medical_records', name: 'Medical records', kind: 'FHIR', dataCategories: ['HEALTH'], method: 'FHIR API', exampleApis: 'Epic, Cerner (via SMART on FHIR)', state: 'AVAILABLE' },
    { sourceId: 'src_fitness', name: 'Fitness apps', kind: 'FITNESS', dataCategories: ['WELLNESS'], method: 'OAuth API', exampleApis: 'Strava, Peloton', state: 'AVAILABLE' },
    { sourceId: 'src_music', name: 'Music and streaming', kind: 'MEDIA', dataCategories: ['ENTERTAINMENT', 'PREFERENCES'], method: 'OAuth API', exampleApis: 'Spotify Web API, YouTube Data API', state: 'AVAILABLE' },
    { sourceId: 'src_travel', name: 'Rides and travel', kind: 'MOBILITY', dataCategories: ['LIFESTYLE'], method: 'OAuth API', exampleApis: 'Uber, airline loyalty programs', state: 'AVAILABLE' },
    { sourceId: 'src_shopping', name: 'Online orders', kind: 'COMMERCE', dataCategories: ['CONSUMPTION', 'PURCHASE_INTENT'], method: 'Email receipts or file import', exampleApis: 'Order-history export, Gmail API', state: 'AVAILABLE' },
    { sourceId: 'src_utilities', name: 'Utilities and telecom', kind: 'UTILITIES', dataCategories: ['FINANCIAL', 'LIFESTYLE'], method: 'OAuth API', exampleApis: 'Arcadia, Green Button', state: 'AVAILABLE' },
    { sourceId: 'src_credit', name: 'Credit report', kind: 'CREDIT_BUREAU', dataCategories: ['FINANCIAL'], method: 'Bureau API (licensed partner)', exampleApis: 'Experian, Equifax, TransUnion', state: 'AVAILABLE' },
    { sourceId: 'src_professional', name: 'Professional profile', kind: 'PROFESSIONAL', dataCategories: ['WORK'], method: 'OAuth API', exampleApis: 'LinkedIn, GitHub', state: 'AVAILABLE' },
    { sourceId: 'src_smart_home', name: 'Smart home energy', kind: 'ENERGY', dataCategories: ['LIFESTYLE'], method: 'OAuth API', exampleApis: 'Smart meter and thermostat APIs', state: 'AVAILABLE' },
  ],
  access: [
    ['SunRey Grow', 'PERSONAL_FINANCIAL_PLANNING', ['FINANCIAL'], 'ALLOWED', 9],
    ['Northwind Sleep Lab (clean room)', 'SLEEP_RESEARCH', ['SLEEP'], 'ALLOWED', 180],
    ['Brightline Retail Panel', 'CONSUMER_RESEARCH', ['CONSUMPTION'], 'ALLOWED', 600],
    ['Ad network request', 'ADVERTISING', ['HEALTH'], 'DENIED_BY_PURPOSE_FIREWALL', 1300],
    ['Financial Agent', 'PROPOSAL_GENERATION', ['FINANCIAL', 'GOALS'], 'ALLOWED', 1450],
    ['Atlas Mobility Insights', 'TRANSPORT_PLANNING', ['LOCATION_SUMMARY'], 'ALLOWED', 2900],
    ['Tidewater Insurance', 'INSURANCE_QUOTE', ['FINANCIAL'], 'DENIED_CONSENT_REVOKED', 5000],
  ].map(([requester, purpose, dataCategories, outcome, minutes], i) => ({ id: `acc_${String(9000 + i)}`, requester, purpose, dataCategories, outcome, occurredAt: ago(minutes) })),
};

// ---- Router -----------------------------------------------------------------

const clone = (v) => JSON.parse(JSON.stringify(v));
const marketOr404 = (id) => MARKETS[id] || null;

/** Returns demo data for a request, or undefined when the path is not demo-served. */
export function demoResponse(method, rawPath, body) {
  const path = rawPath.split('?')[0];
  const seg = path.split('/').filter(Boolean);

  if (method === 'GET') {
    switch (path) {
      case '/exchange/markets': return { items: MARKET_DEFS.map((d) => clone(MARKETS[d.marketId].summary)) };
      case '/exchange/portfolio': return { items: clone(exchange.portfolio) };
      case '/exchange/orders': return { items: clone(exchange.orders) };
      case '/exchange/fills': return { items: clone(exchange.fills) };
      case '/exchange/transactions': return { items: clone(exchange.transactions) };
      case '/wallets': return { items: clone(wallets.list), productionSigningAuthorized: false, productionMoneyMovement: false };
      case '/wallets/SRC': return { assetId: 'SUNREY_COIN', balance: { available: wallets.balances.SRC }, network: 'SUNREY_TESTNET' };
      case '/wallets/MRC': return { assetId: 'MOONREY_COIN', balance: { available: wallets.balances.MRC }, network: 'SUNREY_TESTNET' };
      case '/wallets/transactions': return { items: clone(wallets.tx) };
      case '/chain/status': return clone(chain);
      case '/economy/sunrey-coin': return registry('SunRey Coin', 'SR', 'Set by the SunRey monetary constitution; production issuance not active');
      case '/economy/moonrey-coin': return registry('MoonRey Coin', 'MR', 'Set by the SunRey monetary constitution; production issuance not active');
      case '/grow/overview': return clone(helios.overview);
      case '/grow/agent-state': return clone(helios.agentState);
      case '/grow/active-capital': return clone(helios.capital);
      case '/grow/strategies': return { items: clone(helios.strategies) };
      case '/grow/positions': return { items: clone(helios.positions) };
      case '/grow/results': return clone(helios.results);
      case '/grow/activity': return { items: clone(helios.activity) };
      case '/grow/plan': return clone(helios.plan);
      case '/grow/controls/status': return clone(helios.controls);
      case '/grow/opportunities': return { items: clone(helios.opportunities), generatedAt: ago(30) };
      case '/agent': return clone(agent.status);
      case '/agent/actions': return { items: clone(agent.actions) };
      case '/agent/settings': return clone(agent.settings);
      case '/agent/escalations': return { items: clone(agent.escalations) };
      case '/data/consents': return { items: clone(vault.consents) };
      case '/data/vault': return clone(vault.store);
      case '/hin/me/summary': return clone(vault.hin);
      case '/data/vault/sources': return { items: clone(vault.sources) };
      case '/data/access-history': return { items: clone(vault.access) };
      default: break;
    }
    if (seg[0] === 'exchange' && seg[1] === 'markets' && seg[2]) {
      const m = marketOr404(decodeURIComponent(seg[2]));
      if (!m) return undefined;
      if (seg.length === 3) return clone(m.detail);
      if (seg[3] === 'order-book') return clone(m.book);
      if (seg[3] === 'candles') return clone(m.candles);
      if (seg[3] === 'trades') return clone(m.trades);
    }
    return undefined;
  }

  // Writes: acknowledged locally, never sent.
  if (path === '/exchange/quotes') {
    const m = marketOr404(body && body.marketId);
    if (!m) return undefined;
    const side = body.side === 'SELL' ? 'SELL' : 'BUY';
    return { quoteId: `qt_demo_${Date.now().toString(16)}`, price: side === 'BUY' ? m.detail.bestAsk : m.detail.bestBid, fee: '0.10% (illustrative)', expiresAt: iso(Date.now() + 30000) };
  }
  if (path === '/exchange/orders') {
    const m = marketOr404(body && body.marketId);
    if (!m) return undefined;
    const order = { orderId: `xord_demo_${Date.now().toString(16)}`, marketId: body.marketId, side: body.side, quantity: String(body.quantity), remaining: '0', averagePrice: body.side === 'SELL' ? m.detail.bestBid : m.detail.bestAsk, status: 'FILLED', settlementIds: [`stl_demo_${Date.now().toString(16).slice(-6)}`], createdAt: iso(Date.now()) };
    exchange.orders.unshift(order);
    exchange.fills.unshift({ tradeId: `trd_demo_${Date.now().toString(16)}`, quantity: order.quantity, priceUnits: order.averagePrice, executedAt: order.createdAt });
    return clone(order);
  }
  if (seg[0] === 'exchange' && seg[1] === 'orders' && seg[3] === 'cancel') {
    const o = exchange.orders.find((x) => x.orderId === decodeURIComponent(seg[2]));
    if (o) o.status = 'CANCELLED';
    return { orderId: seg[2], status: 'CANCELLED' };
  }
  if (path === '/exchange/fund') {
    const sr = exchange.portfolio[0];
    const add = 1000n * UNIT;
    sr.available = String(BigInt(sr.available) + add);
    sr.finalized = String(BigInt(sr.finalized) + add);
    return { assetId: 'SUNREY_COIN', quantity: String(add) };
  }
  if (path === '/wallets' || path === '/wallets/deposits/simulate') return { status: 'ACCEPTED' };
  if (seg[0] === 'agent' && seg[1] === 'actions' && (seg[3] === 'approve' || seg[3] === 'reject')) {
    const a = agent.actions.find((x) => x.id === decodeURIComponent(seg[2]));
    if (a) a.state = seg[3] === 'approve' ? 'APPROVED' : 'REJECTED';
    return { id: seg[2], state: a ? a.state : 'UNKNOWN' };
  }
  if (path === '/agent/pause' || path === '/agent/revoke') return { status: 'ACCEPTED' };
  if (seg[0] === 'data' && seg[1] === 'consents' && seg[3] === 'revoke') {
    const c = vault.consents.find((x) => x.id === decodeURIComponent(seg[2]));
    if (c) c.status = 'REVOKED';
    return { id: seg[2], status: 'REVOKED' };
  }
  if (seg[0] === 'data' && seg[1] === 'vault' && seg[2] === 'sources' && seg[4] === 'connect') {
    const s = vault.sources.find((x) => x.sourceId === decodeURIComponent(seg[3]));
    if (s) Object.assign(s, { state: 'CONNECTED', connectedAt: iso(Date.now()), lastSyncAt: iso(Date.now()), records: '0' });
    return { sourceId: seg[3], state: 'CONNECTED' };
  }
  return undefined;
}
