import { sha256Hex } from '@solstice/kernel';
import { ChainReference, PERMITTED_CHAIN_REFERENCE_KINDS } from './reference.ts';

export type SimulatedTxStatus = 'SUBMITTED' | 'CONFIRMED';

export type SimulatedTx = {
  readonly txId: string;
  readonly status: SimulatedTxStatus;
  readonly reference: ChainReference;
  readonly submittedAt: string;
  readonly confirmedAt?: string;
};

export interface ChainGateway {
  submit(reference: ChainReference): SimulatedTx;
  confirm(txId: string): SimulatedTx;
  query(txId: string): SimulatedTx | undefined;
  list(): readonly SimulatedTx[];
}

/**
 * In-memory simulated chain. No RPC, no node, no wallet provider.
 * LIVE_CRYPTO_ENABLED stays false; this class never opens a socket.
 */
export class SimulatedChain implements ChainGateway {
  readonly #txs = new Map<string, SimulatedTx>();
  #seq = 0;

  submit(reference: ChainReference): SimulatedTx {
    if (!(reference instanceof ChainReference)) {
      throw new TypeError(
        'ChainGateway.submit accepts only a ChainReference constructed by its factories',
      );
    }
    if (
      !(PERMITTED_CHAIN_REFERENCE_KINDS as readonly string[]).includes(reference.kind)
    ) {
      throw new TypeError(`non-permitted chain reference kind: ${String(reference.kind)}`);
    }
    this.#seq += 1;
    const txId = `simtx_${this.#seq.toString().padStart(8, '0')}_${sha256Hex(reference.value).slice(0, 12)}`;
    const tx: SimulatedTx = Object.freeze({
      txId,
      status: 'SUBMITTED',
      reference,
      submittedAt: '2026-08-14T00:00:00.000Z',
    });
    this.#txs.set(txId, tx);
    return tx;
  }

  confirm(txId: string): SimulatedTx {
    const current = this.#txs.get(txId);
    if (!current) {
      throw new Error(`unknown simulated tx ${txId}`);
    }
    const next: SimulatedTx = Object.freeze({
      ...current,
      status: 'CONFIRMED',
      confirmedAt: '2026-08-14T00:00:01.000Z',
    });
    this.#txs.set(txId, next);
    return next;
  }

  query(txId: string): SimulatedTx | undefined {
    return this.#txs.get(txId);
  }

  list(): readonly SimulatedTx[] {
    return [...this.#txs.values()];
  }
}
