import type { UtcInstant } from '../../../domain/src/time.ts';
import type { SubjectKind } from './types.ts';

/**
 * Minimal opaque counterparty facts for future payments.
 * Not a beneficiary/payment model.
 */
export type CounterpartyFact = {
  readonly counterpartyRef: string;
  readonly kind: Extract<SubjectKind, 'PERSON' | 'BUSINESS' | 'BENEFICIARY' | 'COUNTERPARTY'>;
  readonly jurisdiction: string | null;
  readonly latestSanctionsId: string | null;
  readonly latestPepId: string | null;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

export function upsertCounterparty(
  current: CounterpartyFact | undefined,
  input: {
    readonly counterpartyRef: string;
    readonly kind: CounterpartyFact['kind'];
    readonly jurisdiction?: string;
    readonly sanctionsId?: string;
    readonly pepId?: string;
    readonly now: UtcInstant;
  },
): CounterpartyFact {
  return Object.freeze({
    counterpartyRef: input.counterpartyRef,
    kind: input.kind,
    jurisdiction: input.jurisdiction ?? current?.jurisdiction ?? null,
    latestSanctionsId: input.sanctionsId ?? current?.latestSanctionsId ?? null,
    latestPepId: input.pepId ?? current?.latestPepId ?? null,
    createdAt: current?.createdAt ?? input.now,
    updatedAt: input.now,
  });
}
