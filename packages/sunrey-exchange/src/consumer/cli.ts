import { SUNREY_MOONREY_MARKET_ID } from '../ids.ts';
import type { ConsumerExchangeEngine } from './engine.ts';

export const CONSUMER_COMMANDS = [
  'consumer-market',
  'consumer-portfolio',
  'consumer-quote',
  'consumer-reconciliation',
  'consumer-report',
] as const;

export function consumerExchangeUsage(): string {
  return [
    'sunrey-exchange consumer-market',
    'sunrey-exchange consumer-portfolio <participantId>',
    'sunrey-exchange consumer-quote <participantId> <side> <quantity>',
    'sunrey-exchange consumer-reconciliation',
    'sunrey-exchange consumer-report',
  ].join('\n');
}

export function runConsumerExchangeCommand(
  engine: ConsumerExchangeEngine,
  args: readonly string[],
  now: Parameters<ConsumerExchangeEngine['getConsumerMarket']>[0],
): { readonly ok: boolean; readonly command: string; readonly payload: unknown } {
  const command = args[0];
  if (!command || !(CONSUMER_COMMANDS as readonly string[]).includes(command)) {
    return { ok: false, command: command ?? 'missing', payload: { error: 'unknown consumer command', usage: consumerExchangeUsage() } };
  }
  switch (command) {
    case 'consumer-market':
      return { ok: true, command, payload: engine.getConsumerMarket(now) };
    case 'consumer-portfolio':
      return {
        ok: true,
        command,
        payload: engine.getConsumerPortfolio({
          participantId: args[1] ?? 'alice',
          authenticated: true,
          now,
        }),
      };
    case 'consumer-quote':
      return {
        ok: true,
        command,
        payload: engine.getConsumerQuote({
          participantId: args[1] ?? 'alice',
          side: args[2] === 'SELL' ? 'SELL' : 'BUY',
          quantity: BigInt(args[3] ?? '1'),
          now,
        }),
      };
    case 'consumer-reconciliation':
      return { ok: true, command, payload: engine.reconcile() };
    case 'consumer-report':
      return { ok: true, command, payload: { ...engine.report(), marketId: SUNREY_MOONREY_MARKET_ID } };
    default:
      return { ok: false, command, payload: { error: 'unknown consumer command' } };
  }
}
