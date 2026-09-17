import type { CustomerId } from '../../../../domain/src/customer.ts';
import type { DecisionValidityEnvelopeId } from './ids.ts';
import type { DecisionValidityEnvelope, DecisionValidityStoreSnapshot } from './types.ts';

/**
 * Immutable append-only store for Decision-Validity Envelopes.
 * Historical envelopes are never mutated.
 */
export class InMemoryDecisionValidityStore {
  private readonly envelopes = new Map<DecisionValidityEnvelopeId, DecisionValidityEnvelope>();

  put(envelope: DecisionValidityEnvelope): void {
    if (this.envelopes.has(envelope.envelopeId)) {
      throw new Error(`envelope already exists: ${envelope.envelopeId}`);
    }
    this.envelopes.set(envelope.envelopeId, envelope);
  }

  get(envelopeId: DecisionValidityEnvelopeId): DecisionValidityEnvelope | null {
    return this.envelopes.get(envelopeId) ?? null;
  }

  latestForCandidate(candidateId: string): DecisionValidityEnvelope | null {
    let latest: DecisionValidityEnvelope | null = null;
    for (const envelope of this.envelopes.values()) {
      if (envelope.candidateId !== candidateId) {
        continue;
      }
      if (!latest || envelope.revision > latest.revision) {
        latest = envelope;
      }
    }
    return latest;
  }

  forCustomer(customerId: CustomerId): readonly DecisionValidityEnvelope[] {
    return Object.freeze(
      [...this.envelopes.values()].filter((e) => e.customerId === customerId),
    );
  }

  snapshot(): DecisionValidityStoreSnapshot {
    return Object.freeze({
      envelopes: Object.freeze([...this.envelopes.values()]),
    });
  }

  restore(snapshot: DecisionValidityStoreSnapshot): void {
    this.envelopes.clear();
    for (const envelope of snapshot.envelopes) {
      this.envelopes.set(envelope.envelopeId, envelope);
    }
  }
}
