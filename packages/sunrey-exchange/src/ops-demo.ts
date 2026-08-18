import { asUtcInstant } from '../../domain/src/time.ts';
import { SUNREY_MOONREY_MARKET_ID } from './ids.ts';
import { MarketOperationsEngine, runMarketOpsCommand } from './ops/index.ts';

const NOW = asUtcInstant('2026-08-18T13:00:00.000Z');
const ops = new MarketOperationsEngine({ now: NOW });
const alice = ops.registerParticipant({ participantId: 'alice' });
const bob = ops.registerParticipant({ participantId: 'bob' });
const aliceSession = ops.openTradingSession(alice.credential, NOW);
const bobSession = ops.openTradingSession(bob.credential, NOW);
ops.enterOrder(
  bobSession.sessionId,
  1n,
  {
    clOrdId: 'demo-s',
    marketId: SUNREY_MOONREY_MARKET_ID,
    side: 'SELL',
    orderType: 'LIMIT',
    quantity: 8n,
    priceUnits: 2_500_000n,
  },
  NOW,
);
ops.enterOrder(
  aliceSession.sessionId,
  1n,
  {
    clOrdId: 'demo-b',
    marketId: SUNREY_MOONREY_MARKET_ID,
    side: 'BUY',
    orderType: 'LIMIT',
    quantity: 8n,
    priceUnits: 2_500_000n,
  },
  NOW,
);
const markets = runMarketOpsCommand(ops, ['markets']);
const recon = ops.reconcile();
const activation = ops.productionActivation();
if (!markets.ok || recon.balancingEntries !== false || activation.productionActivated !== false) {
  throw new Error('ops demo failed');
}
console.log('SunRey Exchange market operations demo: ok');
console.log(`  state ${ops.marketState().state} trades=${ops.trades.length} licensed=${activation.productionActivated}`);
