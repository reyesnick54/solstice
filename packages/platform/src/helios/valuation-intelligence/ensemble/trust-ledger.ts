import type { UtcInstant } from '@solstice/domain';

import type { ModelApplicabilityState, ModelReliabilityState, ModelTrustLedger, ModelTrustLedgerEntry } from './types.ts';

export function appendModelTrustLedgerEntry(
  ledger: ModelTrustLedger,
  input: {
    readonly method: ModelTrustLedgerEntry['method'];
    readonly lane: ModelTrustLedgerEntry['lane'];
    readonly evaluationTime: UtcInstant;
    readonly reliability: ModelReliabilityState;
    readonly applicability: ModelApplicabilityState;
    readonly sealedAt: UtcInstant;
  },
): ModelTrustLedger {
  const entry: ModelTrustLedgerEntry = Object.freeze({
    entryId: `${ledger.ledgerId}:${ledger.entries.length + 1}`,
    method: input.method,
    lane: input.lane,
    evaluationTime: input.evaluationTime,
    reliability: input.reliability,
    applicability: input.applicability,
    sealedAt: input.sealedAt,
    selfModifying: false,
  });

  return Object.freeze({
    ...ledger,
    entries: Object.freeze([...ledger.entries, entry]),
  });
}

export function createModelTrustLedger(input: {
  readonly ledgerId: string;
  readonly entityId: string;
}): ModelTrustLedger {
  return Object.freeze({
    ledgerId: input.ledgerId,
    entityId: input.entityId,
    entries: Object.freeze([]),
    appendOnly: true,
    grantsExecutionAuthority: false,
    researchOnly: true,
  });
}
