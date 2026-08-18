import { asUtcInstant } from '../../domain/src/time.ts';
import { ConsumerExchangeEngine, runConsumerExchangeCommand } from './consumer/index.ts';

const NOW = asUtcInstant('2026-08-18T14:00:00.000Z');
const engine = new ConsumerExchangeEngine({ now: NOW });
engine.registerConsumer({ participantId: 'alice' });
engine.seedLiquidity({
  participantId: 'maker',
  side: 'SELL',
  quantity: 10n,
  priceUnits: 2_500_000n,
  now: NOW,
});
const market = runConsumerExchangeCommand(engine, ['consumer-market'], NOW);
const recon = engine.reconcile();
const activation = engine.productionActivation();
if (!market.ok || recon.balancingEntries !== false || activation.consumerTradingAvailable !== false) {
  throw new Error('consumer demo invariants failed');
}
console.log('consumer-exchange-demo-ok');
