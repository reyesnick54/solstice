/**
 * ACCESS Wave 3 — in-memory transaction context store with optimistic versioning.
 */

import type { AccessDomainTransactionStatus } from '../domain/taxonomy.ts';
import type { AccessTransactionContext } from './types.ts';
import { assertAccessTransactionTransition } from './state-machine.ts';

export class AccessTransactionStore {
  private readonly contexts = new Map<string, AccessTransactionContext>();
  private readonly locks = new Map<string, Promise<void>>();

  async withLock<T>(transactionId: string, fn: () => T | Promise<T>): Promise<T> {
    const previous = this.locks.get(transactionId) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const next = previous.then(() => gate);
    this.locks.set(transactionId, next);
    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  get(transactionId: string): AccessTransactionContext | null {
    return this.contexts.get(transactionId) ?? null;
  }

  listAll(): readonly AccessTransactionContext[] {
    return Object.freeze([...this.contexts.values()]);
  }

  async save(
    context: AccessTransactionContext,
    expectedVersion?: number,
  ): Promise<{ readonly ok: true; readonly context: AccessTransactionContext } | { readonly ok: false; readonly code: 'VERSION_CONFLICT' }> {
    return this.withLock(context.transactionId, () => {
      const current = this.contexts.get(context.transactionId);
      if (expectedVersion !== undefined && current && current.version !== expectedVersion) {
        return { ok: false, code: 'VERSION_CONFLICT' };
      }
      this.contexts.set(context.transactionId, context);
      return { ok: true, context };
    });
  }

  async transition(
    transactionId: string,
    nextStatus: AccessDomainTransactionStatus,
    patch: Partial<AccessTransactionContext> & { readonly updatedAt: string },
  ): Promise<
    | { readonly ok: true; readonly context: AccessTransactionContext }
    | { readonly ok: false; readonly code: 'NOT_FOUND' | 'ILLEGAL_TRANSITION' | 'VERSION_CONFLICT' }
  > {
    return this.withLock(transactionId, () => {
      const current = this.contexts.get(transactionId);
      if (!current) {
        return { ok: false, code: 'NOT_FOUND' };
      }
      if (!assertAccessTransactionTransitionSafe(current.status, nextStatus)) {
        return { ok: false, code: 'ILLEGAL_TRANSITION' };
      }
      const updated: AccessTransactionContext = Object.freeze({
        ...current,
        ...patch,
        status: nextStatus,
        version: current.version + 1,
      });
      this.contexts.set(transactionId, updated);
      return { ok: true, context: updated };
    });
  }
}

function assertAccessTransactionTransitionSafe(from: AccessDomainTransactionStatus, to: AccessDomainTransactionStatus): boolean {
  try {
    assertAccessTransactionTransition(from, to);
    return true;
  } catch {
    return false;
  }
}
