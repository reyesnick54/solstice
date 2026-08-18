/**
 * Ordered wallet event stream with explicit gap detection.
 */

import { createHash } from 'node:crypto';

import { MOBILE_SYNC_API_VERSION, MOBILE_SYNC_SCHEMA_VERSION, type WalletEventEnvelope, type WalletEventKind, type WalletEventStream } from './types.ts';

export class WalletEventLog {
  private readonly events: WalletEventEnvelope[] = [];
  private sequence = 0;

  append(input: {
    readonly kind: WalletEventKind;
    readonly walletId: string;
    readonly networkId: string;
    readonly chainId: string;
    readonly finalizedHeight: number | null;
    readonly occurredAtUtc: string;
    readonly payload: Readonly<Record<string, unknown>>;
  }): WalletEventEnvelope {
    this.sequence += 1;
    const eventId = createHash('sha256')
      .update(`${input.walletId}|${this.sequence}|${input.kind}|${input.occurredAtUtc}`)
      .digest('hex')
      .slice(0, 24);
    const envelope: WalletEventEnvelope = Object.freeze({
      schemaVersion: MOBILE_SYNC_SCHEMA_VERSION,
      apiVersion: MOBILE_SYNC_API_VERSION,
      eventId,
      sequence: this.sequence,
      kind: input.kind,
      walletId: input.walletId,
      networkId: input.networkId,
      chainId: input.chainId,
      finalizedHeight: input.finalizedHeight,
      occurredAtUtc: input.occurredAtUtc,
      payload: Object.freeze({ ...input.payload }),
    });
    this.events.push(envelope);
    return envelope;
  }

  headSequence(): number {
    return this.sequence;
  }

  stream(walletId: string, fromSequence: number): WalletEventStream {
    const matching = this.events.filter((event) => event.walletId === walletId && event.sequence > fromSequence);
    const last = matching[matching.length - 1];
    const expectedEnd = last?.sequence ?? fromSequence;
    const expected = [];
    for (let sequence = fromSequence + 1; sequence <= expectedEnd; sequence += 1) {
      expected.push(sequence);
    }
    const missing = expected.filter((sequence) => !matching.some((event) => event.sequence === sequence));
    return Object.freeze({
      walletId,
      fromSequence,
      toSequence: last?.sequence ?? fromSequence,
      events: Object.freeze([...matching]),
      gapDetected: missing.length > 0,
      missingSequences: Object.freeze(missing),
    });
  }

  detectGap(walletId: string, expectedNext: number): boolean {
    const matching = this.events.filter((event) => event.walletId === walletId && event.sequence >= expectedNext);
    if (matching.length === 0) {
      return false;
    }
    return matching[0]!.sequence !== expectedNext;
  }

  simulateGap(walletId: string, dropSequence: number): void {
    const index = this.events.findIndex((event) => event.walletId === walletId && event.sequence === dropSequence);
    if (index >= 0) {
      this.events.splice(index, 1);
    }
  }
}
