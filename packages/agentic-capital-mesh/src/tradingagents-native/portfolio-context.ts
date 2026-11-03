/**
 * Portfolio context packaging (native port of TradingAgents portfolio.py).
 * Distinguishes: held position, flat book, and absent context (never invent flat).
 */

import { createHash } from 'node:crypto';

import { normalizeSymbol } from '../../../external-data/src/tradingagents-native/symbols.ts';

export type PortfolioPosition = {
  readonly ticker: string;
  readonly quantity: number;
  readonly averagePrice?: number | null;
};

export type PortfolioContext = {
  readonly cash?: number | null;
  readonly currency?: string | null;
  readonly positions: readonly PortfolioPosition[];
};

export type PortfolioContextState = PortfolioContext | 'ABSENT';

export function positionsIn(context: PortfolioContext, ticker: string): readonly PortfolioPosition[] {
  const symbol = normalizeSymbol(ticker);
  return Object.freeze(
    context.positions.filter((p) => normalizeSymbol(p.ticker) === symbol),
  );
}

export function renderPortfolioBlock(context: PortfolioContextState, ticker: string): string | null {
  if (context === 'ABSENT') return null;
  const symbol = normalizeSymbol(ticker);
  const held = positionsIn(context, ticker);
  const lines: string[] = [];
  for (const position of held) {
    const price =
      position.averagePrice != null ? `, average price ${position.averagePrice.toLocaleString('en-US')}` : '';
    const spelled = position.ticker.trim().toUpperCase();
    const listed = spelled !== symbol ? ` (listed as ${position.ticker})` : '';
    lines.push(`- Current position in ${symbol}: ${position.quantity} units${price}${listed}`);
  }
  if (held.length === 0) {
    lines.push(`- No current position in ${symbol}`);
  }
  if (context.cash != null) {
    lines.push(`- Cash available: ${context.cash.toLocaleString('en-US')}${context.currency ? ` ${context.currency}` : ''}`);
  }
  const others = context.positions.filter((p) => !held.includes(p));
  if (others.length > 0) {
    lines.push(
      `- Other positions: ${others.map((p) => `${p.ticker.toUpperCase()} ${p.quantity}`).join(', ')}`,
    );
  }
  return `Portfolio at the analysis date:\n${lines.join('\n')}`;
}

export function portfolioFingerprint(context: PortfolioContext): string {
  const json = JSON.stringify(context);
  return createHash('sha256').update(json).digest('hex').slice(0, 12);
}
