import type { UtcInstant } from '@solstice/domain';

import { distributionPercentiles } from '../val04-probabilistic-dcf/percentiles.ts';
import { VAL08_COMPARABLES_SCHEMA } from './taxonomy.ts';

export type ComparablePeerObservation = {
  readonly peerId: string;
  readonly evToEbitda: number;
  readonly knowableAt: UtcInstant;
};

export type ComparablesResult = {
  readonly schema: typeof VAL08_COMPARABLES_SCHEMA;
  readonly entityId: string;
  readonly asOf: UtcInstant;
  readonly impliedValuePerShare: ReturnType<typeof distributionPercentiles>;
  readonly peerCount: number;
  readonly evidenceRef: string;
  readonly grantsExecutionAuthority: false;
  readonly researchOnly: true;
};

export function runProbabilisticComparables(input: {
  readonly entityId: string;
  readonly asOf: UtcInstant;
  readonly targetEbitda: number;
  readonly netDebt: number;
  readonly sharesOutstanding: number;
  readonly peers: readonly ComparablePeerObservation[];
  readonly evidenceRef: string;
}): ComparablesResult {
  const values: number[] = [];
  for (const peer of input.peers) {
    const enterprise = peer.evToEbitda * input.targetEbitda;
    const equity = enterprise - input.netDebt;
    values.push(equity / input.sharesOutstanding);
  }
  return Object.freeze({
    schema: VAL08_COMPARABLES_SCHEMA,
    entityId: input.entityId,
    asOf: input.asOf,
    impliedValuePerShare: distributionPercentiles(values),
    peerCount: input.peers.length,
    evidenceRef: input.evidenceRef,
    grantsExecutionAuthority: false,
    researchOnly: true,
  });
}
