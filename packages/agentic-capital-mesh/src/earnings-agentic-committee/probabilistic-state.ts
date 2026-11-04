import { createHash } from 'node:crypto';

import type { UtcInstant } from '../imports.ts';
import type { FrozenEarningsEvidencePack, ProbabilisticEarningsState } from './types.ts';

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function buildProbabilisticEarningsState(input: {
  readonly entity: string;
  readonly event: string;
  readonly informationTime: UtcInstant;
  readonly pack: FrozenEarningsEvidencePack;
}): ProbabilisticEarningsState {
  const freshCount = input.pack.evidence.filter((row) => row.freshnessOk).length;
  const entitledCount = input.pack.evidence.filter((row) => row.entitlementOk).length;
  const coverageRatio = clamp01(freshCount / input.pack.evidence.length);
  const entitlementRatio = clamp01(entitledCount / input.pack.evidence.length);

  const beatBase = 0.45 + coverageRatio * 0.15 - (1 - entitlementRatio) * 0.1;
  const missProb = clamp01(1 - beatBase - 0.15);
  const inlineProb = clamp01(1 - beatBase - missProb);

  const guidanceRaise = clamp01(0.35 + coverageRatio * 0.2);
  const guidanceInline = clamp01(0.4);
  const guidanceCut = clamp01(1 - guidanceRaise - guidanceInline);

  const stateId = `pes_${createHash('sha256')
    .update(`${input.entity}:${input.event}:${input.pack.contentHash}`)
    .digest('hex')
    .slice(0, 16)}`;

  const uncertaintyScore = clamp01(1 - (coverageRatio * 0.6 + entitlementRatio * 0.4));

  return Object.freeze({
    stateId,
    entityRef: input.entity,
    eventRef: input.event,
    informationTime: input.informationTime,
    beatProbabilities: Object.freeze([
      Object.freeze({ label: 'BEAT', probability: clamp01(beatBase) }),
      Object.freeze({ label: 'INLINE', probability: inlineProb }),
      Object.freeze({ label: 'MISS', probability: missProb }),
    ]),
    guidanceProbabilities: Object.freeze([
      Object.freeze({ label: 'RAISE', probability: guidanceRaise }),
      Object.freeze({ label: 'MAINTAIN', probability: guidanceInline }),
      Object.freeze({ label: 'CUT', probability: guidanceCut }),
    ]),
    impliedMoveBps: coverageRatio >= 0.5 ? Math.round(400 + coverageRatio * 200) : null,
    consensusEpsMinor: null,
    uncertaintyScore,
  });
}
