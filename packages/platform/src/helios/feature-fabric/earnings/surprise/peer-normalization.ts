/**
 * Peer-relative surprise normalization (industry, sector, market-cap bucket).
 */

import type { PeerNormalizationScope } from './taxonomy.ts';
import type { EarningsSurpriseDecomposition, PeerSurpriseNormalization, ScaledSurprise } from './types.ts';

export function computePeerNormalizations(input: {
  readonly cells: readonly EarningsSurpriseDecomposition[];
  readonly peerGroups: Readonly<
    Partial<
      Record<
        PeerNormalizationScope,
        {
          readonly groupId: string;
          readonly peerStandardizedByKey: Readonly<Record<string, ScaledSurprise>>;
        }
      >
    >
  >;
}): readonly PeerSurpriseNormalization[] {
  const rows: PeerSurpriseNormalization[] = [];
  for (const cell of input.cells) {
    if (!cell.calculable || cell.standardizedScaled === null) continue;
    for (const scope of Object.keys(input.peerGroups) as PeerNormalizationScope[]) {
      const group = input.peerGroups[scope];
      if (!group) continue;
      const peerKey = peerLookupKey(cell);
      const peerMedian = group.peerStandardizedByKey[peerKey] ?? null;
      rows.push(
        Object.freeze({
          scope,
          peerGroupId: group.groupId,
          dimension: cell.key.dimension,
          method: cell.key.method,
          expectationSource: cell.key.expectationSource,
          entityStandardizedScaled: cell.standardizedScaled,
          peerMedianScaled: peerMedian,
          peerRelativeScaled:
            peerMedian === null ? null : (cell.standardizedScaled - peerMedian) as ScaledSurprise,
          grantsExecutionAuthority: false as const,
        }),
      );
    }
  }
  return Object.freeze(rows);
}

function peerLookupKey(cell: EarningsSurpriseDecomposition): string {
  return `${cell.key.dimension}|${cell.key.method}|${cell.key.expectationSource}`;
}
