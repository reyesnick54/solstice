/**
 * Portfolio event lifecycle (position + cash deltas) for deterministic simulation.
 */

import type { BytexPortfolioEventKind } from './taxonomy.ts';
import type { BytexPortfolioEvent } from './types.ts';

export class BytexPortfolioLedger {
  private cashMinor = 0n;
  private readonly positions = new Map<string, bigint>();
  private sequence = 0;
  private readonly events: BytexPortfolioEvent[] = [];

  restore(input: { readonly cashMinor: bigint; readonly positions: Readonly<Record<string, bigint>>; readonly fromSequence: number }): void {
    this.cashMinor = input.cashMinor;
    this.positions.clear();
    this.events.length = 0;
    this.sequence = input.fromSequence;
    for (const [instrumentId, qty] of Object.entries(input.positions)) {
      this.positions.set(instrumentId, qty);
    }
  }

  eventsLog(): readonly BytexPortfolioEvent[] {
    return Object.freeze([...this.events]);
  }

  snapshot(): { readonly cashMinor: bigint; readonly positions: Readonly<Record<string, bigint>> } {
    return Object.freeze({
      cashMinor: this.cashMinor,
      positions: Object.freeze(Object.fromEntries(this.positions)),
    });
  }

  applyFill(input: {
    readonly atNs: bigint;
    readonly instrumentId: string;
    readonly side: 'BUY' | 'SELL';
    readonly quantityMinor: bigint;
    readonly priceMinor: bigint;
    readonly feeMinor: bigint;
  }): void {
    const signedQty = input.side === 'BUY' ? input.quantityMinor : -input.quantityMinor;
    const notional = input.priceMinor * input.quantityMinor;
    const cashDelta = input.side === 'BUY' ? -(notional + input.feeMinor) : notional - input.feeMinor;
    const prev = this.positions.get(input.instrumentId) ?? 0n;
    const next = prev + signedQty;
    if (prev === 0n && next !== 0n) {
      this.push('POSITION_OPENED', input.atNs, input.instrumentId, next, cashDelta);
    } else if (next === 0n) {
      this.push('POSITION_CLOSED', input.atNs, input.instrumentId, 0n, cashDelta);
    } else {
      this.push('POSITION_CHANGED', input.atNs, input.instrumentId, next, cashDelta);
    }
    this.positions.set(input.instrumentId, next);
    this.cashMinor += cashDelta;
    this.push('ACCOUNT_BALANCE_CHANGED', input.atNs, input.instrumentId, next, cashDelta);
  }

  private push(kind: BytexPortfolioEventKind, atNs: bigint, instrumentId: string, quantityMinor: bigint, cashDeltaMinor: bigint): void {
    this.sequence += 1;
    this.events.push(
      Object.freeze({
        sequence: this.sequence,
        atNs,
        kind,
        instrumentId,
        quantityMinor,
        cashDeltaMinor,
      }),
    );
  }
}
