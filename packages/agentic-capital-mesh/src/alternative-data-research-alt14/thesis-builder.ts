import { createHash } from 'node:crypto';

import type { UtcInstant } from '../imports.ts';
import type { AlternativeDataAlt14Artifact, AlternativeDataResearchThesis } from './types.ts';

function hashSegment(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 16);
}

export function buildAlternativeDataResearchThesis(input: {
  readonly workOrderId: string;
  readonly subjectId: string;
  readonly entityId: string;
  readonly informationTime: UtcInstant;
  readonly artifacts: readonly AlternativeDataAlt14Artifact[];
}): AlternativeDataResearchThesis {
  const thesisId = `alt14_th_${hashSegment(`${input.workOrderId}:${input.subjectId}:${input.informationTime}`)}`;
  return Object.freeze({
    thesisId,
    workOrderId: input.workOrderId,
    subjectId: input.subjectId,
    entityId: input.entityId,
    informationTime: input.informationTime,
    summary:
      'Alternative-data committee produced research evidence only. AAF-certified features may be proposed to Strategy Genome after skeptic review; no execution authority is granted.',
    researchEvidenceOnly: true,
    specialistCount: input.artifacts.length,
  });
}
