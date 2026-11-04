/**
 * Compile a point-in-time earnings intelligence manifest.
 */

import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';
import { assertNoEarningsLeakage } from './knowable-at.ts';
import type { EarningsIntelligenceManifest, EarningsIntelligenceStoreSnapshot } from './earn01-canonical-domain.ts';
import { HELIOS_EARN01_CANONICAL_DOMAIN_SCHEMA } from './taxonomy.ts';

export function compileEarningsIntelligenceManifest(input: {
  readonly evaluationTime: UtcInstant;
  readonly compiledAt: UtcInstant;
  readonly snapshot: EarningsIntelligenceStoreSnapshot;
}): EarningsIntelligenceManifest {
  assertNoEarningsLeakage(input.evaluationTime, input.snapshot.events);
  assertNoEarningsLeakage(input.evaluationTime, input.snapshot.observations);

  const manifestId = `earn_manifest_${createHash('sha256')
    .update(`${input.evaluationTime}:${input.snapshot.events.length}:${input.snapshot.observations.length}`)
    .digest('hex')
    .slice(0, 24)}`;

  return Object.freeze({
    schema: HELIOS_EARN01_CANONICAL_DOMAIN_SCHEMA,
    manifestId,
    compiledAt: input.compiledAt,
    evaluationTime: input.evaluationTime,
    events: Object.freeze([...input.snapshot.events]),
    observations: Object.freeze([...input.snapshot.observations]),
    grantsExecutionAuthority: false,
  });
}
