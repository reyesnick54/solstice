import { CANONICAL_MARKET_FAMILIES } from './taxonomy.ts';
import { ContractTemplateRegistry } from './templates.ts';
import type { UniversalExchangeEngine } from './universal.ts';
import type { SunReyExchangeService } from './service.ts';

export type ExchangeCliResult = {
  readonly ok: boolean;
  readonly command: string;
  readonly payload: unknown;
};

const COMMANDS = [
  'markets',
  'instruments',
  'orderbook',
  'auctions',
  'contracts',
  'delivery',
  'settlement',
  'rights',
  'capacity',
  'compute',
  'marketdata',
  'disputes',
  'templates',
] as const;

export function exchangeUsage(): string {
  return [
    'sunrey-exchange markets',
    'sunrey-exchange instruments [family]',
    'sunrey-exchange orderbook <marketId>',
    'sunrey-exchange auctions',
    'sunrey-exchange contracts',
    'sunrey-exchange delivery <contractId>',
    'sunrey-exchange settlement <contractId>',
    'sunrey-exchange rights',
    'sunrey-exchange capacity',
    'sunrey-exchange compute',
    'sunrey-exchange marketdata <marketId>',
    'sunrey-exchange disputes',
    'sunrey-exchange templates',
  ].join('\n');
}

export function runExchangeCommand(
  exchange: SunReyExchangeService,
  args: readonly string[],
): ExchangeCliResult {
  const command = args[0];
  if (!command || !(COMMANDS as readonly string[]).includes(command)) {
    return { ok: false, command: command ?? 'missing', payload: { error: 'unknown exchange command', usage: exchangeUsage() } };
  }
  const engine: UniversalExchangeEngine = exchange.universal;
  switch (command) {
    case 'markets':
      return {
        ok: true,
        command,
        payload: {
          families: CANONICAL_MARKET_FAMILIES,
          markets: exchange.markets().map((market) => ({
            marketId: market.marketId,
            family: market.family,
            state: market.state,
          })),
        },
      };
    case 'instruments':
      return {
        ok: true,
        command,
        payload: engine.instruments.list(args[1] as never).map((row) => ({
          instrumentId: row.instrumentId,
          family: row.marketFamily,
          status: row.status,
          unit: row.unit,
        })),
      };
    case 'orderbook':
      return {
        ok: true,
        command,
        payload: args[1] ? exchange.replayBook(args[1] as never) : { error: 'marketId required' },
      };
    case 'auctions':
      return { ok: true, command, payload: exchange.auctions() };
    case 'contracts':
      return { ok: true, command, payload: exchange.contracts() };
    case 'delivery':
      return {
        ok: true,
        command,
        payload: engine.latestComputeContract() ?? engine.latestCapacityContract() ?? { error: 'no delivery' },
      };
    case 'settlement':
      return {
        ok: true,
        command,
        payload: {
          compute: engine.latestComputeContract(),
          capacity: engine.latestCapacityContract(),
          information: engine.latestInformationContract(),
        },
      };
    case 'rights':
      return {
        ok: true,
        command,
        payload: engine.instruments.list('HUMAN_INFORMATION_RIGHT'),
      };
    case 'capacity':
      return { ok: true, command, payload: engine.latestCapacityContract() ?? exchange.auctions() };
    case 'compute':
      return { ok: true, command, payload: engine.latestComputeContract() ?? engine.instruments.list('INTELLIGENCE_COMPUTE') };
    case 'marketdata':
      return {
        ok: true,
        command,
        payload: args[1]
          ? (engine.familyData(args[1] as never) ?? exchange.marketData(args[1] as never))
          : { error: 'marketId required' },
      };
    case 'disputes':
      return { ok: true, command, payload: exchange.exchangeDisputes() };
    case 'templates':
      return { ok: true, command, payload: ContractTemplateRegistry.all() };
    default:
      return { ok: false, command, payload: { usage: exchangeUsage() } };
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(exchangeUsage());
}
