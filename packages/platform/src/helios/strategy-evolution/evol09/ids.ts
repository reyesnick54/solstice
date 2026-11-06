import { createHash } from 'node:crypto';

import type { EvolutionTrialId } from './types.ts';

export function evolutionTrialIdFromFingerprint(input: {
  readonly genomeId: string;
  readonly generation: number;
  readonly origin: string;
  readonly recordedAtIso: string;
  readonly seq: number;
}): EvolutionTrialId {
  const h = createHash('sha256')
    .update(
      [
        input.genomeId,
        String(input.generation),
        input.origin,
        input.recordedAtIso,
        String(input.seq),
      ].join('\0'),
    )
    .digest('hex')
    .slice(0, 32);
  return h as EvolutionTrialId;
}
