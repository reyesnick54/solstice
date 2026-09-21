import type { UtcInstant } from '@solstice/domain';

import { ENGINEERING_INSTRUMENT_ECONOMIC_METADATA } from './metadata.ts';
import type {
  EconomicRelationship,
  EconomicRelationshipGraph,
  InstrumentEconomicMetadata,
} from './types.ts';

function relationship(input: EconomicRelationship): EconomicRelationship {
  return Object.freeze(input);
}

function buildReferenceRelationships(metadata: readonly InstrumentEconomicMetadata[]): readonly EconomicRelationship[] {
  const rows: EconomicRelationship[] = [];
  for (const item of metadata) {
    if (item.benchmarkInstrumentId) {
      rows.push(
        relationship({
          relationshipId: `rel_tracks_${item.instrumentId}_${item.benchmarkInstrumentId}`,
          kind: 'TRACKS_INDEX',
          fromInstrumentId: item.instrumentId,
          toInstrumentId: item.benchmarkInstrumentId,
          weightBps: 10_000,
          provenanceKind: 'DERIVED',
          sourceRefs: Object.freeze([...item.sourceRefs, 'helios:m15:tracks_index']),
        }),
      );
    }
    if (item.sector) {
      for (const peer of metadata) {
        if (peer.instrumentId === item.instrumentId || peer.sector !== item.sector) {
          continue;
        }
        rows.push(
          relationship({
            relationshipId: `rel_sector_${item.instrumentId}_${peer.instrumentId}`,
            kind: 'SAME_SECTOR',
            fromInstrumentId: item.instrumentId,
            toInstrumentId: peer.instrumentId,
            weightBps: null,
            provenanceKind: 'DERIVED',
            sourceRefs: Object.freeze([...item.sourceRefs, ...peer.sourceRefs, 'helios:m15:same_sector']),
          }),
        );
      }
    }
    if (item.factorTags.includes('RISK_ON')) {
      for (const peer of metadata) {
        if (peer.instrumentId === item.instrumentId || !peer.factorTags.includes('RISK_ON')) {
          continue;
        }
        rows.push(
          relationship({
            relationshipId: `rel_risk_on_${item.instrumentId}_${peer.instrumentId}`,
            kind: 'RISK_ON_CLUSTER',
            fromInstrumentId: item.instrumentId,
            toInstrumentId: peer.instrumentId,
            weightBps: null,
            provenanceKind: 'DERIVED',
            sourceRefs: Object.freeze(['helios:m15:risk_on_cluster']),
          }),
        );
      }
    }
    if (item.factorTags.includes('METALS') && item.benchmarkInstrumentId?.startsWith('COMMODITY:')) {
      rows.push(
        relationship({
          relationshipId: `rel_commodity_${item.instrumentId}_${item.benchmarkInstrumentId}`,
          kind: 'COMMODITY_LINK',
          fromInstrumentId: item.instrumentId,
          toInstrumentId: item.benchmarkInstrumentId,
          weightBps: 9_500,
          provenanceKind: 'DIRECTLY_MEASURED',
          sourceRefs: Object.freeze([...item.sourceRefs, 'helios:m15:commodity_link']),
        }),
      );
    }
  }
  rows.push(
    relationship({
      relationshipId: 'rel_underlies_cl_wti',
      kind: 'UNDERLIES',
      fromInstrumentId: 'FUTURE:GLOBAL:CL:XNYM:202612',
      toInstrumentId: 'COMMODITY:GLOBAL:WTI:XNYM',
      weightBps: 10_000,
      provenanceKind: 'DIRECTLY_MEASURED',
      sourceRefs: Object.freeze(['helios:m15:future_underlying']),
    }),
    relationship({
      relationshipId: 'rel_hedge_gld_gold',
      kind: 'HEDGE_TO',
      fromInstrumentId: 'SECURITY:US:GLD:ARCX',
      toInstrumentId: 'COMMODITY:GLOBAL:GOLD:XCEC',
      weightBps: 9_800,
      provenanceKind: 'DERIVED',
      sourceRefs: Object.freeze(['helios:m15:gold_hedge']),
    }),
  );
  return Object.freeze(rows);
}

export function buildEconomicRelationshipGraph(input: {
  readonly asOf: UtcInstant;
  readonly metadata?: readonly InstrumentEconomicMetadata[];
}): EconomicRelationshipGraph {
  const metadata = input.metadata ?? ENGINEERING_INSTRUMENT_ECONOMIC_METADATA;
  const metadataByInstrument: Record<string, InstrumentEconomicMetadata> = {};
  for (const row of metadata) {
    metadataByInstrument[row.instrumentId] = row;
  }
  return Object.freeze({
    asOf: input.asOf,
    metadataByInstrument: Object.freeze(metadataByInstrument),
    relationships: buildReferenceRelationships(metadata),
    simulationOnly: true,
  });
}
