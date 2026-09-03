/**
 * ACCESS Wave 3 — webhook orchestration with signature verification and deduplication.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { AccessTransactionOrchestrator } from './orchestrator.ts';
import type { AccessWebhookEvent } from './types.ts';

export type WebhookOutcome =
  | { readonly ok: true; readonly duplicate?: true }
  | { readonly ok: false; readonly code: string; readonly message: string };

export class AccessWebhookOrchestrator {
  private readonly orchestrator: AccessTransactionOrchestrator;
  private readonly processed = new Set<string>();

  constructor(orchestrator: AccessTransactionOrchestrator) {
    this.orchestrator = orchestrator;
  }

  async handle(event: AccessWebhookEvent): Promise<WebhookOutcome> {
    if (!event.signatureVerified) {
      return { ok: false, code: 'SIGNATURE_INVALID', message: 'webhook signature verification failed' };
    }
    if (this.processed.has(event.idempotencyKey)) {
      return { ok: true, duplicate: true };
    }
    if (!event.transactionId) {
      return { ok: false, code: 'TRANSACTION_UNKNOWN', message: 'webhook missing transaction binding' };
    }

    const result = await this.orchestrator.applyWebhook(event);
    if (!result.ok) {
      return result;
    }
    this.processed.add(event.idempotencyKey);
    return { ok: true };
  }

  isProcessed(idempotencyKey: string): boolean {
    return this.processed.has(idempotencyKey);
  }
}
