/**
 * Provider disagreement and data-quality events.
 */

import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { ChainObservationType, ExternalBlockchainId, ProviderDisagreementEvent } from './types.ts';

export type DisagreementListener = (event: ProviderDisagreementEvent) => void;

export class ChainIntelligenceEventBus {
  readonly #listeners = new Set<DisagreementListener>();

  subscribe(listener: DisagreementListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  emitDisagreement(input: {
    readonly chainId: ExternalBlockchainId;
    readonly observationType: ChainObservationType;
    readonly primaryProviderId: string;
    readonly secondaryProviderId: string;
    readonly field: string;
    readonly primaryValue: string;
    readonly secondaryValue: string;
    readonly detectedAt: UtcInstant;
    readonly severity?: 'material' | 'minor';
  }): ProviderDisagreementEvent {
    const event: ProviderDisagreementEvent = Object.freeze({
      schema: 'sunrey.chain-intelligence.disagreement.v1',
      chainId: input.chainId,
      observationType: input.observationType,
      primaryProviderId: input.primaryProviderId,
      secondaryProviderId: input.secondaryProviderId,
      field: input.field,
      primaryValue: input.primaryValue,
      secondaryValue: input.secondaryValue,
      detectedAt: input.detectedAt,
      severity: input.severity ?? (input.field === 'blockHash' || input.field === 'txStatus' ? 'material' : 'minor'),
    });
    for (const listener of this.#listeners) {
      listener(event);
    }
    return event;
  }

  createCorrelationId(): string {
    return randomUUID();
  }
}

export const defaultChainIntelligenceEventBus = new ChainIntelligenceEventBus();
