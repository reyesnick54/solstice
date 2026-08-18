import { SUNREY_MOONREY_MARKET_ID } from '../ids.ts';
import type { MarketOperationsEngine } from './engine.ts';

export type MarketOpsCliResult = {
  readonly ok: boolean;
  readonly command: string;
  readonly payload: unknown;
};

export const MARKET_OPS_COMMANDS = [
  'markets',
  'market-state',
  'sessions',
  'market-data',
  'liquidity',
  'risk',
  'circuit-breakers',
  'auction',
  'reconciliation',
  'replay',
] as const;

export function marketOpsUsage(): string {
  return [
    'sunrey-exchange markets',
    'sunrey-exchange market-state [marketId]',
    'sunrey-exchange sessions',
    'sunrey-exchange market-data [marketId]',
    'sunrey-exchange liquidity [marketId]',
    'sunrey-exchange risk',
    'sunrey-exchange circuit-breakers',
    'sunrey-exchange auction',
    'sunrey-exchange reconciliation',
    'sunrey-exchange replay',
  ].join('\n');
}

export function runMarketOpsCommand(engine: MarketOperationsEngine, args: readonly string[]): MarketOpsCliResult {
  const command = args[0];
  if (!command || !(MARKET_OPS_COMMANDS as readonly string[]).includes(command)) {
    return { ok: false, command: command ?? 'missing', payload: { error: 'unknown market-ops command', usage: marketOpsUsage() } };
  }
  const marketId = args[1] ?? SUNREY_MOONREY_MARKET_ID;
  switch (command) {
    case 'markets':
      return {
        ok: true,
        command,
        payload: {
          families: ['DIGITAL_ASSET', 'HUMAN_INFORMATION_RIGHT', 'INTELLIGENCE_COMPUTE', 'PRODUCTIVE_CAPACITY'],
          focus: 'DIGITAL_ASSET',
          native: engine.policy.nativeMarket,
          state: engine.marketState().state,
        },
      };
    case 'market-state':
      return { ok: true, command, payload: engine.marketState(marketId) };
    case 'sessions':
      return {
        ok: true,
        command,
        payload: {
          market: [...engine.sessions.values()],
          trading: [...engine.gateway.sessions.values()].map((session) => ({
            sessionId: session.sessionId,
            participantId: session.participantId,
            inboundSeq: session.inboundSeq.toString(),
            authenticated: session.authenticated,
            cancelOnDisconnect: session.cancelOnDisconnect,
          })),
        },
      };
    case 'market-data':
      return {
        ok: true,
        command,
        payload: engine.marketData.publicView(engine.snapshot('DEPTH'), 'PUBLIC_DELAYED'),
      };
    case 'liquidity':
      return { ok: true, command, payload: engine.liquidity() };
    case 'risk':
      return {
        ok: true,
        command,
        payload: {
          collarsBps: engine.policy.priceCollarBps.toString(),
          protectionBps: engine.policy.protectionCollarBps.toString(),
          settlementQueueLimit: engine.policy.settlementQueueLimit.toString(),
          killSwitches: engine.killSwitches,
        },
      };
    case 'circuit-breakers':
      return { ok: true, command, payload: engine.evaluateVolatility() };
    case 'auction':
      return { ok: true, command, payload: engine.auction };
    case 'reconciliation':
      return { ok: true, command, payload: engine.reconcile() };
    case 'replay':
      return { ok: true, command, payload: engine.replaySession() };
    default:
      return { ok: false, command, payload: { usage: marketOpsUsage() } };
  }
}
