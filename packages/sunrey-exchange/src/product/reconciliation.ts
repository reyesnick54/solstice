import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { ClearingRecord, FillObligation, PersistentBreak } from './types.ts';

export type PositionView = {
  readonly ownerId: string;
  readonly assetId: string;
  readonly quantity: bigint;
};

export function recordBreak(input: {
  readonly kind: PersistentBreak['kind'];
  readonly exchangeRef: string;
  readonly externalRef?: string | null;
  readonly exchangeQuantity: bigint;
  readonly externalQuantity: bigint;
  readonly notes: readonly string[];
  readonly at: UtcInstant;
}): PersistentBreak {
  return Object.freeze({
    breakId: `xbrk_${randomUUID().replace(/-/g, '')}`,
    kind: input.kind,
    exchangeRef: input.exchangeRef,
    externalRef: input.externalRef ?? null,
    exchangeQuantity: input.exchangeQuantity,
    externalQuantity: input.externalQuantity,
    notes: Object.freeze([...input.notes]),
    autoCorrected: false,
    createdAt: input.at,
  });
}

export function reconcileExchangePositions(input: {
  readonly obligations: readonly FillObligation[];
  readonly clearing: readonly ClearingRecord[];
  readonly exchangePositions: readonly PositionView[];
  readonly ledgerPositions: readonly PositionView[];
  readonly custodyPositions: readonly PositionView[];
  readonly chainPositions: readonly PositionView[];
  readonly at: UtcInstant;
}): {
  readonly matched: boolean;
  readonly breaks: readonly PersistentBreak[];
  readonly autoCorrected: false;
  readonly mutatedBooks: false;
} {
  const breaks: PersistentBreak[] = [];
  const clearingByObligation = new Map(input.clearing.map((item) => [item.obligationId, item]));

  for (const obligation of input.obligations) {
    const record = clearingByObligation.get(obligation.obligationId);
    if (!record) {
      breaks.push(
        recordBreak({
          kind: 'OBLIGATION_WITHOUT_SETTLEMENT',
          exchangeRef: obligation.obligationId,
          exchangeQuantity: obligation.quantity,
          externalQuantity: 0n,
          notes: ['fill obligation has no clearing record'],
          at: input.at,
        }),
      );
      continue;
    }
    if (record.state === 'REQUIRES_REVIEW' && record.failureCode === 'DVP_PARTIAL') {
      breaks.push(
        recordBreak({
          kind: 'ONE_SIDED_DVP',
          exchangeRef: obligation.obligationId,
          exchangeQuantity: obligation.quantity,
          externalQuantity: 0n,
          notes: ['one rail delivered without the contra; books were not silently adjusted'],
          at: input.at,
        }),
      );
    }
    if (record.state === 'SETTLED' && obligation.quoteRail === 'LEDGER_FIAT' && !record.refs.ledger.cashJournalId) {
      breaks.push(
        recordBreak({
          kind: 'EXCHANGE_VS_LEDGER',
          exchangeRef: obligation.tradeId,
          externalRef: null,
          exchangeQuantity: obligation.quoteMinorUnits,
          externalQuantity: 0n,
          notes: ['settled clearing missing ledger cash journal'],
          at: input.at,
        }),
      );
    }
  }

  compareBooks(input.exchangePositions, input.ledgerPositions, 'EXCHANGE_VS_LEDGER', input.at, breaks);
  compareBooks(input.exchangePositions, input.custodyPositions, 'EXCHANGE_VS_CUSTODY', input.at, breaks);
  compareBooks(input.exchangePositions, input.chainPositions, 'EXCHANGE_VS_CHAIN', input.at, breaks);

  return Object.freeze({
    matched: breaks.length === 0,
    breaks: Object.freeze(breaks),
    autoCorrected: false,
    mutatedBooks: false,
  });
}

function compareBooks(
  left: readonly PositionView[],
  right: readonly PositionView[],
  kind: PersistentBreak['kind'],
  at: UtcInstant,
  out: PersistentBreak[],
): void {
  const rightMap = new Map(right.map((item) => [`${item.ownerId}:${item.assetId}`, item.quantity]));
  for (const item of left) {
    const key = `${item.ownerId}:${item.assetId}`;
    const external = rightMap.get(key);
    if (external === undefined) {
      continue;
    }
    if (external !== item.quantity) {
      out.push(
        recordBreak({
          kind,
          exchangeRef: key,
          externalRef: key,
          exchangeQuantity: item.quantity,
          externalQuantity: external,
          notes: ['position mismatch; no silent mutation'],
          at,
        }),
      );
    }
  }
}
