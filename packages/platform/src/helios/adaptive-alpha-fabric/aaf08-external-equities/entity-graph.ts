/**
 * Seed AAF03 temporal mappings for AAF08 finnhub symbols → M01 instrument IDs.
 */

import { asUtcInstant } from '../../../../../domain/src/time.ts';
import type { TemporalEntityGraphStore } from '../../feature-fabric/entity-resolution/graph-store.ts';
import { temporalEntityNodeIdFor } from '../../feature-fabric/entity-resolution/ids.ts';
import { AAF08_EQUITIES_ETF_UNIVERSE } from './universe.ts';

const T0 = asUtcInstant('2010-01-01T00:00:00.000Z');
const KNOWABLE = asUtcInstant('2010-01-02T00:00:00.000Z');

const FINNHUB_SYMBOLS: Readonly<Record<string, { readonly symbol: string; readonly displayName: string }>> =
  Object.freeze({
    'SECURITY:US:SPY:ARCX': Object.freeze({ symbol: 'SPY', displayName: 'SPDR S&P 500 ETF Trust' }),
    'SECURITY:US:QQQ:XNAS': Object.freeze({ symbol: 'QQQ', displayName: 'Invesco QQQ Trust' }),
    'SECURITY:US:NVDA:XNAS': Object.freeze({ symbol: 'NVDA', displayName: 'NVIDIA Corporation' }),
  });

export function seedAaf08EquitiesEntityGraph(store: TemporalEntityGraphStore): void {
  const edgeBase = {
    evidenceRefs: Object.freeze(['evidence:aaf08:instrument_registry']),
    source: 'helios:aaf08:universe',
    confidenceState: 'CONFIRMED' as const,
    ambiguityState: 'UNAMBIGUOUS' as const,
    observedAt: T0,
    knowableAt: KNOWABLE,
    jurisdiction: 'US',
    effectiveFrom: T0,
    effectiveTo: null,
  };

  for (const instrumentId of AAF08_EQUITIES_ETF_UNIVERSE) {
    const meta = FINNHUB_SYMBOLS[instrumentId];
    if (!meta) continue;
    const node = store.upsertNode({
      nodeId: temporalEntityNodeIdFor(`aaf08:security:${instrumentId}`),
      kind: 'SECURITY',
      displayName: meta.displayName,
      jurisdiction: 'US',
      economicKnowledgeEntityId: null,
      payload: Object.freeze({
        symbol: meta.symbol,
        m01InstrumentId: instrumentId,
        venueId: instrumentId.split(':')[3] ?? 'UNKNOWN',
      }),
    });
    store.registerProviderMapping({
      providerId: 'finnhub',
      providerSymbol: meta.symbol,
      providerInstrumentId: `finnhub:${meta.symbol}`,
      targetNodeId: node.nodeId,
      ...edgeBase,
    });
    store.registerProviderMapping({
      providerId: 'fixture_aaf08',
      providerSymbol: meta.symbol,
      providerInstrumentId: `fixture:${meta.symbol}`,
      targetNodeId: node.nodeId,
      ...edgeBase,
    });
  }
}
